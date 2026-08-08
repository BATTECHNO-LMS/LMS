'use strict';

const { prisma } = require('../../config/db');
const { log } = require('../../utils/logger');
const { isKnownEvent, getEventMeta } = require('./notificationEvents.catalog');
const {
  renderTemplate,
  mapPriorityToLegacyType,
  buildDeduplicationKey,
  sanitizeTemplateVars,
} = require('./notificationEngine.shared');
const {
  resolveRecipients,
  filterRecipientsByRule,
  resolveUniversityId,
} = require('./recipientResolver.service');

const RULES_CACHE_TTL_MS = 60_000;
/** @type {{ loadedAt: number, byEvent: Map<string, any[]> } | null} */
let rulesCache = null;

const CRITICAL_ACCOUNT_EMAIL_EVENTS = new Set([
  'ACCOUNT_PENDING_ACTIVATION',
  'ACCOUNT_ACTIVATED',
  'ACCOUNT_ACTIVATION_DELAYED',
  'ACCOUNT_REJECTED',
  'ACCOUNT_DISABLED',
  'ACCOUNT_REACTIVATED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_CHANGED',
]);

/**
 * @returns {Promise<Map<string, any[]>>}
 */
async function loadActiveRulesByEvent() {
  const now = Date.now();
  if (rulesCache && now - rulesCache.loadedAt < RULES_CACHE_TTL_MS) {
    return rulesCache.byEvent;
  }
  const rows = await prisma.notification_rules.findMany({
    where: { status: 'ACTIVE' },
    include: {
      notification_templates: {
        where: { status: 'ACTIVE' },
      },
    },
  });
  const byEvent = new Map();
  for (const rule of rows) {
    const key = String(rule.event_type);
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key).push(rule);
  }
  rulesCache = { loadedAt: now, byEvent };
  return byEvent;
}

function invalidateRulesCache() {
  rulesCache = null;
}

/**
 * @param {any[]} templates
 * @param {string} roleCode
 * @param {string} channel
 * @returns {any | null}
 */
function pickTemplate(templates, roleCode, channel) {
  const list = Array.isArray(templates) ? templates : [];
  const role = String(roleCode || '').toLowerCase();
  const ch = String(channel || 'IN_APP');
  const exact = list.find(
    (t) => String(t.role_code).toLowerCase() === role && String(t.channel) === ch
  );
  if (exact) return exact;
  const anyRole = list.find((t) => String(t.channel) === ch);
  if (anyRole) return anyRole;
  const roleAnyChannel = list.find((t) => String(t.role_code).toLowerCase() === role);
  if (roleAnyChannel) return roleAnyChannel;
  return list[0] || null;
}

/**
 * @param {string} userId
 * @param {string} category
 * @param {string} channel
 * @returns {Promise<boolean>} true if channel allowed
 */
async function isChannelEnabledForUser(userId, category, channel) {
  const pref = await prisma.notification_preferences.findUnique({
    where: {
      user_id_notification_category_channel: {
        user_id: userId,
        notification_category: category,
        channel,
      },
    },
    select: { is_enabled: true },
  });
  if (!pref) return true;
  return Boolean(pref.is_enabled);
}

/**
 * Best-effort push fanout; never throws to caller.
 * @param {object} row
 * @param {string} deliveryId
 */
function fanoutPushBestEffort(row, deliveryId) {
  setImmediate(() => {
    (async () => {
      try {
        const push = require('../../services/pushNotification.service');
        const result = await push.sendToUser(row.user_id, {
          notificationId: row.id,
          title: row.title,
          body: row.body,
          actionUrl: row.action_url,
          type: row.type,
        });
        await prisma.notification_deliveries.update({
          where: { id: deliveryId },
          data: {
            status: result?.skipped ? 'SKIPPED' : 'SENT',
            sent_at: new Date(),
            attempt_count: { increment: 1 },
            failure_message_safe: result?.skipped ? 'تعذر إرسال الإشعار الفوري حالياً' : null,
            updated_at: new Date(),
          },
        });
      } catch (_err) {
        try {
          await prisma.notification_deliveries.update({
            where: { id: deliveryId },
            data: {
              status: 'FAILED',
              failed_at: new Date(),
              attempt_count: { increment: 1 },
              failure_code: 'PUSH_FAILED',
              failure_message_safe: 'تعذر إرسال الإشعار الفوري',
              updated_at: new Date(),
            },
          });
        } catch (_e) {
          // ignore
        }
      }
    })();
  });
}

/**
 * EMAIL: only for critical account events if a generic sender exists; otherwise SKIPPED.
 * @param {object} row
 * @param {string} deliveryId
 * @param {string} eventType
 */
async function tryEmailDelivery(row, deliveryId, eventType) {
  if (!CRITICAL_ACCOUNT_EMAIL_EVENTS.has(eventType)) {
    await prisma.notification_deliveries.update({
      where: { id: deliveryId },
      data: {
        status: 'SKIPPED',
        failure_code: 'EMAIL_NOT_APPLICABLE',
        failure_message_safe: 'البريد غير مطلوب لهذا الحدث',
        updated_at: new Date(),
      },
    });
    return;
  }

  try {
    const emailService = require('../../shared/services/email.service');
    if (typeof emailService.sendGenericNotificationEmail !== 'function') {
      await prisma.notification_deliveries.update({
        where: { id: deliveryId },
        data: {
          status: 'SKIPPED',
          failure_code: 'EMAIL_SENDER_UNAVAILABLE',
          failure_message_safe: 'إرسال البريد غير متاح حالياً لهذا النوع من الإشعارات',
          updated_at: new Date(),
        },
      });
      return;
    }
    const user = await prisma.users.findUnique({
      where: { id: row.user_id },
      select: { email: true, full_name: true },
    });
    if (!user?.email) {
      await prisma.notification_deliveries.update({
        where: { id: deliveryId },
        data: {
          status: 'SKIPPED',
          failure_code: 'NO_EMAIL',
          failure_message_safe: 'لا يوجد بريد إلكتروني للمستلم',
          updated_at: new Date(),
        },
      });
      return;
    }
    await emailService.sendGenericNotificationEmail({
      to: user.email,
      subject: row.title,
      body: row.body || '',
      userName: user.full_name,
    });
    await prisma.notification_deliveries.update({
      where: { id: deliveryId },
      data: {
        status: 'SENT',
        sent_at: new Date(),
        attempt_count: { increment: 1 },
        updated_at: new Date(),
      },
    });
  } catch (_err) {
    await prisma.notification_deliveries.update({
      where: { id: deliveryId },
      data: {
        status: 'FAILED',
        failed_at: new Date(),
        attempt_count: { increment: 1 },
        failure_code: 'EMAIL_FAILED',
        failure_message_safe: 'تعذر إرسال البريد الإلكتروني',
        updated_at: new Date(),
      },
    });
  }
}

/**
 * Create in-app notification row with engine fields; on unique dedupe conflict return null.
 * @param {object} data
 * @returns {Promise<object | null>}
 */
async function createNotificationRow(data) {
  try {
    return await prisma.notifications.create({ data });
  } catch (err) {
    if (err?.code === 'P2002') return null;
    const msg = String(err?.message || '');
    if (msg.includes('deduplication_key') || msg.includes('Unique constraint')) return null;
    // Fallback if extended columns missing in older DB: minimal create
    if (msg.includes('Unknown arg') || msg.includes('column') || msg.includes('does not exist')) {
      try {
        return await prisma.notifications.create({
          data: {
            user_id: data.user_id,
            title: data.title,
            body: data.body,
            type: data.type,
            action_url: data.action_url,
            is_read: false,
          },
        });
      } catch (_e2) {
        return null;
      }
    }
    throw err;
  }
}

/**
 * Central domain-event entry point for the notification rules engine.
 * Delivery failures never throw to the caller.
 *
 * @param {string} eventType
 * @param {Record<string, unknown>} [context]
 * @returns {Promise<{ created: number, skipped: number, deliveries: number, reason?: string }>}
 */
async function emitDomainEvent(eventType, context = {}) {
  const type = String(eventType || '');
  if (!isKnownEvent(type)) {
    log('warn', '[notificationEngine] UNKNOWN_EVENT', { eventType: type });
    return { created: 0, skipped: true, deliveries: 0, reason: 'UNKNOWN_EVENT' };
  }

  const result = { created: 0, skipped: 0, deliveries: 0 };

  try {
    const meta = getEventMeta(type);
    const byEvent = await loadActiveRulesByEvent();
    const rules = byEvent.get(type) || [];
    if (!rules.length) {
      result.skipped += 1;
      return { ...result, reason: 'NO_ACTIVE_RULES' };
    }

    const universityId = await resolveUniversityId(context);
    const templateVars = sanitizeTemplateVars({
      entity_type: context.entityType != null ? String(context.entityType) : undefined,
      entity_id: context.entityId != null ? String(context.entityId) : undefined,
      action_url: context.actionUrl != null ? String(context.actionUrl) : undefined,
      action_label: context.actionLabel != null ? String(context.actionLabel) : undefined,
      .../** @type {Record<string, unknown>} */ (context.templateVars || context.vars || {}),
    });

    // Never trust client-supplied recipient lists
    const baseRecipients = await resolveRecipients(type, context);

    for (const rule of rules) {
      try {
        let recipients = await filterRecipientsByRule(baseRecipients, rule, universityId);
        if (!recipients.length) {
          result.skipped += 1;
          continue;
        }

        const category = rule.category || meta?.category || 'SYSTEM';
        const priority = rule.priority || meta?.priority || 'NORMAL';
        const isCritical = Boolean(rule.is_critical || meta?.isCritical);
        const requiresAck = Boolean(
          rule.requires_acknowledgement || meta?.requiresAcknowledgement
        );
        const channels = Array.isArray(rule.channels) && rule.channels.length
          ? rule.channels.map(String)
          : ['IN_APP', 'NOTIFICATION_CENTER', 'BELL'];

        for (const recipient of recipients) {
          try {
            const inAppAllowed =
              isCritical ||
              !(await isChannelPreferenceDisabled(recipient.userId, category, 'IN_APP', rule));

            if (!inAppAllowed) {
              result.skipped += 1;
              continue;
            }

            const template = pickTemplate(
              rule.notification_templates,
              recipient.roleCode,
              'IN_APP'
            );
            const title = template
              ? renderTemplate(template.title_template, templateVars)
              : String(context.title || meta?.eventType || type);
            const body = template
              ? renderTemplate(template.body_template, templateVars)
              : context.body != null
                ? String(context.body)
                : null;
            const actionLabel = template?.action_label_template
              ? renderTemplate(template.action_label_template, templateVars) || null
              : context.actionLabel
                ? String(context.actionLabel)
                : null;
            const actionUrl = template?.action_url_template
              ? renderTemplate(template.action_url_template, templateVars) || null
              : context.actionUrl
                ? String(context.actionUrl)
                : null;

            // Reviewer links must stay read-only when provided via context.reviewerActionUrl
            const finalActionUrl =
              recipient.roleCode === 'reviewer' && context.reviewerActionUrl
                ? String(context.reviewerActionUrl)
                : actionUrl;

            const dedupeKey = buildDeduplicationKey({
              eventType: type,
              recipientId: recipient.userId,
              entityType: context.entityType ? String(context.entityType) : null,
              entityId: context.entityId ? String(context.entityId) : null,
              ruleId: rule.id,
            });

            const row = await createNotificationRow({
              user_id: recipient.userId,
              title: title || type,
              body,
              type: mapPriorityToLegacyType(priority),
              action_url: finalActionUrl,
              action_label: actionLabel,
              event_type: type,
              category,
              priority: String(priority),
              entity_type: context.entityType ? String(context.entityType) : null,
              entity_id: context.entityId ? String(context.entityId) : null,
              rule_id: rule.id,
              template_id: template?.id || null,
              actor_id: context.actorUserId ? String(context.actorUserId) : null,
              is_critical: isCritical,
              requires_acknowledgement: requiresAck,
              deduplication_key: dedupeKey,
            });

            if (!row) {
              result.skipped += 1;
              continue;
            }
            result.created += 1;

            // IN_APP delivery → SENT
            if (channels.includes('IN_APP') || channels.includes('NOTIFICATION_CENTER') || channels.includes('BELL')) {
              await prisma.notification_deliveries.create({
                data: {
                  notification_id: row.id,
                  channel: 'IN_APP',
                  status: 'SENT',
                  sent_at: new Date(),
                  attempt_count: 1,
                },
              });
              result.deliveries += 1;
            }

            // PUSH → PENDING then best-effort fanout
            if (channels.includes('PUSH')) {
              const pushAllowed =
                isCritical ||
                !(await isChannelPreferenceDisabled(recipient.userId, category, 'PUSH', rule));
              if (pushAllowed) {
                const pushDelivery = await prisma.notification_deliveries.create({
                  data: {
                    notification_id: row.id,
                    channel: 'PUSH',
                    status: 'PENDING',
                  },
                });
                result.deliveries += 1;
                fanoutPushBestEffort(row, pushDelivery.id);
              }
            }

            // EMAIL (critical account events only when generic sender exists)
            if (channels.includes('EMAIL')) {
              const emailAllowed =
                isCritical ||
                !(await isChannelPreferenceDisabled(recipient.userId, category, 'EMAIL', rule));
              if (emailAllowed) {
                const emailDelivery = await prisma.notification_deliveries.create({
                  data: {
                    notification_id: row.id,
                    channel: 'EMAIL',
                    status: 'PENDING',
                  },
                });
                result.deliveries += 1;
                await tryEmailDelivery(row, emailDelivery.id, type);
              }
            }
          } catch (recipientErr) {
            result.skipped += 1;
            log('warn', '[notificationEngine] recipient delivery failed', {
              eventType: type,
              userId: recipient.userId,
              error: String(recipientErr?.message || recipientErr).slice(0, 200),
            });
          }
        }
      } catch (ruleErr) {
        result.skipped += 1;
        log('warn', '[notificationEngine] rule processing failed', {
          eventType: type,
          ruleId: rule?.id,
          error: String(ruleErr?.message || ruleErr).slice(0, 200),
        });
      }
    }
  } catch (err) {
    log('error', '[notificationEngine] emitDomainEvent failed', {
      eventType: type,
      error: String(err?.message || err).slice(0, 300),
    });
  }

  return result;
}

/**
 * @param {string} userId
 * @param {string} category
 * @param {string} channel
 * @param {any} rule
 * @returns {Promise<boolean>} true if preference disables this channel
 */
async function isChannelPreferenceDisabled(userId, category, channel, rule) {
  if (rule?.is_critical) return false;
  if (rule?.user_can_disable === false) return false;
  const enabled = await isChannelEnabledForUser(userId, category, channel);
  return !enabled;
}

/**
 * Schedule a delayed/idempotent job.
 * @param {string} jobKey
 * @param {string} eventType
 * @param {Date|string|number} runAt
 * @param {Record<string, unknown>} [payload]
 */
async function scheduleJob(jobKey, eventType, runAt, payload = {}) {
  const key = String(jobKey || '').slice(0, 200);
  if (!key) throw new Error('jobKey required');
  const at = runAt instanceof Date ? runAt : new Date(runAt);
  const data = {
    job_key: key,
    event_type: String(eventType),
    entity_type: payload.entityType ? String(payload.entityType) : null,
    entity_id: payload.entityId ? String(payload.entityId) : null,
    run_at: at,
    payload_json: payload,
    status: 'PENDING',
    updated_at: new Date(),
  };

  return prisma.notification_scheduled_jobs.upsert({
    where: { job_key: key },
    create: data,
    update: {
      event_type: data.event_type,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      run_at: data.run_at,
      payload_json: data.payload_json,
      status: 'PENDING',
      processed_at: null,
      updated_at: new Date(),
    },
  });
}

/**
 * Process due PENDING jobs (idempotent via status transition).
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ processed: number, results: any[] }>}
 */
async function processDueJobs(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
  const now = new Date();
  const jobs = await prisma.notification_scheduled_jobs.findMany({
    where: { status: 'PENDING', run_at: { lte: now } },
    orderBy: { run_at: 'asc' },
    take: limit,
  });

  const results = [];
  for (const job of jobs) {
    // Claim job (idempotent)
    const claimed = await prisma.notification_scheduled_jobs.updateMany({
      where: { id: job.id, status: 'PENDING' },
      data: { status: 'PROCESSING', updated_at: new Date() },
    });
    if (!claimed.count) continue;

    try {
      const payload =
        job.payload_json && typeof job.payload_json === 'object'
          ? /** @type {Record<string, unknown>} */ (job.payload_json)
          : {};
      const emitResult = await emitDomainEvent(job.event_type, {
        ...payload,
        entityType: job.entity_type || payload.entityType,
        entityId: job.entity_id || payload.entityId,
      });
      await prisma.notification_scheduled_jobs.update({
        where: { id: job.id },
        data: {
          status: 'PROCESSED',
          processed_at: new Date(),
          updated_at: new Date(),
        },
      });
      results.push({ jobId: job.id, jobKey: job.job_key, ...emitResult });
    } catch (err) {
      await prisma.notification_scheduled_jobs.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          updated_at: new Date(),
        },
      });
      results.push({
        jobId: job.id,
        jobKey: job.job_key,
        error: String(err?.message || err).slice(0, 200),
      });
    }
  }

  return { processed: results.length, results };
}

module.exports = {
  emitDomainEvent,
  scheduleJob,
  processDueJobs,
  invalidateRulesCache,
  loadActiveRulesByEvent,
  pickTemplate,
};
