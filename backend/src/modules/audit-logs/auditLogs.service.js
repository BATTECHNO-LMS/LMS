const { ApiError } = require('../../utils/apiError');
const { prisma } = require('../../config/db');
const { normalizeRoles } = require('../../utils/deliveryAccess');
const repo = require('./auditLogs.repository');

function auditScopeWhere(requester) {
  const roles = normalizeRoles(requester.roles);
  if (roles.includes('super_admin') || roles.includes('program_admin')) return null;
  const uni = requester.universityId;
  if (uni && roles.some((r) => ['university_admin', 'academic_admin'].includes(r))) {
    return { university_id: uni };
  }
  return { id: { in: [] } };
}

async function buildListWhere(query, requester) {
  const scope = auditScopeWhere(requester);
  const and = [];
  if (scope && scope.id) return scope;
  if (scope && scope.university_id) and.push({ university_id: scope.university_id });
  if (query.user_id) and.push({ user_id: query.user_id });
  if (query.university_id) and.push({ university_id: query.university_id });
  if (query.action_type) and.push({ action_type: query.action_type });
  if (query.entity_type) and.push({ entity_type: query.entity_type });
  if (query.from || query.to) {
    const range = {};
    if (query.from) range.gte = query.from;
    if (query.to) range.lte = query.to;
    and.push({ created_at: range });
  }
  if (query.search) {
    and.push({
      OR: [
        { action_type: { contains: query.search, mode: 'insensitive' } },
        { entity_type: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

async function hydrateAuditRows(rows) {
  if (!rows.length) return [];
  const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const uniIds = [...new Set(rows.map((r) => r.university_id).filter(Boolean))];
  const [users, unis] = await Promise.all([
    userIds.length ? prisma.users.findMany({ where: { id: { in: userIds } }, select: { id: true, full_name: true, email: true } }) : [],
    uniIds.length ? prisma.universities.findMany({ where: { id: { in: uniIds } }, select: { id: true, name: true } }) : [],
  ]);
  const uMap = new Map(users.map((x) => [x.id, x]));
  const uniMap = new Map(unis.map((x) => [x.id, x]));
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    university_id: r.university_id,
    action_type: r.action_type,
    entity_type: r.entity_type,
    entity_id: r.entity_id,
    created_at: r.created_at,
    user: r.user_id ? uMap.get(r.user_id) ?? null : null,
    university: r.university_id ? uniMap.get(r.university_id) ?? null : null,
  }));
}

async function hydrateAuditDetail(row) {
  const [summary] = await hydrateAuditRows([row]);
  return {
    ...summary,
    old_values: row.old_values,
    new_values: row.new_values,
    ip_address: row.ip_address,
  };
}

async function listAuditLogs(query, requester) {
  const where = await buildListWhere(query, requester);
  const rows = await repo.findMany(where, { take: 200 });
  const audit_logs = await hydrateAuditRows(rows);
  return { audit_logs };
}

async function getAuditLogById(id, requester) {
  const row = await repo.findById(id);
  if (!row) throw new ApiError(404, 'Audit log not found');
  const scope = auditScopeWhere(requester);
  if (scope && scope.id) throw new ApiError(403, 'Forbidden');
  if (scope && scope.university_id && row.university_id && row.university_id !== scope.university_id) {
    throw new ApiError(403, 'Forbidden');
  }
  if (scope && scope.university_id && !row.university_id) {
    throw new ApiError(403, 'Forbidden');
  }
  const audit_log = await hydrateAuditDetail(row);
  return { audit_log };
}

module.exports = {
  listAuditLogs,
  getAuditLogById,
};
