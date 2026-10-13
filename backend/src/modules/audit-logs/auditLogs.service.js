const { ApiError } = require('../../utils/apiError');
const { prisma } = require('../../config/db');
const { normalizeRoles } = require('../../utils/deliveryAccess');
const { isSystemWideAdmin } = require('../../utils/universityScope');
const repo = require('./auditLogs.repository');
const { buildListMeta } = require('../../utils/pagination');
const {
  getAuditActionMeta,
  categoryLabel,
  outcomeLabel,
  buildAuditCatalog,
  listActionsForCategory,
  SESSION_END_REASONS,
} = require('../../shared/audit/auditActions');
const { resolveUserTenant } = require('../../shared/services/audit.service');
const { getStudentActivityTimeline } = require('../../shared/audit/studentActivityTimeline.service');
const authSessions = require('../auth/authSession.service');

const DENY_ALL = Object.freeze({ id: { in: [] } });
const SENSITIVE_KEY_RE = /pass(word)?|token|secret|authorization|cookie|otp|hash|api[_-]?key|signature/i;

/**
 * Audit read scope. Missing / unknown scope never means global.
 * - super admin (system-wide): everything
 * - admin with organization scope (institution): rows tagged with that organization
 * - admin with university scope: rows tagged with that university (or its organization)
 * - everyone else: nothing
 * @returns {{ type: 'global' } | { type: 'university', universityId: string, organizationId: string|null } | { type: 'organization', organizationId: string } | null}
 */
function resolveAuditScope(requester) {
  if (!requester) return null;
  if (isSystemWideAdmin(requester)) return { type: 'global' };
  const roles = normalizeRoles(requester.roles);
  if (!roles.includes('admin')) return null;
  const scope = requester.scope || {};
  if (scope.type === 'organization' && scope.organizationId) {
    return { type: 'organization', organizationId: scope.organizationId };
  }
  const universityId = scope.universityId || (scope.type !== 'organization' ? requester.universityId : null);
  if (universityId) {
    return { type: 'university', universityId, organizationId: scope.organizationId || null };
  }
  return null;
}

function scopeWhere(scope) {
  if (!scope) return DENY_ALL;
  if (scope.type === 'global') return null;
  if (scope.type === 'organization') return { organization_id: scope.organizationId };
  const or = [{ university_id: scope.universityId }];
  if (scope.organizationId) or.push({ university_id: null, organization_id: scope.organizationId });
  return { OR: or };
}

function rowInScope(row, scope) {
  if (!scope) return false;
  if (scope.type === 'global') return true;
  if (scope.type === 'organization') return row.organization_id === scope.organizationId;
  if (row.university_id) return row.university_id === scope.universityId;
  return Boolean(scope.organizationId && row.organization_id === scope.organizationId);
}

async function userInScope(userId, scope) {
  if (!scope) return false;
  if (scope.type === 'global') return true;
  const tenant = await resolveUserTenant(userId);
  if (!tenant) return false;
  if (scope.type === 'organization') return tenant.organizationId === scope.organizationId;
  return (
    tenant.universityId === scope.universityId ||
    Boolean(scope.organizationId && tenant.organizationId === scope.organizationId)
  );
}

async function searchUserIds(term) {
  const users = await prisma.users.findMany({
    where: {
      OR: [
        { full_name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
    take: 50,
  });
  return users.map((u) => u.id);
}

async function buildListWhere(query, requester) {
  const scope = resolveAuditScope(requester);
  const scoped = scopeWhere(scope);
  if (scoped === DENY_ALL) return DENY_ALL;
  const and = [];
  if (scoped) and.push(scoped);

  if (query.university_id) and.push({ university_id: query.university_id });
  if (query.organization_id) and.push({ organization_id: query.organization_id });
  if (query.user_id) and.push({ user_id: query.user_id });
  if (query.subject_user_id) and.push({ subject_user_id: query.subject_user_id });
  if (query.involving_user_id) {
    and.push({ OR: [{ user_id: query.involving_user_id }, { subject_user_id: query.involving_user_id }] });
  }
  if (query.actor_role) and.push({ actor_role: query.actor_role });
  if (query.action_types?.length) and.push({ action_type: { in: query.action_types } });
  if (query.category) {
    // Legacy rows have no stored category: match them through the registry.
    const legacyActions = listActionsForCategory(query.category);
    and.push({
      OR: [
        { category: query.category },
        ...(legacyActions.length ? [{ category: null, action_type: { in: legacyActions } }] : []),
      ],
    });
  }
  if (query.outcome) {
    and.push(query.outcome === 'SUCCESS' ? { OR: [{ outcome: 'SUCCESS' }, { outcome: null }] } : { outcome: query.outcome });
  }
  if (query.entity_type) and.push({ entity_type: query.entity_type });
  if (query.entity_id) and.push({ entity_id: query.entity_id });
  if (query.session_id) and.push({ session_id: query.session_id });
  if (query.from || query.to) {
    const range = {};
    if (query.from) range.gte = query.from;
    if (query.to) range.lte = query.to;
    and.push({ created_at: range });
  }
  if (query.search) {
    const userIds = await searchUserIds(query.search);
    and.push({
      OR: [
        { action_type: { contains: query.search, mode: 'insensitive' } },
        { entity_type: { contains: query.search, mode: 'insensitive' } },
        ...(userIds.length ? [{ user_id: { in: userIds } }, { subject_user_id: { in: userIds } }] : []),
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

function redactValues(value, depth = 0) {
  if (value == null || depth > 6) return value ?? null;
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => redactValues(v, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY_RE.test(key) ? '[REDACTED]' : redactValues(v, depth + 1);
  }
  return out;
}

function labelFields(row) {
  const meta = getAuditActionMeta(row.action_type);
  const category = row.category || meta?.category || 'SYSTEM';
  const outcome = row.outcome || 'SUCCESS';
  return {
    action_label: meta?.labelAr || null,
    action_label_en: meta?.labelEn || null,
    action_registered: Boolean(meta),
    category,
    category_label: categoryLabel(category),
    category_label_en: categoryLabel(category, 'en'),
    outcome,
    outcome_label: outcomeLabel(outcome),
    outcome_label_en: outcomeLabel(outcome, 'en'),
  };
}

async function hydrateAuditRows(rows) {
  if (!rows.length) return [];
  const userIds = [...new Set(rows.flatMap((r) => [r.user_id, r.subject_user_id]).filter(Boolean))];
  const uniIds = [...new Set(rows.map((r) => r.university_id).filter(Boolean))];
  const orgIds = [...new Set(rows.map((r) => r.organization_id).filter(Boolean))];
  const [users, unis, orgs] = await Promise.all([
    userIds.length
      ? prisma.users.findMany({ where: { id: { in: userIds } }, select: { id: true, full_name: true, email: true } })
      : [],
    uniIds.length ? prisma.universities.findMany({ where: { id: { in: uniIds } }, select: { id: true, name: true } }) : [],
    orgIds.length ? prisma.organizations.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }) : [],
  ]);
  const uMap = new Map(users.map((x) => [x.id, x]));
  const uniMap = new Map(unis.map((x) => [x.id, x]));
  const orgMap = new Map(orgs.map((x) => [x.id, x]));
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    subject_user_id: r.subject_user_id ?? null,
    university_id: r.university_id,
    organization_id: r.organization_id,
    action_type: r.action_type,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    actor_role: r.actor_role ?? null,
    created_at: r.created_at,
    ...labelFields(r),
    user: r.user_id ? uMap.get(r.user_id) ?? null : null,
    subject: r.subject_user_id ? uMap.get(r.subject_user_id) ?? null : null,
    university: r.university_id ? uniMap.get(r.university_id) ?? null : null,
    organization: r.organization_id ? orgMap.get(r.organization_id) ?? null : null,
  }));
}

async function hydrateAuditDetail(row, scope) {
  const [summary] = await hydrateAuditRows([row]);
  const detail = {
    ...summary,
    old_values: redactValues(row.old_values),
    new_values: redactValues(row.new_values),
  };
  // Technical request metadata is restricted to system-wide administrators.
  if (scope?.type === 'global') {
    detail.ip_address = row.ip_address;
    detail.user_agent = row.user_agent ?? null;
    detail.request_id = row.request_id ?? null;
    detail.session_id = row.session_id ?? null;
  }
  return detail;
}

async function listAuditLogs(query, requester) {
  const where = await buildListWhere(query, requester);
  const [total, rows] = await Promise.all([
    repo.count(where),
    repo.findMany(where, { skip: query.skip, take: query.take }),
  ]);
  const audit_logs = await hydrateAuditRows(rows);
  return {
    audit_logs,
    meta: buildListMeta(total, query.page, query.page_size),
  };
}

async function getAuditLogById(id, requester) {
  const scope = resolveAuditScope(requester);
  if (!scope) throw new ApiError(403, 'Forbidden');
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Audit log not found');
  if (!rowInScope(row, scope)) throw new ApiError(403, 'Forbidden');
  const audit_log = await hydrateAuditDetail(row, scope);
  return { audit_log };
}

function getAuditCatalog() {
  return buildAuditCatalog();
}

async function getStudentTimeline(studentId, query, requester) {
  const scope = resolveAuditScope(requester);
  if (!scope) throw new ApiError(403, 'Forbidden');
  const student = await prisma.users.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) throw new ApiError(404, 'User not found');
  if (!(await userInScope(studentId, scope))) throw new ApiError(403, 'Forbidden');
  const { events, total } = await getStudentActivityTimeline({
    studentId,
    organizationScope: scope,
    dateRange: { from: query.from, to: query.to },
    opportunityId: query.opportunity_id,
    courseId: query.course_id,
    includeSecurityEvents: query.include_security === true,
    order: 'desc',
    skip: query.skip,
    take: query.take,
  });
  return { events, meta: buildListMeta(total, query.page, query.page_size) };
}

function presentSession(row, now = new Date()) {
  const verdict = authSessions.evaluateSession(row, now);
  return {
    id: row.id,
    user_id: row.user_id,
    created_at: row.created_at,
    last_activity_at: row.last_activity_at,
    last_seen_at: row.last_seen_at,
    absolute_expires_at: row.absolute_expires_at,
    ended_at: row.ended_at,
    end_reason: row.end_reason,
    portal_type: row.portal_type,
    login_method: row.created_by_login_method ?? null,
    is_active: verdict.ok,
  };
}

async function listUserSessions(userId, requester) {
  const scope = resolveAuditScope(requester);
  if (!scope) throw new ApiError(403, 'Forbidden');
  if (!(await userInScope(userId, scope))) throw new ApiError(403, 'Forbidden');
  const rows = await authSessions.listSessionsForUser(userId, { take: 25 });
  return { sessions: rows.map((r) => presentSession(r)) };
}

/** Admin ends one specific session (ADMIN_REVOKED). There is no "end all sessions". */
async function revokeSession(sessionId, requester) {
  const scope = resolveAuditScope(requester);
  if (!scope) throw new ApiError(403, 'Forbidden');
  const row = await authSessions.getSessionById(sessionId);
  if (!row) throw new ApiError(404, 'Session not found');
  if (!(await userInScope(row.user_id, scope))) throw new ApiError(403, 'Forbidden');
  const ended = await authSessions.endSession(row, SESSION_END_REASONS.ADMIN_REVOKED, {
    actorUserId: requester.userId,
    detectedBy: 'admin',
  });
  return { ended };
}

module.exports = {
  listAuditLogs,
  getAuditLogById,
  getAuditCatalog,
  getStudentTimeline,
  listUserSessions,
  revokeSession,
  resolveAuditScope,
  scopeWhere,
  rowInScope,
  buildListWhere,
  redactValues,
};
