'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { isSystemWideAdmin } = require('../../utils/universityScope');
const { ORGANIZATION_TYPES, ROLE_CODES } = require('./analytics.definitions');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function optionalUuid(value, field) {
  if (value == null || value === '') return undefined;
  const s = String(value).trim();
  if (!UUID_RE.test(s)) {
    throw new ApiError(400, 'معرّف غير صالح', { field }, 'ANALYTICS_ID_INVALID');
  }
  return s;
}

function canAccessCommandCenter(requester) {
  if (!requester) return false;
  if (requester.isGlobal) return true;
  const roles = Array.isArray(requester.roles) ? requester.roles : [];
  return roles.includes('admin');
}

function assertCommandCenterAccess(requester) {
  if (!canAccessCommandCenter(requester)) {
    throw new ApiError(403, 'لا تملك صلاحية عرض التحليلات', null, 'FORBIDDEN');
  }
}

/**
 * Intersect requested filters with the authenticated user's authorized scope.
 * Never trusts client organizationId / universityId / opportunityId alone.
 */
function resolveAnalyticsScope(requester, query = {}) {
  assertCommandCenterAccess(requester);

  const requestedOrgId = optionalUuid(query.organizationId || query.organization_id, 'organizationId');
  const requestedUniId = optionalUuid(query.universityId || query.university_id, 'universityId');
  const requestedOppId = optionalUuid(query.opportunityId || query.opportunity_id, 'opportunityId');
  const requestedCourseId = optionalUuid(query.courseId || query.course_id, 'courseId');
  const requestedMcId = optionalUuid(query.microCredentialId || query.micro_credential_id, 'microCredentialId');
  const requestedOrgType = query.organizationType || query.organization_type || null;
  const requestedRole = query.role ? String(query.role).trim().toLowerCase() : null;

  if (requestedOrgType && requestedOrgType !== 'UNIVERSITY' && requestedOrgType !== 'INSTITUTION') {
    throw new ApiError(400, 'نوع المؤسسة غير صالح', null, 'ANALYTICS_ORG_TYPE_INVALID');
  }
  if (requestedRole && requestedRole !== 'all' && !ROLE_CODES.includes(requestedRole)) {
    throw new ApiError(400, 'الدور غير مدعوم', null, 'ANALYTICS_ROLE_INVALID');
  }

  const global = isSystemWideAdmin(requester);
  let organizationId;
  let universityId;
  let organizationType = null;

  if (global) {
    organizationId = requestedOrgId;
    universityId = requestedUniId;
    organizationType = requestedOrgType || null;
  } else {
    organizationType = requester.organizationType || null;
    organizationId = requester.organizationId || null;
    universityId = requester.universityId || null;

    if (requestedOrgId && organizationId && String(requestedOrgId) !== String(organizationId)) {
      throw new ApiError(403, 'لا يمكن عرض تحليلات مؤسسة أخرى', null, 'FORBIDDEN');
    }
    if (requestedUniId && universityId && String(requestedUniId) !== String(universityId)) {
      throw new ApiError(403, 'لا يمكن عرض تحليلات جامعة أخرى', null, 'FORBIDDEN');
    }
    if (requestedOrgType && organizationType && requestedOrgType !== organizationType) {
      throw new ApiError(403, 'لا يمكن تغيير نوع المؤسسة', null, 'FORBIDDEN');
    }
    if (!organizationId && !universityId) {
      throw new ApiError(403, 'لا يوجد نطاق مؤسسي مرتبط بحسابك', null, 'FORBIDDEN');
    }
  }

  const isInstitution = organizationType === ORGANIZATION_TYPES.INSTITUTION && !global
    ? true
    : organizationType === ORGANIZATION_TYPES.INSTITUTION && Boolean(organizationId) && !universityId;

  const fieldTraining = global
    ? organizationType !== ORGANIZATION_TYPES.INSTITUTION || Boolean(universityId)
    : organizationType === ORGANIZATION_TYPES.UNIVERSITY;

  return {
    isGlobal: global,
    organizationId: organizationId || undefined,
    universityId: universityId || undefined,
    organizationType,
    opportunityId: fieldTraining ? requestedOppId : undefined,
    courseId: requestedCourseId,
    microCredentialId: requestedMcId,
    role: requestedRole && requestedRole !== 'all' ? requestedRole : undefined,
    modules: {
      fieldTraining: Boolean(fieldTraining),
      recordedLectures: Boolean(fieldTraining),
      courses: true,
      microCredentials: true,
      trainingPrograms: global || organizationType === ORGANIZATION_TYPES.INSTITUTION,
      certificates: true,
      systemHealth: Boolean(global),
    },
    requesterId: requester.userId || requester.id || null,
  };
}

async function enrichAnalyticsScope(scope) {
  if (scope.universityId || !scope.organizationId) return scope;
  const uni = await prisma.universities.findFirst({
    where: { organization_id: scope.organizationId },
    select: { id: true },
  });
  if (uni) {
    return {
      ...scope,
      universityId: uni.id,
      organizationType: scope.organizationType || 'UNIVERSITY',
      modules: {
        ...scope.modules,
        fieldTraining: true,
        recordedLectures: true,
      },
    };
  }
  return {
    ...scope,
    organizationType: scope.organizationType || 'INSTITUTION',
    modules: {
      ...scope.modules,
      fieldTraining: false,
      recordedLectures: false,
      trainingPrograms: true,
    },
  };
}

function cacheScopeKey(scope, period) {
  return [
    scope.isGlobal ? 'g' : 's',
    scope.organizationType || '-',
    scope.organizationId || '-',
    scope.universityId || '-',
    scope.opportunityId || '-',
    scope.courseId || '-',
    scope.microCredentialId || '-',
    scope.role || '-',
    period.period,
    period.periodStart.toISOString(),
    period.periodEnd.toISOString(),
  ].join('|');
}

module.exports = {
  canAccessCommandCenter,
  assertCommandCenterAccess,
  resolveAnalyticsScope,
  enrichAnalyticsScope,
  cacheScopeKey,
  optionalUuid,
};
