'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { isSystemWideAdmin } = require('../../utils/universityScope');
const { ACTIVATION_SLA_HOURS } = require('../../utils/authErrorCatalog');
const {
  assertContentAdmin,
  CONTENT_ADMIN_FORBIDDEN_MSG,
  sanitizeHtml,
  sanitizeCtaUrl,
  interpolateTemplate,
  assertTargetUniversitiesInScope,
  primaryRole,
  nowUtc,
  OFFICIAL_ROLES,
} = require('../contentCms/contentCms.shared');

const PROTECTED_SYSTEM_KEYS = Object.freeze([
  'ACCOUNT_PENDING_ACTIVATION',
  'ACCOUNT_ACTIVATION_OVERDUE',
]);

const PROTECTED_SYSTEM_KEY_SET = new Set(PROTECTED_SYSTEM_KEYS);

const CONTENT_FIELDS = new Set([
  'title_ar',
  'body_ar',
  'icon',
  'image_url',
  'popup_type',
  'cta_label',
  'cta_url',
  'display_rule',
  'trigger_event',
]);

function notFound() {
  throw new ApiError(404, 'النافذة المنبثقة غير موجودة', null, 'POPUP_NOT_FOUND');
}

function assertProtectedNotArchivable(popup) {
  if (popup.system_key && PROTECTED_SYSTEM_KEY_SET.has(popup.system_key)) {
    throw new ApiError(
      400,
      'لا يمكن أرشفة نوافذ النظام المحمية (تفعيل الحساب)',
      null,
      'POPUP_SYSTEM_PROTECTED'
    );
  }
}

/**
 * Non–system-wide admins only manage popups that target their university
 * (or system-key popups which are globally editable).
 */
function adminScopeWhere(user) {
  if (isSystemWideAdmin(user)) return {};
  const uni = user?.universityId;
  if (!uni) {
    throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
  }
  return {
    OR: [
      { system_key: { not: null } },
      { target_university_ids: { has: uni } },
      { target_university_ids: { equals: [] } },
    ],
  };
}

function assertAdminCanAccessPopup(user, popup) {
  if (isSystemWideAdmin(user)) return;
  const uni = user?.universityId;
  if (!uni) {
    throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
  }
  if (popup.system_key) return;
  const targets = popup.target_university_ids || [];
  if (targets.length === 0) return;
  if (!targets.includes(uni)) {
    throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
  }
}

function normalizeTargetRoles(roles) {
  if (!Array.isArray(roles)) return [];
  return [...new Set(roles.filter((r) => OFFICIAL_ROLES.includes(r)))];
}

function coerceDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(400, 'تاريخ غير صالح', null, 'INVALID_DATE');
  }
  return d;
}

function sanitizePopupPayload(body, { forUpdate = false } = {}) {
  const data = {};

  const assignString = (key, maxLen) => {
    if (!Object.prototype.hasOwnProperty.call(body, key)) return;
    const raw = body[key];
    if (raw == null || raw === '') {
      data[key] = null;
      return;
    }
    data[key] = String(raw).trim().slice(0, maxLen);
  };

  if (Object.prototype.hasOwnProperty.call(body, 'admin_name') || !forUpdate) {
    if (body.admin_name != null) data.admin_name = String(body.admin_name).trim().slice(0, 255);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'title_ar') || !forUpdate) {
    if (body.title_ar != null) data.title_ar = String(body.title_ar).trim().slice(0, 500);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'body_ar') || !forUpdate) {
    if (body.body_ar != null) data.body_ar = sanitizeHtml(body.body_ar);
  }

  assignString('icon', 64);
  if (Object.prototype.hasOwnProperty.call(body, 'image_url')) {
    data.image_url = sanitizeCtaUrl(body.image_url);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'popup_type')) {
    data.popup_type = body.popup_type;
  }
  assignString('cta_label', 120);
  if (Object.prototype.hasOwnProperty.call(body, 'cta_url')) {
    data.cta_url = sanitizeCtaUrl(body.cta_url);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'is_dismissible')) {
    data.is_dismissible = Boolean(body.is_dismissible);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'requires_acknowledgement')) {
    data.requires_acknowledgement = Boolean(body.requires_acknowledgement);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'display_rule')) {
    data.display_rule = body.display_rule;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'target_roles')) {
    data.target_roles = normalizeTargetRoles(body.target_roles);
  }
  for (const key of ['target_university_ids', 'target_specialty_ids', 'target_user_ids']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      data[key] = Array.isArray(body[key]) ? [...new Set(body[key].filter(Boolean))] : [];
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'target_opportunity_id')) {
    data.target_opportunity_id =
      body.target_opportunity_id == null || body.target_opportunity_id === ''
        ? null
        : String(body.target_opportunity_id);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'target_session_id')) {
    data.target_session_id =
      body.target_session_id == null || body.target_session_id === ''
        ? null
        : String(body.target_session_id);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'target_pages')) {
    data.target_pages = Array.isArray(body.target_pages)
      ? [...new Set(body.target_pages.map((r) => String(r).trim()).filter(Boolean))]
      : [];
  }
  if (Object.prototype.hasOwnProperty.call(body, 'starts_at')) {
    data.starts_at = coerceDate(body.starts_at);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'ends_at')) {
    data.ends_at = coerceDate(body.ends_at);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'priority')) {
    data.priority = Number(body.priority);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'max_impressions')) {
    data.max_impressions = body.max_impressions == null ? null : Number(body.max_impressions);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'trigger_event')) {
    data.trigger_event =
      body.trigger_event == null || body.trigger_event === ''
        ? null
        : String(body.trigger_event).trim().slice(0, 100);
  }

  return data;
}

function mapPopup(row, { state = null, templateVars = null } = {}) {
  if (!row) return null;
  const apply = (text) =>
    templateVars ? interpolateTemplate(text, templateVars) : text == null ? null : String(text);

  return {
    id: row.id,
    admin_name: row.admin_name,
    title_ar: apply(row.title_ar),
    body_ar: apply(row.body_ar),
    icon: row.icon,
    image_url: row.image_url,
    popup_type: row.popup_type,
    cta_label: row.cta_label != null ? apply(row.cta_label) : null,
    cta_url: row.cta_url,
    is_dismissible: row.is_dismissible,
    requires_acknowledgement: row.requires_acknowledgement,
    display_rule: row.display_rule,
    target_roles: row.target_roles || [],
    target_university_ids: row.target_university_ids || [],
    target_specialty_ids: row.target_specialty_ids || [],
    target_opportunity_id: row.target_opportunity_id,
    target_session_id: row.target_session_id,
    target_user_ids: row.target_user_ids || [],
    target_pages: row.target_pages || [],
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    priority: row.priority,
    max_impressions: row.max_impressions,
    status: row.status,
    version: row.version,
    system_key: row.system_key,
    trigger_event: row.trigger_event,
    created_by_id: row.created_by_id,
    updated_by_id: row.updated_by_id,
    published_by_id: row.published_by_id,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_system: Boolean(row.system_key && PROTECTED_SYSTEM_KEY_SET.has(row.system_key)),
    user_state: state
      ? {
          popup_version: state.popup_version,
          first_seen_at: state.first_seen_at,
          last_seen_at: state.last_seen_at,
          dismissed_at: state.dismissed_at,
          acknowledged_at: state.acknowledged_at,
          clicked_at: state.clicked_at,
          view_count: state.view_count,
        }
      : undefined,
  };
}

function contentChanged(existing, data) {
  for (const key of CONTENT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    const next = data[key];
    const prev = existing[key];
    if (next instanceof Date || prev instanceof Date) {
      if (String(next || '') !== String(prev || '')) return true;
      continue;
    }
    if (JSON.stringify(next ?? null) !== JSON.stringify(prev ?? null)) return true;
  }
  return false;
}

async function getPopupOrThrow(id) {
  const row = await prisma.managed_popups.findUnique({ where: { id } });
  if (!row) notFound();
  return row;
}

async function adminListPopups(user, query = {}) {
  assertContentAdmin(user);
  const where = { ...adminScopeWhere(user) };
  if (query.status) where.status = query.status;
  if (query.popup_type) where.popup_type = query.popup_type;
  if (query.system_key) where.system_key = query.system_key;
  if (query.q) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { admin_name: { contains: query.q, mode: 'insensitive' } },
          { title_ar: { contains: query.q, mode: 'insensitive' } },
          { system_key: { contains: query.q, mode: 'insensitive' } },
        ],
      },
    ];
  }

  const rows = await prisma.managed_popups.findMany({
    where,
    orderBy: [{ priority: 'asc' }, { updated_at: 'desc' }],
  });
  return rows.map((row) => mapPopup(row));
}

async function adminCreatePopup(user, body, meta = {}) {
  assertContentAdmin(user);
  const data = sanitizePopupPayload(body, { forUpdate: false });

  if (!isSystemWideAdmin(user)) {
    const uni = user.universityId;
    if (!uni) {
      throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
    }
    if (!data.target_university_ids || data.target_university_ids.length === 0) {
      data.target_university_ids = [uni];
    }
  }
  assertTargetUniversitiesInScope(user, data.target_university_ids);

  const now = nowUtc();
  const row = await prisma.managed_popups.create({
    data: {
      ...data,
      status: 'DRAFT',
      version: 1,
      created_by_id: user.userId,
      updated_by_id: user.userId,
      created_at: now,
      updated_at: now,
    },
  });

  await recordAudit({
    userId: user.userId,
    universityId: user.universityId || null,
    actionType: 'popup_created',
    entityType: 'managed_popup',
    entityId: row.id,
    newValues: { admin_name: row.admin_name, status: row.status },
    ipAddress: meta.ipAddress || null,
  });

  return mapPopup(row);
}

async function adminUpdatePopup(user, id, body, meta = {}) {
  assertContentAdmin(user);
  const existing = await getPopupOrThrow(id);
  assertAdminCanAccessPopup(user, existing);

  const data = sanitizePopupPayload(body, { forUpdate: true });
  if (Object.prototype.hasOwnProperty.call(data, 'target_university_ids')) {
    if (!isSystemWideAdmin(user)) {
      const uni = user.universityId;
      if (!uni) {
        throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
      }
      if (!data.target_university_ids.length) {
        data.target_university_ids = [uni];
      }
    }
    assertTargetUniversitiesInScope(user, data.target_university_ids);
  }

  if (contentChanged(existing, data)) {
    data.version = (existing.version || 1) + 1;
  }

  data.updated_by_id = user.userId;
  data.updated_at = nowUtc();

  const row = await prisma.managed_popups.update({
    where: { id },
    data,
  });

  await recordAudit({
    userId: user.userId,
    universityId: user.universityId || null,
    actionType: 'popup_updated',
    entityType: 'managed_popup',
    entityId: row.id,
    oldValues: { version: existing.version, status: existing.status },
    newValues: { version: row.version, status: row.status },
    ipAddress: meta.ipAddress || null,
  });

  return mapPopup(row);
}

async function adminPublishPopup(user, id, meta = {}) {
  assertContentAdmin(user);
  const existing = await getPopupOrThrow(id);
  assertAdminCanAccessPopup(user, existing);

  if (existing.status === 'ARCHIVED') {
    throw new ApiError(
      400,
      'لا يمكن نشر نافذة مؤرشفة. أنشئ نسخة جديدة أو عدّل الحالة أولًا',
      null,
      'POPUP_ARCHIVED'
    );
  }

  const now = nowUtc();
  const row = await prisma.managed_popups.update({
    where: { id },
    data: {
      status: 'PUBLISHED',
      published_at: existing.published_at || now,
      published_by_id: existing.published_by_id || user.userId,
      updated_by_id: user.userId,
      updated_at: now,
    },
  });

  await recordAudit({
    userId: user.userId,
    universityId: user.universityId || null,
    actionType: 'popup_published',
    entityType: 'managed_popup',
    entityId: row.id,
    oldValues: { status: existing.status },
    newValues: { status: row.status },
    ipAddress: meta.ipAddress || null,
  });

  return mapPopup(row);
}

async function adminPausePopup(user, id, meta = {}) {
  assertContentAdmin(user);
  const existing = await getPopupOrThrow(id);
  assertAdminCanAccessPopup(user, existing);

  if (existing.status !== 'PUBLISHED') {
    throw new ApiError(400, 'يمكن إيقاف النوافذ المنشورة فقط', null, 'POPUP_NOT_PUBLISHED');
  }

  const row = await prisma.managed_popups.update({
    where: { id },
    data: {
      status: 'PAUSED',
      updated_by_id: user.userId,
      updated_at: nowUtc(),
    },
  });

  await recordAudit({
    userId: user.userId,
    universityId: user.universityId || null,
    actionType: 'popup_paused',
    entityType: 'managed_popup',
    entityId: row.id,
    oldValues: { status: existing.status },
    newValues: { status: row.status },
    ipAddress: meta.ipAddress || null,
  });

  return mapPopup(row);
}

async function adminArchivePopup(user, id, meta = {}) {
  assertContentAdmin(user);
  const existing = await getPopupOrThrow(id);
  assertAdminCanAccessPopup(user, existing);
  assertProtectedNotArchivable(existing);

  const row = await prisma.managed_popups.update({
    where: { id },
    data: {
      status: 'ARCHIVED',
      updated_by_id: user.userId,
      updated_at: nowUtc(),
    },
  });

  await recordAudit({
    userId: user.userId,
    universityId: user.universityId || null,
    actionType: 'popup_archived',
    entityType: 'managed_popup',
    entityId: row.id,
    oldValues: { status: existing.status },
    newValues: { status: row.status },
    ipAddress: meta.ipAddress || null,
  });

  return mapPopup(row);
}

function matchesTargetArray(targets, value) {
  if (!Array.isArray(targets) || targets.length === 0) return true;
  if (value == null) return false;
  return targets.includes(value);
}

function matchesOptionalId(targetId, value) {
  if (targetId == null || targetId === '') return true;
  if (value == null) return false;
  return targetId === value;
}

function isWithinSchedule(popup, now) {
  if (popup.starts_at && new Date(popup.starts_at) > now) return false;
  if (popup.ends_at && new Date(popup.ends_at) < now) return false;
  return true;
}

function isEligibleByDisplayRule(popup, state, options = {}) {
  const rule = popup.display_rule;

  if (popup.max_impressions != null && state && state.view_count >= popup.max_impressions) {
    return false;
  }

  switch (rule) {
    case 'ONCE':
      return !state?.first_seen_at && !state?.dismissed_at && !state?.acknowledged_at;
    case 'ONCE_PER_VERSION': {
      if (!state) return true;
      if (Number(state.popup_version) !== Number(popup.version)) return true;
      return !state.first_seen_at && !state.dismissed_at && !state.acknowledged_at;
    }
    case 'EVERY_LOGIN':
      // Session boundary is client-side; API re-offers while within max_impressions.
      return true;
    case 'UNTIL_ACKNOWLEDGED':
      return !state?.acknowledged_at;
    case 'DATE_RANGE':
      return !state?.dismissed_at;
    case 'EVENT_TRIGGERED':
      if (!options.trigger_event) return false;
      return options.trigger_event === popup.trigger_event && !state?.acknowledged_at;
    default:
      return false;
  }
}

function routesConflict(a, b) {
  const ra = a.target_pages || [];
  const rb = b.target_pages || [];
  if (!ra.length || !rb.length) return true;
  return ra.some((r) => rb.includes(r));
}

function isExclusivePopup(popup) {
  return (
    Boolean(popup.requires_acknowledgement) ||
    popup.popup_type === 'URGENT' ||
    Boolean(popup.system_key && PROTECTED_SYSTEM_KEY_SET.has(popup.system_key))
  );
}

/**
 * Priority queue: return only the highest-priority eligible popup,
 * unless several at that priority do not conflict (routes / exclusivity).
 */
function selectPriorityQueue(eligible) {
  if (!eligible.length) return [];

  const sorted = [...eligible].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (isExclusivePopup(a) !== isExclusivePopup(b)) return isExclusivePopup(a) ? -1 : 1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  const topPriority = sorted[0].priority;
  const topTier = sorted.filter((p) => p.priority === topPriority);

  if (topTier.some(isExclusivePopup)) {
    return [topTier.find(isExclusivePopup) || topTier[0]];
  }

  const selected = [];
  for (const popup of topTier) {
    if (selected.some((s) => routesConflict(s, popup))) continue;
    selected.push(popup);
  }
  return selected.length ? selected : [sorted[0]];
}

async function buildTemplateVars(user) {
  const row = await prisma.users.findUnique({
    where: { id: user.userId },
    select: {
      full_name: true,
      email: true,
      primary_university_id: true,
    },
  });

  let universityName = user.university?.name || null;
  if (!universityName && row?.primary_university_id) {
    const uni = await prisma.universities.findUnique({
      where: { id: row.primary_university_id },
      select: { name: true },
    });
    universityName = uni?.name || null;
  }

  return {
    student_name: row?.full_name || '',
    email: row?.email || '',
    activation_wait_hours: String(ACTIVATION_SLA_HOURS || 48),
    university_name: universityName || '',
  };
}

async function loadUserTargetContext(user, options = {}) {
  const dbUser = await prisma.users.findUnique({
    where: { id: user.userId },
    select: {
      specialty_id: true,
      university_specialty_id: true,
      primary_university_id: true,
    },
  });

  return {
    role: primaryRole(user),
    roles: user.roles || [],
    universityId: user.universityId || dbUser?.primary_university_id || null,
    specialtyId: options.specialty_id || dbUser?.specialty_id || null,
    opportunityId: options.opportunity_id || null,
    sessionId: options.session_id || null,
  };
}

function isTargetedToUser(popup, ctx) {
  const roles = popup.target_roles || [];
  if (roles.length) {
    const userRoles = Array.isArray(ctx.roles) ? ctx.roles : [];
    const hit = roles.some((r) => userRoles.includes(r) || r === ctx.role);
    if (!hit) return false;
  }

  if (!matchesTargetArray(popup.target_university_ids, ctx.universityId)) return false;
  if (!matchesTargetArray(popup.target_specialty_ids, ctx.specialtyId)) return false;
  if (!matchesOptionalId(popup.target_opportunity_id, ctx.opportunityId)) return false;
  if (!matchesOptionalId(popup.target_session_id, ctx.sessionId)) return false;

  const userTargets = popup.target_user_ids || [];
  if (userTargets.length && !userTargets.includes(ctx.userId)) return false;

  return true;
}

async function listActivePopups(user, options = {}) {
  const now = nowUtc();
  const ctx = await loadUserTargetContext(user, options);
  ctx.userId = user.userId;

  const rows = await prisma.managed_popups.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ priority: 'asc' }, { updated_at: 'desc' }],
  });

  const states = await prisma.managed_popup_user_states.findMany({
    where: {
      user_id: user.userId,
      popup_id: { in: rows.map((r) => r.id) },
    },
  });
  const stateByPopup = new Map(states.map((s) => [s.popup_id, s]));

  const route = options.route || null;
  const eligible = [];

  for (const popup of rows) {
    if (!isWithinSchedule(popup, now)) continue;
    if (!isTargetedToUser(popup, ctx)) continue;

    const pageRoutes = popup.target_pages || [];
    if (route && pageRoutes.length && !pageRoutes.includes(route)) continue;

    const state = stateByPopup.get(popup.id) || null;
    if (!isEligibleByDisplayRule(popup, state, options)) continue;

    eligible.push(popup);
  }

  const queued = selectPriorityQueue(eligible);
  const templateVars = await buildTemplateVars(user);

  return queued.map((popup) =>
    mapPopup(popup, {
      state: stateByPopup.get(popup.id) || null,
      templateVars,
    })
  );
}

async function ensureUserState(popupId, userId, popupVersion) {
  const existing = await prisma.managed_popup_user_states.findUnique({
    where: {
      popup_id_user_id: { popup_id: popupId, user_id: userId },
    },
  });
  if (existing) return existing;

  return prisma.managed_popup_user_states.create({
    data: {
      popup_id: popupId,
      user_id: userId,
      popup_version: popupVersion || 1,
    },
  });
}

async function getPublishedPopupForUser(user, id) {
  const popup = await getPopupOrThrow(id);
  if (popup.status !== 'PUBLISHED') {
    throw new ApiError(404, 'النافذة المنبثقة غير متاحة', null, 'POPUP_NOT_AVAILABLE');
  }
  const ctx = await loadUserTargetContext(user, {});
  ctx.userId = user.userId;
  if (!isTargetedToUser(popup, ctx)) {
    throw new ApiError(403, 'هذه النافذة غير موجّهة لحسابك', null, 'POPUP_NOT_TARGETED');
  }
  return popup;
}

async function recordView(user, id) {
  const popup = await getPublishedPopupForUser(user, id);
  const now = nowUtc();
  let state = await ensureUserState(id, user.userId, popup.version);

  const versionChanged = Number(state.popup_version) !== Number(popup.version);
  state = await prisma.managed_popup_user_states.update({
    where: { id: state.id },
    data: {
      popup_version: popup.version,
      first_seen_at: state.first_seen_at && !versionChanged ? state.first_seen_at : now,
      last_seen_at: now,
      view_count: versionChanged ? 1 : (state.view_count || 0) + 1,
      dismissed_at: versionChanged ? null : state.dismissed_at,
      acknowledged_at: versionChanged ? null : state.acknowledged_at,
      updated_at: now,
    },
  });

  return mapPopup(popup, { state, templateVars: await buildTemplateVars(user) });
}

async function recordDismiss(user, id) {
  const popup = await getPublishedPopupForUser(user, id);
  if (!popup.is_dismissible) {
    throw new ApiError(400, 'لا يمكن إغلاق هذه النافذة', null, 'POPUP_NOT_DISMISSIBLE');
  }

  const now = nowUtc();
  let state = await ensureUserState(id, user.userId, popup.version);
  state = await prisma.managed_popup_user_states.update({
    where: { id: state.id },
    data: {
      popup_version: popup.version,
      dismissed_at: now,
      last_seen_at: now,
      first_seen_at: state.first_seen_at || now,
      updated_at: now,
    },
  });

  return mapPopup(popup, { state, templateVars: await buildTemplateVars(user) });
}

async function recordAcknowledge(user, id) {
  const popup = await getPublishedPopupForUser(user, id);
  const now = nowUtc();
  let state = await ensureUserState(id, user.userId, popup.version);
  state = await prisma.managed_popup_user_states.update({
    where: { id: state.id },
    data: {
      popup_version: popup.version,
      acknowledged_at: now,
      last_seen_at: now,
      first_seen_at: state.first_seen_at || now,
      updated_at: now,
    },
  });

  return mapPopup(popup, { state, templateVars: await buildTemplateVars(user) });
}

module.exports = {
  PROTECTED_SYSTEM_KEYS,
  adminListPopups,
  adminCreatePopup,
  adminUpdatePopup,
  adminPublishPopup,
  adminPausePopup,
  adminArchivePopup,
  listActivePopups,
  recordView,
  recordDismiss,
  recordAcknowledge,
};
