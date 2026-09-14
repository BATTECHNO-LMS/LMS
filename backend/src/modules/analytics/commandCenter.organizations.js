'use strict';

const { prisma } = require('../../config/db');
const { Prisma } = require('@prisma/client');
const { intCount } = require('./analytics.percent');
const { nonMeaningfulSql } = require('./commandCenter.sql');

async function getOrganizationAnalytics(scope, period, metric = 'activeUsers') {
  if (!scope.isGlobal && scope.organizationId) {
    return { available: true, metric, items: [], note: 'Single-organization scope' };
  }

  const orgTypeSql = scope.organizationType
    ? Prisma.sql`AND org.type = ${scope.organizationType}::organization_type`
    : Prisma.empty;

  if (metric === 'students') {
    const rows = await prisma.$queryRaw`
      SELECT org.id, org.name, org.name_en, org.type, COUNT(DISTINCT u.id)::int AS value
      FROM organizations org
      JOIN user_organization_assignments uoa ON uoa.organization_id = org.id AND uoa.is_active = true
      JOIN users u ON u.id = uoa.user_id
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id AND r.code IN ('student', 'trainee')
      WHERE org.status = 'active'::organization_status
        ${orgTypeSql}
      GROUP BY org.id, org.name, org.name_en, org.type
      ORDER BY value DESC
      LIMIT 12
    `;
    return { available: true, metric, labelAr: 'الأعلى حسب عدد الطلاب', items: mapItems(rows) };
  }

  if (metric === 'certificates') {
    const rows = await prisma.$queryRaw`
      SELECT org.id, org.name, org.name_en, org.type, COUNT(cert.id)::int AS value
      FROM organizations org
      LEFT JOIN universities uni ON uni.organization_id = org.id
      LEFT JOIN cohorts co ON co.university_id = uni.id
      LEFT JOIN certificates cert ON cert.cohort_id = co.id
        AND cert.status = 'issued'::certificate_status
        AND cert.issued_at >= ${period.periodStart}
        AND cert.issued_at < ${period.periodEnd}
      WHERE org.status = 'active'::organization_status
        ${orgTypeSql}
      GROUP BY org.id, org.name, org.name_en, org.type
      ORDER BY value DESC
      LIMIT 12
    `;
    return { available: true, metric, labelAr: 'الأعلى حسب الشهادات الصادرة', items: mapItems(rows) };
  }

  if (metric === 'trainingCompletion' && scope.modules.fieldTraining) {
    const rows = await prisma.$queryRaw`
      SELECT org.id, org.name, org.name_en, org.type,
        COUNT(*) FILTER (WHERE app.training_status IN ('completed'::field_training_training_status, 'eligible_for_completion'::field_training_training_status))::int AS value
      FROM organizations org
      JOIN universities uni ON uni.organization_id = org.id
      LEFT JOIN field_training_opportunities o ON o.university_id = uni.id
      LEFT JOIN field_training_applications app ON app.opportunity_id = o.id AND app.status = 'approved'::field_training_application_status
      WHERE org.status = 'active'::organization_status
        AND org.type = 'UNIVERSITY'::organization_type
      GROUP BY org.id, org.name, org.name_en, org.type
      ORDER BY value DESC
      LIMIT 12
    `;
    return { available: true, metric, labelAr: 'الأعلى حسب إتمام التدريب الميداني', items: mapItems(rows) };
  }

  const rows = await prisma.$queryRaw`
    SELECT org.id, org.name, org.name_en, org.type, COUNT(DISTINCT al.user_id)::int AS value
    FROM organizations org
    LEFT JOIN audit_logs al ON al.organization_id = org.id
      AND al.created_at >= ${period.periodStart}
      AND al.created_at < ${period.periodEnd}
      ${nonMeaningfulSql}
    WHERE org.status = 'active'::organization_status
      ${orgTypeSql}
    GROUP BY org.id, org.name, org.name_en, org.type
    ORDER BY value DESC
    LIMIT 12
  `;
  return { available: true, metric: 'activeUsers', labelAr: 'الأعلى حسب المستخدمين النشطين', items: mapItems(rows) };
}

function mapItems(rows) {
  return (rows || []).map((r) => ({
    id: r.id,
    nameAr: r.name,
    nameEn: r.name_en || r.name,
    type: r.type,
    value: intCount(r.value),
  }));
}

async function listFilterOrganizations(scope) {
  if (!scope.isGlobal) {
    if (!scope.organizationId) return [];
    const org = await prisma.organizations.findUnique({
      where: { id: scope.organizationId },
      select: { id: true, name: true, name_en: true, type: true },
    });
    return org ? [org] : [];
  }
  const where = { status: 'active' };
  if (scope.organizationType) where.type = scope.organizationType;
  return prisma.organizations.findMany({
    where,
    select: { id: true, name: true, name_en: true, type: true },
    orderBy: { name: 'asc' },
    take: 400,
  });
}

async function listFilterOpportunities(scope) {
  if (!scope.modules.fieldTraining) return [];
  const where = {
    status: { in: ['published', 'in_progress'] },
  };
  if (scope.opportunityId) where.id = scope.opportunityId;
  if (scope.universityId) {
    where.OR = [
      { university_id: scope.universityId },
      { field_training_opportunity_eligibility: { some: { university_id: scope.universityId, is_active: true } } },
    ];
  }
  return prisma.field_training_opportunities.findMany({
    where,
    select: { id: true, title: true, university_id: true, status: true },
    orderBy: { title: 'asc' },
    take: 200,
  });
}

module.exports = {
  getOrganizationAnalytics,
  listFilterOrganizations,
  listFilterOpportunities,
};
