'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { isSystemWideAdmin } = require('../../utils/universityScope');
const {
  assertContentAdmin,
  sanitizeHtml,
  sanitizeCtaUrl,
  assertTargetUniversityInScope,
  primaryRole,
  nowUtc,
  CONTENT_ADMIN_FORBIDDEN_MSG,
  OFFICIAL_ROLES,
} = require('../contentCms/contentCms.shared');

const OFFICIAL_ROLE_SET = new Set(OFFICIAL_ROLES);

const INCLUDE_RELATIONS = {
  announcement_targets: { orderBy: { created_at: 'asc' } },
  announcement_channels: { orderBy: { created_at: 'asc' } },
};

const OPTIMISTIC_LOCK_MSG =
  'تم تعديل هذا المحتوى بواسطة مستخدم آخر. راجع آخر نسخة قبل الحفظ.';

function mapTarget(row) {
  return {
    id: row.id,
    target_type: row.target_type,
    role_code: row.role_code,
    university_id: row.university_id,
    specialization_id: row.specialization_id,
    opportunity_id: row.opportunity_id,
    session_id: row.session_id,
    user_id: row.user_id,
    account_status: row.account_status,
    application_status: row.application_status,
    activation_status: row.activation_status,
    onboarding_status: row.onboarding_status,
    progress_min: row.progress_min,
    progress_max: row.progress_max,
    certificate_status: row.certificate_status,
    created_at: row.created_at,
  };
}

function mapChannel(row) {
  return {
    id: row.id,
    channel_code: row.channel_code,
    is_enabled: row.is_enabled,
    created_at: row.created_at,
  };
}

function mapAnnouncement(row, { state = null } = {}) {
  const base = {
    id: row.id,
    admin_name: row.admin_name,
    title_ar: row.title_ar,
    summary_ar: row.summary_ar,
    content_ar: row.content_ar,
    icon: row.icon,
    image_url: row.image_url,
    announcement_type: row.announcement_type,
    priority: row.priority,
    status: row.status,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    timezone: row.timezone,
    is_dismissible: row.is_dismissible,
    requires_acknowledgement: row.requires_acknowledgement,
    blocks_usage: row.blocks_usage,
    is_pinned: row.is_pinned,
    max_impressions: row.max_impressions,
    cta_label: row.cta_label,
    cta_url: row.cta_url,
    trigger_event: row.trigger_event,
    version: row.version,
    created_by_id: row.created_by_id,
    updated_by_id: row.updated_by_id,
    published_by_id: row.published_by_id,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    targets: (row.announcement_targets || []).map(mapTarget),
    channels: (row.announcement_channels || []).map(mapChannel),
  };
  if (state) {
    base.user_state = {
      first_seen_at: state.first_seen_at,
      last_seen_at: state.last_seen_at,
      dismissed_at: state.dismissed_at,
      acknowledged_at: state.acknowledged_at,
      clicked_at: state.clicked_at,
      view_count: state.view_count,
      announcement_version: state.announcement_version,
      channel_code: state.channel_code,
    };
  }
  return base;
}

function assertOptimisticLock(row, body) {
  if (body?.version != null && Number(body.version) !== Number(row.version)) {
    throw new ApiError(409, OPTIMISTIC_LOCK_MSG, null, 'CONTENT_VERSION_CONFLICT');
  }
  if (body?.updated_at != null) {
    const expected = new Date(body.updated_at).getTime();
    const actual = new Date(row.updated_at).getTime();
    if (!Number.isNaN(expected) && expected !== actual) {
      throw new ApiError(409, OPTIMISTIC_LOCK_MSG, null, 'CONTENT_UPDATED_AT_CONFLICT');
    }
  }
}

function sanitizeContentFields(body) {
  const out = { ...body };
  if (out.content_ar != null) out.content_ar = sanitizeHtml(out.content_ar);
  if (out.summary_ar != null) out.summary_ar = sanitizeHtml(out.summary_ar);
  if (Object.prototype.hasOwnProperty.call(out, 'cta_url')) {
    out.cta_url = sanitizeCtaUrl(out.cta_url);
  }
  if (Object.prototype.hasOwnProperty.call(out, 'image_url') && out.image_url != null) {
    out.image_url = sanitizeCtaUrl(out.image_url);
  }
  return out;
}

/**
 * AND across target rows: every row must match.
 * Non-global admins get an implicit UNIVERSITY row when none constrains university.
 */
function ensureScopedTargets(user, targets) {
  const list = Array.isArray(targets) ? [...targets] : [];
  if (isSystemWideAdmin(user)) return list;

  const uni = user.universityId;
  if (!uni) {
    throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
  }

  const hasUniversityConstraint = list.some(
    (t) =>
      t.target_type === 'UNIVERSITY' ||
      (t.university_id != null && t.university_id !== '')
  );
  if (!hasUniversityConstraint) {
    list.push({ target_type: 'UNIVERSITY', university_id: uni });
  }
  return list;
}

async function validateTargetsInScope(user, targets) {
  for (const t of targets) {
    if (t.university_id) {
      assertTargetUniversityInScope(user, t.university_id);
    }
    if (t.role_code && !OFFICIAL_ROLE_SET.has(t.role_code)) {
      throw new ApiError(400, `دور غير معتمد: ${t.role_code}`, null, 'INVALID_ROLE');
    }
    if (t.target_type === 'OPPORTUNITY' && t.opportunity_id) {
      const opp = await prisma.field_training_opportunities.findUnique({
        where: { id: t.opportunity_id },
        select: { id: true, university_id: true },
      });
      if (!opp) throw new ApiError(400, 'الفرصة المستهدفة غير موجودة', null, 'INVALID_OPPORTUNITY');
      if (opp.university_id) assertTargetUniversityInScope(user, opp.university_id);
    }
    if (t.target_type === 'SESSION' && t.session_id) {
      const session = await prisma.field_training_sessions.findUnique({
        where: { id: t.session_id },
        select: {
          id: true,
          field_training_opportunities: { select: { university_id: true } },
        },
      });
      if (!session) throw new ApiError(400, 'الجلسة المستهدفة غير موجودة', null, 'INVALID_SESSION');
      const uniId = session.field_training_opportunities?.university_id;
      if (uniId) assertTargetUniversityInScope(user, uniId);
    }
    if (t.target_type === 'USER' && t.user_id) {
      const u = await prisma.users.findUnique({
        where: { id: t.user_id },
        select: { id: true, primary_university_id: true },
      });
      if (!u) throw new ApiError(400, 'المستخدم المستهدف غير موجود', null, 'INVALID_USER');
      if (u.primary_university_id) {
        assertTargetUniversityInScope(user, u.primary_university_id);
      } else if (!isSystemWideAdmin(user)) {
        throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
      }
    }
    if (t.target_type === 'SPECIALTY' && t.specialization_id && !isSystemWideAdmin(user)) {
      const uniSpec = await prisma.university_specialties.findFirst({
        where: {
          OR: [{ id: t.specialization_id }, { specialty_id: t.specialization_id }],
          university_id: user.universityId || undefined,
        },
        select: { id: true },
      });
      if (!uniSpec && user.universityId) {
        throw new ApiError(403, 'لا يمكن استهداف تخصص خارج نطاق جامعتك', null, 'SPECIALTY_OUT_OF_SCOPE');
      }
    }
  }
}

function targetsCreateData(targets) {
  return targets.map((t) => ({
    target_type: t.target_type,
    role_code: t.role_code || null,
    university_id: t.university_id || null,
    specialization_id: t.specialization_id || null,
    opportunity_id: t.opportunity_id || null,
    session_id: t.session_id || null,
    user_id: t.user_id || null,
    account_status: t.account_status || null,
    application_status: t.application_status || null,
    activation_status: t.activation_status || null,
    onboarding_status: t.onboarding_status || null,
    progress_min: t.progress_min ?? null,
    progress_max: t.progress_max ?? null,
    certificate_status: t.certificate_status || null,
  }));
}

function channelsCreateData(channels) {
  const seen = new Set();
  const out = [];
  for (const c of channels || []) {
    if (seen.has(c.channel_code)) continue;
    seen.add(c.channel_code);
    out.push({
      channel_code: c.channel_code,
      is_enabled: c.is_enabled !== false,
    });
  }
  return out;
}

function adminListWhere(user, query = {}) {
  const where = {};
  if (query.status) where.status = query.status;
  if (query.q) {
    where.OR = [
      { admin_name: { contains: query.q, mode: 'insensitive' } },
      { title_ar: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  if (!isSystemWideAdmin(user)) {
    const uni = user.universityId;
    if (!uni) {
      throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
    }
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { created_by_id: user.userId },
          { announcement_targets: { some: { university_id: uni } } },
        ],
      },
    ];
  }
  return where;
}

async function getAnnouncementOrThrow(id) {
  const row = await prisma.announcements.findUnique({
    where: { id },
    include: INCLUDE_RELATIONS,
  });
  if (!row) throw new ApiError(404, 'الإعلان غير موجود', null, 'ANNOUNCEMENT_NOT_FOUND');
  return row;
}

function assertAdminCanAccessAnnouncement(user, row) {
  if (isSystemWideAdmin(user)) return;
  const uni = user.universityId;
  if (!uni) {
    throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
  }
  if (row.created_by_id && row.created_by_id === user.userId) return;
  const hit = (row.announcement_targets || []).some((t) => t.university_id === uni);
  if (!hit) {
    throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
  }
}

async function maybeExpireAnnouncement(row, now = nowUtc()) {
  if (!row?.ends_at) return row;
  if (row.ends_at.getTime() > now.getTime()) return row;
  if (!['PUBLISHED', 'SCHEDULED', 'PAUSED'].includes(row.status)) return row;
  return prisma.announcements.update({
    where: { id: row.id },
    data: { status: 'EXPIRED', updated_at: now },
    include: INCLUDE_RELATIONS,
  });
}

async function maybeActivateScheduled(row, now = nowUtc()) {
  if (row.status !== 'SCHEDULED') return row;
  if (row.starts_at && row.starts_at.getTime() > now.getTime()) return row;
  if (row.ends_at && row.ends_at.getTime() <= now.getTime()) {
    return maybeExpireAnnouncement(row, now);
  }
  return prisma.announcements.update({
    where: { id: row.id },
    data: {
      status: 'PUBLISHED',
      published_at: row.published_at || now,
      updated_at: now,
    },
    include: INCLUDE_RELATIONS,
  });
}

async function loadUserAudienceContext(user) {
  const dbUser = await prisma.users.findUnique({
    where: { id: user.userId },
    select: {
      id: true,
      status: true,
      primary_university_id: true,
      specialty_id: true,
      university_specialty_id: true,
    },
  });
  if (!dbUser) {
    throw new ApiError(401, 'المستخدم غير موجود', null, 'USER_NOT_FOUND');
  }

  const apps = await prisma.field_training_applications.findMany({
    where: { student_id: user.userId },
    select: { opportunity_id: true, status: true },
  });

  const sessionIds = new Set();
  if (apps.length) {
    const oppIds = [...new Set(apps.map((a) => a.opportunity_id))];
    const sessions = await prisma.field_training_sessions.findMany({
      where: { opportunity_id: { in: oppIds } },
      select: { id: true },
      take: 500,
    });
    sessions.forEach((s) => sessionIds.add(s.id));
  }

  const instructed = await prisma.field_training_opportunities.findMany({
    where: { assigned_instructor_id: user.userId },
    select: { id: true },
    take: 200,
  });

  return {
    userId: dbUser.id,
    status: dbUser.status,
    universityId: dbUser.primary_university_id || user.universityId || null,
    specialtyId: dbUser.specialty_id,
    universitySpecialtyId: dbUser.university_specialty_id,
    roles: user.roles || [],
    primaryRole: primaryRole(user),
    opportunityIds: new Set([
      ...apps.map((a) => a.opportunity_id),
      ...instructed.map((o) => o.id),
    ]),
    applicationStatuses: new Set(apps.map((a) => String(a.status))),
    sessionIds,
    activationStatus: null,
    onboardingStatus: null,
    progressPercent: null,
    certificateStatus: null,
  };
}

function targetRowMatches(ctx, target) {
  switch (target.target_type) {
    case 'ALL_USERS':
      return true;
    case 'ROLE': {
      const code = String(target.role_code || '').toLowerCase();
      if (!code) return false;
      const roles = (ctx.roles || []).map((r) => String(r).toLowerCase());
      return roles.includes(code) || ctx.primaryRole === code;
    }
    case 'UNIVERSITY':
      return Boolean(target.university_id) && ctx.universityId === target.university_id;
    case 'SPECIALTY':
      return (
        Boolean(target.specialization_id) &&
        (ctx.specialtyId === target.specialization_id ||
          ctx.universitySpecialtyId === target.specialization_id)
      );
    case 'OPPORTUNITY':
      return Boolean(target.opportunity_id) && ctx.opportunityIds.has(target.opportunity_id);
    case 'SESSION':
      return Boolean(target.session_id) && ctx.sessionIds.has(target.session_id);
    case 'USER':
      return Boolean(target.user_id) && ctx.userId === target.user_id;
    case 'ACCOUNT_STATUS':
      return Boolean(target.account_status) && ctx.status === target.account_status;
    case 'APPLICATION_STATUS':
      return (
        Boolean(target.application_status) &&
        ctx.applicationStatuses.has(String(target.application_status))
      );
    case 'ACTIVATION_STATUS':
      return (
        Boolean(target.activation_status) &&
        ctx.activationStatus != null &&
        String(ctx.activationStatus) === String(target.activation_status)
      );
    case 'ONBOARDING_STATUS':
      return (
        Boolean(target.onboarding_status) &&
        ctx.onboardingStatus != null &&
        String(ctx.onboardingStatus) === String(target.onboarding_status)
      );
    case 'PROGRESS_RANGE': {
      if (ctx.progressPercent == null) return false;
      const min = target.progress_min == null ? 0 : Number(target.progress_min);
      const max = target.progress_max == null ? 100 : Number(target.progress_max);
      const value = Number(ctx.progressPercent);
      return value >= min && value <= max;
    }
    case 'CERTIFICATE_STATUS':
      return (
        Boolean(target.certificate_status) &&
        ctx.certificateStatus != null &&
        String(ctx.certificateStatus) === String(target.certificate_status)
      );
    default:
      return false;
  }
}

/** AND across all target rows. Empty targets → not eligible. */
function announcementMatchesAudience(announcement, ctx) {
  const targets = announcement.announcement_targets || [];
  if (!targets.length) return false;
  return targets.every((t) => targetRowMatches(ctx, t));
}

function isWithinSchedule(announcement, now) {
  if (announcement.starts_at && announcement.starts_at.getTime() > now.getTime()) return false;
  if (announcement.ends_at && announcement.ends_at.getTime() <= now.getTime()) return false;
  return true;
}

function shouldShowToUser(announcement, state, now) {
  if (announcement.status !== 'PUBLISHED') return false;
  if (!isWithinSchedule(announcement, now)) return false;

  if (announcement.requires_acknowledgement) {
    if (state?.acknowledged_at) return false;
    return true;
  }

  if (announcement.is_dismissible !== false && state?.dismissed_at) {
    if (
      state.announcement_version != null &&
      Number(state.announcement_version) >= Number(announcement.version)
    ) {
      return false;
    }
  }

  if (
    announcement.max_impressions != null &&
    state?.view_count != null &&
    state.view_count >= announcement.max_impressions
  ) {
    return false;
  }

  return true;
}

async function audit(user, actionType, entityId, oldValues, newValues) {
  await recordAudit({
    userId: user.userId,
    universityId: user.universityId || null,
    actionType,
    entityType: 'announcement',
    entityId,
    oldValues: oldValues || null,
    newValues: newValues || null,
  });
}

async function listAdmin(user, query = {}) {
  assertContentAdmin(user);
  const where = adminListWhere(user, query);
  const [total, rows] = await Promise.all([
    prisma.announcements.count({ where }),
    prisma.announcements.findMany({
      where,
      include: INCLUDE_RELATIONS,
      orderBy: [{ priority: 'asc' }, { updated_at: 'desc' }],
      skip: query.skip || 0,
      take: query.take || 20,
    }),
  ]);

  const now = nowUtc();
  const mapped = [];
  for (let row of rows) {
    row = await maybeExpireAnnouncement(row, now);
    row = await maybeActivateScheduled(row, now);
    mapped.push(mapAnnouncement(row));
  }

  return {
    items: mapped,
    pagination: {
      page: query.page || 1,
      page_size: query.page_size || 20,
      total,
    },
  };
}

async function createAnnouncement(user, body) {
  assertContentAdmin(user);
  const clean = sanitizeContentFields(body);
  let targets = ensureScopedTargets(user, clean.targets);
  await validateTargetsInScope(user, targets);
  const channels = channelsCreateData(clean.channels);

  const now = nowUtc();
  const row = await prisma.announcements.create({
    data: {
      admin_name: clean.admin_name,
      title_ar: clean.title_ar,
      summary_ar: clean.summary_ar || null,
      content_ar: clean.content_ar,
      icon: clean.icon || null,
      image_url: clean.image_url || null,
      announcement_type: clean.announcement_type || 'INFORMATION',
      priority: clean.priority ?? 100,
      status: 'DRAFT',
      starts_at: clean.starts_at || null,
      ends_at: clean.ends_at || null,
      timezone: clean.timezone || 'Asia/Amman',
      is_dismissible: clean.is_dismissible !== false,
      requires_acknowledgement: Boolean(clean.requires_acknowledgement),
      blocks_usage: Boolean(clean.blocks_usage),
      is_pinned: Boolean(clean.is_pinned),
      max_impressions: clean.max_impressions ?? null,
      cta_label: clean.cta_label || null,
      cta_url: clean.cta_url || null,
      trigger_event: clean.trigger_event || null,
      version: 1,
      created_by_id: user.userId,
      updated_by_id: user.userId,
      created_at: now,
      updated_at: now,
      announcement_targets: { create: targetsCreateData(targets) },
      announcement_channels: { create: channels },
    },
    include: INCLUDE_RELATIONS,
  });

  await audit(user, 'announcement.create', row.id, null, {
    admin_name: row.admin_name,
    status: row.status,
    targets_count: targets.length,
    channels: channels.map((c) => c.channel_code),
  });

  return mapAnnouncement(row);
}

async function updateAnnouncement(user, id, body) {
  assertContentAdmin(user);
  let row = await getAnnouncementOrThrow(id);
  assertAdminCanAccessAnnouncement(user, row);
  assertOptimisticLock(row, body);

  const clean = sanitizeContentFields(body);
  const data = {
    updated_by_id: user.userId,
    updated_at: nowUtc(),
    version: { increment: 1 },
  };

  const scalarKeys = [
    'admin_name',
    'title_ar',
    'summary_ar',
    'content_ar',
    'icon',
    'image_url',
    'announcement_type',
    'priority',
    'starts_at',
    'ends_at',
    'timezone',
    'is_dismissible',
    'requires_acknowledgement',
    'blocks_usage',
    'is_pinned',
    'max_impressions',
    'cta_label',
    'cta_url',
    'trigger_event',
  ];
  for (const key of scalarKeys) {
    if (Object.prototype.hasOwnProperty.call(clean, key)) {
      data[key] = clean[key];
    }
  }

  let targets;
  if (clean.targets) {
    targets = ensureScopedTargets(user, clean.targets);
    await validateTargetsInScope(user, targets);
  }
  let channels;
  if (clean.channels) {
    channels = channelsCreateData(clean.channels);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (targets) {
      await tx.announcement_targets.deleteMany({ where: { announcement_id: id } });
      await tx.announcement_targets.createMany({
        data: targetsCreateData(targets).map((t) => ({ ...t, announcement_id: id })),
      });
    }
    if (channels) {
      await tx.announcement_channels.deleteMany({ where: { announcement_id: id } });
      await tx.announcement_channels.createMany({
        data: channels.map((c) => ({ ...c, announcement_id: id })),
      });
    }
    return tx.announcements.update({
      where: { id },
      data,
      include: INCLUDE_RELATIONS,
    });
  });

  await audit(
    user,
    targets ? 'announcement.update_audience' : 'announcement.update',
    id,
    { version: row.version, status: row.status },
    {
      version: updated.version,
      status: updated.status,
      targets_changed: Boolean(targets),
      channels_changed: Boolean(channels),
    }
  );

  return mapAnnouncement(updated);
}

async function maybeSendInAppNotifications(announcement) {
  const channels = announcement.announcement_channels || [];
  const enabled = channels.some(
    (c) => c.channel_code === 'IN_APP_NOTIFICATION' && c.is_enabled !== false
  );
  if (!enabled) return;

  try {
    const notificationService = require('../../shared/services/notification.service');
    const targets = announcement.announcement_targets || [];
    const roleTargets = targets.filter((t) => t.target_type === 'ROLE' && t.role_code);
    const uniTarget = targets.find((t) => t.target_type === 'UNIVERSITY' && t.university_id);
    const userTargets = targets.filter((t) => t.target_type === 'USER' && t.user_id);
    const allUsers = targets.some((t) => t.target_type === 'ALL_USERS');

    let userIds = [];
    if (userTargets.length && targets.every((t) => t.target_type === 'USER')) {
      userIds = userTargets.map((t) => t.user_id);
    } else if (roleTargets.length === 1 && targets.length <= 2) {
      const universityId = uniTarget?.university_id || undefined;
      userIds = await notificationService.userIdsByRoleCodes([roleTargets[0].role_code], {
        universityId,
      });
    } else if (allUsers && uniTarget && targets.length <= 2) {
      const users = await prisma.users.findMany({
        where: { primary_university_id: uniTarget.university_id, status: 'active' },
        select: { id: true },
        take: 2000,
      });
      userIds = users.map((u) => u.id);
    } else {
      return;
    }

    if (!userIds.length) return;

    await notificationService.createNotificationsForUsers({
      userIds,
      title: announcement.title_ar,
      body: announcement.summary_ar || announcement.title_ar,
      type: 'info',
      actionUrl: announcement.cta_url || null,
      dedupeWindowHours: 12,
    });
  } catch (_err) {
    // Optional channel — never fail publish.
  }
}

async function publishAnnouncement(user, id, body = {}) {
  assertContentAdmin(user);
  let row = await getAnnouncementOrThrow(id);
  assertAdminCanAccessAnnouncement(user, row);
  assertOptimisticLock(row, body);

  const now = nowUtc();
  row = await maybeExpireAnnouncement(row, now);
  if (row.status === 'EXPIRED') {
    throw new ApiError(400, 'انتهت صلاحية هذا الإعلان ولا يمكن نشره', null, 'ANNOUNCEMENT_EXPIRED');
  }
  if (row.status === 'ARCHIVED') {
    throw new ApiError(400, 'لا يمكن نشر إعلان مؤرشف', null, 'ANNOUNCEMENT_ARCHIVED');
  }

  let nextStatus = 'PUBLISHED';
  if (row.starts_at && row.starts_at.getTime() > now.getTime()) {
    nextStatus = 'SCHEDULED';
  }

  const updated = await prisma.announcements.update({
    where: { id },
    data: {
      status: nextStatus,
      published_at: now,
      published_by_id: user.userId,
      updated_by_id: user.userId,
      updated_at: now,
      version: { increment: 1 },
    },
    include: INCLUDE_RELATIONS,
  });

  if (nextStatus === 'PUBLISHED') {
    await maybeSendInAppNotifications(updated);
  }

  await audit(user, 'announcement.publish', id, { status: row.status }, { status: nextStatus });
  return mapAnnouncement(updated);
}

async function scheduleAnnouncement(user, id, body) {
  assertContentAdmin(user);
  const row = await getAnnouncementOrThrow(id);
  assertAdminCanAccessAnnouncement(user, row);
  assertOptimisticLock(row, body);

  if (!body.starts_at) {
    throw new ApiError(400, 'يرجى تحديد تاريخ بداية العرض', null, 'STARTS_AT_REQUIRED');
  }
  if (body.ends_at && body.ends_at.getTime() <= body.starts_at.getTime()) {
    throw new ApiError(400, 'يجب أن يكون تاريخ النهاية بعد تاريخ البداية', null, 'INVALID_SCHEDULE');
  }

  const now = nowUtc();
  const updated = await prisma.announcements.update({
    where: { id },
    data: {
      status: 'SCHEDULED',
      starts_at: body.starts_at,
      ends_at: body.ends_at ?? row.ends_at,
      timezone: body.timezone || row.timezone || 'Asia/Amman',
      updated_by_id: user.userId,
      updated_at: now,
      version: { increment: 1 },
    },
    include: INCLUDE_RELATIONS,
  });

  await audit(
    user,
    'announcement.schedule',
    id,
    { status: row.status, starts_at: row.starts_at, ends_at: row.ends_at },
    { status: 'SCHEDULED', starts_at: updated.starts_at, ends_at: updated.ends_at }
  );
  return mapAnnouncement(updated);
}

async function pauseAnnouncement(user, id, body = {}) {
  assertContentAdmin(user);
  const row = await getAnnouncementOrThrow(id);
  assertAdminCanAccessAnnouncement(user, row);
  assertOptimisticLock(row, body);

  if (!['PUBLISHED', 'SCHEDULED'].includes(row.status)) {
    throw new ApiError(400, 'يمكن إيقاف الإعلانات المنشورة أو المجدولة فقط', null, 'INVALID_STATUS');
  }

  const now = nowUtc();
  const updated = await prisma.announcements.update({
    where: { id },
    data: {
      status: 'PAUSED',
      updated_by_id: user.userId,
      updated_at: now,
      version: { increment: 1 },
    },
    include: INCLUDE_RELATIONS,
  });

  await audit(user, 'announcement.pause', id, { status: row.status }, { status: 'PAUSED' });
  return mapAnnouncement(updated);
}

async function archiveAnnouncement(user, id, body = {}) {
  assertContentAdmin(user);
  const row = await getAnnouncementOrThrow(id);
  assertAdminCanAccessAnnouncement(user, row);
  assertOptimisticLock(row, body);

  const now = nowUtc();
  const updated = await prisma.announcements.update({
    where: { id },
    data: {
      status: 'ARCHIVED',
      updated_by_id: user.userId,
      updated_at: now,
      version: { increment: 1 },
    },
    include: INCLUDE_RELATIONS,
  });

  await audit(user, 'announcement.archive', id, { status: row.status }, { status: 'ARCHIVED' });
  return mapAnnouncement(updated);
}

async function duplicateAnnouncement(user, id) {
  assertContentAdmin(user);
  const row = await getAnnouncementOrThrow(id);
  assertAdminCanAccessAnnouncement(user, row);

  let targets = (row.announcement_targets || []).map((t) => ({
    target_type: t.target_type,
    role_code: t.role_code,
    university_id: t.university_id,
    specialization_id: t.specialization_id,
    opportunity_id: t.opportunity_id,
    session_id: t.session_id,
    user_id: t.user_id,
    account_status: t.account_status,
    application_status: t.application_status,
    activation_status: t.activation_status,
    onboarding_status: t.onboarding_status,
    progress_min: t.progress_min,
    progress_max: t.progress_max,
    certificate_status: t.certificate_status,
  }));
  targets = ensureScopedTargets(user, targets);
  await validateTargetsInScope(user, targets);

  const channels = (row.announcement_channels || []).map((c) => ({
    channel_code: c.channel_code,
    is_enabled: c.is_enabled,
  }));

  const now = nowUtc();
  const copy = await prisma.announcements.create({
    data: {
      admin_name: `${row.admin_name} (نسخة)`.slice(0, 255),
      title_ar: row.title_ar,
      summary_ar: row.summary_ar,
      content_ar: row.content_ar,
      icon: row.icon,
      image_url: row.image_url,
      announcement_type: row.announcement_type,
      priority: row.priority,
      status: 'DRAFT',
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      timezone: row.timezone,
      is_dismissible: row.is_dismissible,
      requires_acknowledgement: row.requires_acknowledgement,
      blocks_usage: row.blocks_usage,
      is_pinned: row.is_pinned,
      max_impressions: row.max_impressions,
      cta_label: row.cta_label,
      cta_url: row.cta_url,
      trigger_event: row.trigger_event,
      version: 1,
      created_by_id: user.userId,
      updated_by_id: user.userId,
      created_at: now,
      updated_at: now,
      announcement_targets: { create: targetsCreateData(targets) },
      announcement_channels: { create: channelsCreateData(channels) },
    },
    include: INCLUDE_RELATIONS,
  });

  await audit(user, 'announcement.duplicate', copy.id, { source_id: id }, { status: 'DRAFT' });
  return mapAnnouncement(copy);
}

async function getAnalytics(user, id) {
  assertContentAdmin(user);
  const row = await getAnnouncementOrThrow(id);
  assertAdminCanAccessAnnouncement(user, row);

  const states = await prisma.announcement_user_states.findMany({
    where: { announcement_id: id },
    select: {
      user_id: true,
      first_seen_at: true,
      view_count: true,
      dismissed_at: true,
      acknowledged_at: true,
      clicked_at: true,
    },
  });

  const reached = states.filter((s) => s.first_seen_at || s.view_count > 0).length;
  const views = states.reduce((sum, s) => sum + (s.view_count || 0), 0);
  const dismissed = states.filter((s) => s.dismissed_at).length;
  const acknowledged = states.filter((s) => s.acknowledged_at).length;
  const clicked = states.filter((s) => s.clicked_at).length;

  return {
    announcement_id: id,
    version: row.version,
    status: row.status,
    reached_users: reached,
    total_views: views,
    dismissed_count: dismissed,
    acknowledged_count: acknowledged,
    clicked_count: clicked,
    acknowledgement_rate: reached > 0 ? Number((acknowledged / reached).toFixed(4)) : 0,
    click_rate: reached > 0 ? Number((clicked / reached).toFixed(4)) : 0,
    dismiss_rate: reached > 0 ? Number((dismissed / reached).toFixed(4)) : 0,
  };
}

async function listActiveForUser(user) {
  const now = nowUtc();
  const ctx = await loadUserAudienceContext(user);

  const candidates = await prisma.announcements.findMany({
    where: {
      status: { in: ['PUBLISHED', 'SCHEDULED'] },
      OR: [{ starts_at: null }, { starts_at: { lte: now } }],
      AND: [{ OR: [{ ends_at: null }, { ends_at: { gt: now } }] }],
    },
    include: INCLUDE_RELATIONS,
    orderBy: [{ is_pinned: 'desc' }, { priority: 'asc' }, { published_at: 'desc' }],
    take: 100,
  });

  const ids = candidates.map((c) => c.id);
  const states = ids.length
    ? await prisma.announcement_user_states.findMany({
        where: { announcement_id: { in: ids }, user_id: user.userId },
      })
    : [];
  const stateById = new Map(states.map((s) => [s.announcement_id, s]));

  const active = [];
  for (let row of candidates) {
    row = await maybeExpireAnnouncement(row, now);
    row = await maybeActivateScheduled(row, now);
    if (row.status !== 'PUBLISHED') continue;
    if (!announcementMatchesAudience(row, ctx)) continue;
    const state = stateById.get(row.id) || null;
    if (!shouldShowToUser(row, state, now)) continue;
    active.push(mapAnnouncement(row, { state }));
  }

  return { items: active };
}

async function upsertUserState(userId, announcement, patch) {
  const existing = await prisma.announcement_user_states.findUnique({
    where: {
      announcement_id_user_id: {
        announcement_id: announcement.id,
        user_id: userId,
      },
    },
  });

  const now = nowUtc();
  if (!existing) {
    return prisma.announcement_user_states.create({
      data: {
        announcement_id: announcement.id,
        user_id: userId,
        announcement_version: announcement.version,
        first_seen_at: patch.first_seen_at || now,
        last_seen_at: patch.last_seen_at || now,
        view_count: patch.view_count_inc ? 1 : 0,
        dismissed_at: patch.dismissed_at || null,
        acknowledged_at: patch.acknowledged_at || null,
        clicked_at: patch.clicked_at || null,
        channel_code: patch.channel_code || null,
        created_at: now,
        updated_at: now,
      },
    });
  }

  const data = {
    updated_at: now,
    announcement_version: announcement.version,
  };
  if (patch.view_count_inc) {
    data.view_count = { increment: 1 };
    data.last_seen_at = now;
    if (!existing.first_seen_at) data.first_seen_at = now;
  }
  if (patch.dismissed_at) data.dismissed_at = patch.dismissed_at;
  if (patch.acknowledged_at) data.acknowledged_at = patch.acknowledged_at;
  if (patch.clicked_at) data.clicked_at = patch.clicked_at;
  if (patch.channel_code) data.channel_code = patch.channel_code;

  return prisma.announcement_user_states.update({
    where: { id: existing.id },
    data,
  });
}

async function assertUserCanActOn(user, id) {
  const now = nowUtc();
  let row = await getAnnouncementOrThrow(id);
  row = await maybeExpireAnnouncement(row, now);
  row = await maybeActivateScheduled(row, now);

  const ctx = await loadUserAudienceContext(user);
  if (!announcementMatchesAudience(row, ctx)) {
    throw new ApiError(404, 'الإعلان غير موجود', null, 'ANNOUNCEMENT_NOT_FOUND');
  }
  if (row.status !== 'PUBLISHED' || !isWithinSchedule(row, now)) {
    throw new ApiError(404, 'الإعلان غير متاح', null, 'ANNOUNCEMENT_INACTIVE');
  }
  return row;
}

async function recordView(user, id, body = {}) {
  const row = await assertUserCanActOn(user, id);
  const state = await upsertUserState(user.userId, row, {
    view_count_inc: true,
    channel_code: body.channel || null,
  });
  return { ok: true, view_count: state.view_count };
}

async function recordDismiss(user, id, body = {}) {
  const row = await assertUserCanActOn(user, id);
  if (row.is_dismissible === false && row.requires_acknowledgement) {
    throw new ApiError(400, 'هذا الإعلان يتطلب تأكيد القراءة ولا يمكن إغلاقه', null, 'NOT_DISMISSIBLE');
  }
  if (row.is_dismissible === false) {
    throw new ApiError(400, 'لا يمكن إغلاق هذا الإعلان', null, 'NOT_DISMISSIBLE');
  }
  const now = nowUtc();
  const state = await upsertUserState(user.userId, row, {
    dismissed_at: now,
    channel_code: body.channel || null,
    view_count_inc: true,
  });
  return { ok: true, dismissed_at: state.dismissed_at };
}

async function recordAcknowledge(user, id, body = {}) {
  const row = await assertUserCanActOn(user, id);
  const now = nowUtc();
  const state = await upsertUserState(user.userId, row, {
    acknowledged_at: now,
    dismissed_at: now,
    channel_code: body.channel || null,
    view_count_inc: true,
  });
  return { ok: true, acknowledged_at: state.acknowledged_at };
}

async function recordClick(user, id, body = {}) {
  const row = await assertUserCanActOn(user, id);
  const now = nowUtc();
  const state = await upsertUserState(user.userId, row, {
    clicked_at: now,
    channel_code: body.channel || null,
    view_count_inc: true,
  });
  return { ok: true, clicked_at: state.clicked_at, cta_url: row.cta_url };
}

module.exports = {
  listAdmin,
  createAnnouncement,
  updateAnnouncement,
  publishAnnouncement,
  scheduleAnnouncement,
  pauseAnnouncement,
  archiveAnnouncement,
  duplicateAnnouncement,
  getAnalytics,
  listActiveForUser,
  recordView,
  recordDismiss,
  recordAcknowledge,
  recordClick,
};
