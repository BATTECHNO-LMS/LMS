'use strict';

const { Prisma } = require('@prisma/client');
const { NON_MEANINGFUL_AUDIT_ACTIONS } = require('./analytics.definitions');

function scopeUsersSql(scope) {
  if (scope.isGlobal && !scope.universityId && !scope.organizationId && !scope.organizationType) {
    return Prisma.empty;
  }
  if (scope.universityId) {
    return Prisma.sql`AND (
      u.primary_university_id = ${scope.universityId}::uuid
      OR EXISTS (
        SELECT 1 FROM university_users uu
        WHERE uu.user_id = u.id AND uu.university_id = ${scope.universityId}::uuid
      )
    )`;
  }
  if (scope.organizationId) {
    return Prisma.sql`AND EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      WHERE uoa.user_id = u.id
        AND uoa.organization_id = ${scope.organizationId}::uuid
        AND uoa.is_active = true
    )`;
  }
  if (scope.organizationType) {
    return Prisma.sql`AND EXISTS (
      SELECT 1 FROM user_organization_assignments uoa
      JOIN organizations org ON org.id = uoa.organization_id
      WHERE uoa.user_id = u.id AND uoa.is_active = true AND org.type = ${scope.organizationType}::organization_type
    )`;
  }
  return Prisma.sql`AND FALSE`;
}

function scopeAuditSql(scope) {
  if (scope.universityId) {
    return Prisma.sql`AND al.university_id = ${scope.universityId}::uuid`;
  }
  if (scope.organizationId) {
    return Prisma.sql`AND al.organization_id = ${scope.organizationId}::uuid`;
  }
  if (scope.organizationType === 'UNIVERSITY') {
    return Prisma.sql`AND al.university_id IS NOT NULL`;
  }
  if (scope.organizationType === 'INSTITUTION') {
    return Prisma.sql`AND al.organization_id IN (
      SELECT id FROM organizations WHERE type = 'INSTITUTION'::organization_type
    )`;
  }
  return Prisma.empty;
}

function roleUserSql(scope) {
  if (!scope.role) return Prisma.empty;
  return Prisma.sql`AND EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = u.id AND r.code = ${scope.role}
  )`;
}

function ftAppScopeSql(scope) {
  const parts = [];
  if (scope.opportunityId) {
    parts.push(Prisma.sql`app.opportunity_id = ${scope.opportunityId}::uuid`);
  }
  if (scope.universityId) {
    parts.push(Prisma.sql`EXISTS (
      SELECT 1 FROM field_training_opportunities o
      WHERE o.id = app.opportunity_id
        AND (
          o.university_id = ${scope.universityId}::uuid
          OR EXISTS (
            SELECT 1 FROM field_training_opportunity_eligibility e
            WHERE e.opportunity_id = o.id
              AND e.university_id = ${scope.universityId}::uuid
              AND e.is_active = true
          )
        )
    )`);
  }
  if (!parts.length) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.join(parts, ' AND ')}`;
}

function ftOppScopeSql(scope) {
  const parts = [];
  if (scope.opportunityId) {
    parts.push(Prisma.sql`o.id = ${scope.opportunityId}::uuid`);
  }
  if (scope.universityId) {
    parts.push(Prisma.sql`(
      o.university_id = ${scope.universityId}::uuid
      OR EXISTS (
        SELECT 1 FROM field_training_opportunity_eligibility e
        WHERE e.opportunity_id = o.id
          AND e.university_id = ${scope.universityId}::uuid
          AND e.is_active = true
      )
    )`);
  }
  if (!parts.length) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.join(parts, ' AND ')}`;
}

const nonMeaningfulSql = Prisma.sql`AND al.action_type NOT IN (${Prisma.join(
  NON_MEANINGFUL_AUDIT_ACTIONS.map((a) => Prisma.sql`${a}`)
)})
  AND al.action_type NOT ILIKE ${'%HEARTBEAT%'}
  AND al.action_type NOT ILIKE ${'%POLL%'}`;

module.exports = {
  scopeUsersSql,
  scopeAuditSql,
  roleUserSql,
  ftAppScopeSql,
  ftOppScopeSql,
  nonMeaningfulSql,
};
