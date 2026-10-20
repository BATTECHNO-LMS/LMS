'use strict';

/**
 * Deterministic Field Training smart notification rules.
 * Uses rule-state transitions (false→true) + cooldown. No AI.
 * Does not alter scoring.
 */

const { prisma } = require('../../config/db');
const { createNotificationForUser, createNotificationsForUsers } = require('../../shared/services/notification.service');
const hoursMod = require('./fieldTraining.hours');
const { READINESS_STATES } = require('./fieldTraining.readiness');

const RULES = Object.freeze({
  TASK_DUE_SOON: {
    code: 'TASK_DUE_SOON',
    cooldownHours: 24,
    priority: 'HIGH',
  },
  TASK_OVERDUE: {
    code: 'TASK_OVERDUE',
    cooldownHours: 72,
    priority: 'HIGH',
  },
  RECORDED_LECTURE_NOT_STARTED: {
    code: 'RECORDED_LECTURE_NOT_STARTED',
    cooldownHours: 72,
    delayDays: 3,
    priority: 'NORMAL',
  },
  RECORDED_LECTURE_INCOMPLETE: {
    code: 'RECORDED_LECTURE_INCOMPLETE',
    cooldownHours: 72,
    delayDays: 3,
    priority: 'NORMAL',
  },
  HOURS_REMAINING: {
    code: 'HOURS_REMAINING',
    cooldownHours: 168,
    priority: 'NORMAL',
  },
  READY_TO_COMPLETE: {
    code: 'READY_TO_COMPLETE',
    cooldownHours: 24 * 365,
    priority: 'HIGH',
  },
  LOGBOOK_REVIEW_PENDING: {
    code: 'LOGBOOK_REVIEW_PENDING',
    cooldownHours: 12,
    priority: 'HIGH',
  },
});

function daysBetween(from, to = new Date()) {
  if (!from) return null;
  const a = new Date(from).getTime();
  if (Number.isNaN(a)) return null;
  return Math.floor((to.getTime() - a) / (24 * 3600 * 1000));
}

async function getRuleState(ruleCode, applicationId, entityType, entityId, conditionKey = 'default') {
  return prisma.field_training_notification_rule_states.findUnique({
    where: {
      rule_code_application_id_entity_type_entity_id_condition_key: {
        rule_code: ruleCode,
        application_id: applicationId,
        entity_type: entityType,
        entity_id: entityId,
        condition_key: conditionKey,
      },
    },
  });
}

async function upsertRuleState({
  ruleCode,
  applicationId,
  entityType,
  entityId,
  conditionKey = 'default',
  conditionTrue,
  fired,
  metadata,
}) {
  const existing = await getRuleState(ruleCode, applicationId, entityType, entityId, conditionKey);
  const now = new Date();
  if (!existing) {
    return prisma.field_training_notification_rule_states.create({
      data: {
        rule_code: ruleCode,
        application_id: applicationId,
        entity_type: entityType,
        entity_id: entityId,
        condition_key: conditionKey,
        last_condition_true: conditionTrue,
        last_fired_at: fired ? now : null,
        metadata: metadata || undefined,
      },
    });
  }
  return prisma.field_training_notification_rule_states.update({
    where: { id: existing.id },
    data: {
      last_condition_true: conditionTrue,
      last_fired_at: fired ? now : existing.last_fired_at,
      metadata: metadata || existing.metadata || undefined,
      updated_at: now,
    },
  });
}

function withinCooldown(state, cooldownHours) {
  if (!state?.last_fired_at) return false;
  const elapsed = Date.now() - new Date(state.last_fired_at).getTime();
  return elapsed < cooldownHours * 3600 * 1000;
}

/**
 * Fire only on false→true transition (or first time true) and outside cooldown.
 */
async function maybeNotify({
  rule,
  applicationId,
  entityType,
  entityId,
  conditionKey = 'default',
  conditionTrue,
  notifyFn,
  metadata,
}) {
  const state = await getRuleState(rule.code, applicationId, entityType, entityId, conditionKey);
  const wasTrue = Boolean(state?.last_condition_true);
  if (!conditionTrue) {
    if (wasTrue) {
      await upsertRuleState({
        ruleCode: rule.code,
        applicationId,
        entityType,
        entityId,
        conditionKey,
        conditionTrue: false,
        fired: false,
        metadata,
      });
    }
    return { fired: false, reason: 'CONDITION_FALSE' };
  }
  const transition = !wasTrue;
  if (!transition && withinCooldown(state, rule.cooldownHours)) {
    await upsertRuleState({
      ruleCode: rule.code,
      applicationId,
      entityType,
      entityId,
      conditionKey,
      conditionTrue: true,
      fired: false,
      metadata,
    });
    return { fired: false, reason: 'COOLDOWN' };
  }
  if (!transition && state?.last_fired_at) {
    return { fired: false, reason: 'ALREADY_FIRED' };
  }
  await notifyFn();
  await upsertRuleState({
    ruleCode: rule.code,
    applicationId,
    entityType,
    entityId,
    conditionKey,
    conditionTrue: true,
    fired: true,
    metadata,
  });
  return { fired: true };
}

async function evaluateApplicationSmartNotifications(applicationId, options = {}) {
  const app = await prisma.field_training_applications.findUnique({
    where: { id: applicationId },
  });
  if (!app || app.status !== 'approved' || app.training_status === 'expelled') {
    return { fired: 0, results: [] };
  }
  const opp = await prisma.field_training_opportunities.findUnique({
    where: { id: app.opportunity_id },
  });
  if (!opp) return { fired: 0, results: [] };

  const results = [];
  const now = options.now || new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const in24h = new Date(now.getTime() + 24 * 3600 * 1000);

  const tasks = await prisma.field_training_tasks.findMany({
    where: { opportunity_id: opp.id, is_required: true },
    select: { id: true, title: true, due_date: true },
  });
  const submissions = await prisma.field_training_task_submissions.findMany({
    where: { application_id: app.id },
    select: { task_id: true },
  });
  const submitted = new Set(submissions.map((s) => s.task_id));

  for (const task of tasks) {
    if (submitted.has(task.id) || !task.due_date) continue;
    const due = new Date(task.due_date);
    const dueSoon = due >= startOfToday && due <= in24h;
    const overdue = due < startOfToday;

    if (dueSoon) {
      results.push(
        await maybeNotify({
          rule: RULES.TASK_DUE_SOON,
          applicationId: app.id,
          entityType: 'task',
          entityId: task.id,
          conditionTrue: true,
          notifyFn: () =>
            createNotificationForUser({
              userId: app.student_id,
              title: 'موعد تسليم مهمة قريب',
              body: `يتبقى أقل من 24 ساعة لتسليم المهمة "${task.title}".`,
              type: 'warning',
              actionUrl: `/student/field-training/${opp.id}?tab=tasks`,
              dedupeByActionUrl: true,
            }),
        })
      );
    }
    if (overdue) {
      results.push(
        await maybeNotify({
          rule: RULES.TASK_OVERDUE,
          applicationId: app.id,
          entityType: 'task',
          entityId: task.id,
          conditionTrue: true,
          notifyFn: () =>
            createNotificationForUser({
              userId: app.student_id,
              title: 'مهمة متأخرة',
              body: `تجاوزت المهمة "${task.title}" موعد التسليم. أكمل التسليم في أقرب وقت.`,
              type: 'warning',
              actionUrl: `/student/field-training/${opp.id}?tab=tasks`,
              dedupeByActionUrl: true,
            }),
        })
      );
    }
  }

  const lectures = await prisma.field_training_recorded_lectures.findMany({
    where: { opportunity_id: opp.id, status: 'published' },
    select: { id: true, title: true, published_at: true, created_at: true },
  });
  const progress = await prisma.field_training_recorded_lecture_progress.findMany({
    where: { application_id: app.id },
  });
  const progressByLecture = new Map(progress.map((p) => [p.lecture_id, p]));
  const delayDays = RULES.RECORDED_LECTURE_NOT_STARTED.delayDays;

  for (const lecture of lectures) {
    const p = progressByLecture.get(lecture.id);
    const available = lecture.published_at || lecture.created_at;
    const age = daysBetween(available, now);
    if (age == null || age < delayDays) continue;
    const pct = p?.progress_percentage != null ? Number(p.progress_percentage) : 0;
    const completed = Boolean(p?.completed_at);
    if (!completed && pct <= 0) {
      results.push(
        await maybeNotify({
          rule: RULES.RECORDED_LECTURE_NOT_STARTED,
          applicationId: app.id,
          entityType: 'recorded_lecture',
          entityId: lecture.id,
          conditionTrue: true,
          notifyFn: () =>
            createNotificationForUser({
              userId: app.student_id,
              title: 'محاضرة مسجلة بانتظارك',
              body: `لم تبدأ بعد محاضرة "${lecture.title}". أكملها لإتمام متطلبات الجلسة.`,
              type: 'info',
              actionUrl: `/student/field-training/${opp.id}?tab=recorded_lectures`,
              dedupeByActionUrl: true,
            }),
        })
      );
    } else if (!completed && pct > 0 && pct < 100) {
      results.push(
        await maybeNotify({
          rule: RULES.RECORDED_LECTURE_INCOMPLETE,
          applicationId: app.id,
          entityType: 'recorded_lecture',
          entityId: lecture.id,
          conditionTrue: true,
          notifyFn: () =>
            createNotificationForUser({
              userId: app.student_id,
              title: 'أكمل المحاضرة المسجلة',
              body: `أكمل المحاضرة المسجلة لإتمام متطلبات الجلسة (${Math.round(pct)}%).`,
              type: 'info',
              actionUrl: `/student/field-training/${opp.id}/recorded-lectures/${lecture.id}`,
              dedupeByActionUrl: true,
            }),
        })
      );
    }
  }

  const hours = await hoursMod.calculateHoursProgressForApplication(
    app.id,
    opp.required_training_hours
  );
  const required = hours?.required_training_hours;
  const completed = hours?.completed_training_hours ?? 0;
  if (required != null && required > 0 && completed < required) {
    const remaining = Math.round((required - completed) * 100) / 100;
    if (remaining > 0 && remaining <= Math.max(10, required * 0.2)) {
      results.push(
        await maybeNotify({
          rule: RULES.HOURS_REMAINING,
          applicationId: app.id,
          entityType: 'application',
          entityId: app.id,
          conditionKey: `remaining:${Math.ceil(remaining)}`,
          conditionTrue: true,
          notifyFn: () =>
            createNotificationForUser({
              userId: app.student_id,
              title: 'ساعات تدريب متبقية',
              body: `تبقى لك ${remaining} ساعة تدريب لإكمال المتطلب.`,
              type: 'info',
              actionUrl: `/student/field-training/${opp.id}?tab=overview`,
              dedupeByActionUrl: true,
            }),
          metadata: { remaining, required, completed },
        })
      );
    }
  }

  if (options.readinessState === READINESS_STATES.READY) {
    results.push(
      await maybeNotify({
        rule: RULES.READY_TO_COMPLETE,
        applicationId: app.id,
        entityType: 'application',
        entityId: app.id,
        conditionTrue: true,
        notifyFn: () =>
          createNotificationForUser({
            userId: app.student_id,
            title: 'مستوفٍ لمتطلبات الإكمال',
            body: 'أصبحت مستوفيًا لمتطلبات إكمال التدريب.',
            type: 'success',
            actionUrl: `/student/field-training/${opp.id}?tab=completion`,
            dedupeByActionUrl: true,
          }),
      })
    );
  }

  return {
    fired: results.filter((r) => r.fired).length,
    results,
  };
}

/**
 * Evaluate a page of approved applications for an opportunity (scheduled job).
 */
async function evaluateOpportunitySmartNotifications(opportunityId, { limit = 50 } = {}) {
  const apps = await prisma.field_training_applications.findMany({
    where: {
      opportunity_id: opportunityId,
      status: 'approved',
      training_status: { notIn: ['expelled', 'completed'] },
    },
    select: { id: true },
    take: limit,
    orderBy: { updated_at: 'asc' },
  });
  let fired = 0;
  for (const app of apps) {
    const result = await evaluateApplicationSmartNotifications(app.id);
    fired += result.fired;
  }
  return { applications: apps.length, fired };
}

module.exports = {
  RULES,
  maybeNotify,
  evaluateApplicationSmartNotifications,
  evaluateOpportunitySmartNotifications,
  getRuleState,
  upsertRuleState,
};
