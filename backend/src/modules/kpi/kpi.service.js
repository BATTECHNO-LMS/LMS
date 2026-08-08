'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { assertOrganizationAccess } = require('../../utils/organizationScope');

async function listDefinitions() {
  return prisma.kpi_definitions.findMany({
    where: { is_active: true },
    orderBy: { code: 'asc' },
  });
}

async function computeOrganizationKpis(requester, organizationId) {
  assertOrganizationAccess(requester, organizationId);

  const [members, pending, enrollments, completed, attendanceRows, expectedSessions] = await Promise.all([
    prisma.user_organization_assignments.count({
      where: { organization_id: organizationId, is_active: true },
    }),
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS c
      FROM user_organization_assignments uoa
      JOIN users u ON u.id = uoa.user_id
      WHERE uoa.organization_id = ${organizationId}::uuid
        AND uoa.is_active = true
        AND u.status = 'inactive'
        AND u.email_verified_at IS NOT NULL
    `,
    prisma.training_enrollments.count({ where: { organization_id: organizationId } }),
    prisma.training_enrollments.count({
      where: { organization_id: organizationId, status: 'COMPLETED' },
    }),
    prisma.training_attendance_records.count({
      where: {
        status: { in: ['present', 'late'] },
        training_enrollments: { organization_id: organizationId },
      },
    }).catch(() => 0),
    prisma.training_sessions.count({
      where: { training_cohorts: { organization_id: organizationId } },
    }).catch(() => 0),
  ]);

  const overdue = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS c
    FROM user_organization_assignments uoa
    JOIN users u ON u.id = uoa.user_id
    WHERE uoa.organization_id = ${organizationId}::uuid
      AND uoa.is_active = true
      AND u.status = 'inactive'
      AND u.email_verified_at IS NOT NULL
      AND u.email_verified_at <= (NOW() - INTERVAL '48 hours')
  `;

  const pendingCount = pending?.[0]?.c || 0;
  const overdueCount = overdue?.[0]?.c || 0;
  const activationRate = members ? ((members - pendingCount) / members) * 100 : 0;
  const completionRate = enrollments ? (completed / enrollments) * 100 : 0;
  const attendanceRate = expectedSessions ? (attendanceRows / Math.max(expectedSessions, 1)) * 100 : 0;

  const values = {
    active_trainees: enrollments,
    activation_rate: Number(activationRate.toFixed(2)),
    activation_overdue_48h: overdueCount,
    attendance_rate: Number(attendanceRate.toFixed(2)),
    completion_rate: Number(completionRate.toFixed(2)),
    at_risk_trainees: overdueCount,
  };

  const defs = await listDefinitions();
  const snapshots = [];
  for (const def of defs) {
    if (values[def.code] == null) continue;
    const snap = await prisma.kpi_snapshots.create({
      data: {
        kpi_id: def.id,
        organization_id: organizationId,
        value: values[def.code],
        sample_size: members,
      },
    });
    snapshots.push({
      code: def.code,
      nameAr: def.name_ar,
      value: Number(snap.value),
      sampleSize: snap.sample_size,
    });

    const target = await prisma.kpi_targets.findFirst({
      where: { kpi_id: def.id, organization_id: organizationId },
    });
    if (target) {
      const value = Number(snap.value);
      const targetValue = Number(target.target_value);
      const warnValue = target.warn_value != null ? Number(target.warn_value) : targetValue * 0.9;
      let status = 'ON_TARGET';
      if (value < warnValue) status = 'OFF_TARGET';
      else if (value < targetValue) status = 'AT_RISK';
      if (status !== 'ON_TARGET') {
        await prisma.kpi_alerts.create({
          data: {
            kpi_id: def.id,
            organization_id: organizationId,
            status,
            message: `${def.name_ar}: القيمة ${value} خارج الهدف ${targetValue}`,
            is_active: true,
          },
        });
      }
    }
  }

  return { organizationId, kpis: snapshots, values };
}

async function listAlerts(requester, organizationId) {
  assertOrganizationAccess(requester, organizationId);
  const rows = await prisma.kpi_alerts.findMany({
    where: { organization_id: organizationId, is_active: true },
    orderBy: { created_at: 'desc' },
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    message: r.message,
    createdAt: r.created_at,
  }));
}

async function setTarget(requester, organizationId, body) {
  assertOrganizationAccess(requester, organizationId);
  if (requester.roles?.includes('reviewer') && !requester.isGlobal) {
    throw new ApiError(403, 'Forbidden: reviewer is read-only');
  }
  const def = await prisma.kpi_definitions.findUnique({ where: { code: body.code } });
  if (!def) throw new ApiError(404, 'KPI not found');
  const row = await prisma.kpi_targets.create({
    data: {
      kpi_id: def.id,
      organization_id: organizationId,
      target_value: body.target_value,
      warn_value: body.warn_value ?? null,
    },
  });
  return { id: row.id, code: body.code, targetValue: Number(row.target_value) };
}

async function organizationReport(requester, organizationId) {
  assertOrganizationAccess(requester, organizationId);
  const [programs, cohorts, enrollments, certificates, kpis] = await Promise.all([
    prisma.training_programs.count({ where: { organization_id: organizationId } }),
    prisma.training_cohorts.count({ where: { organization_id: organizationId } }),
    prisma.training_enrollments.groupBy({
      by: ['status'],
      where: { organization_id: organizationId },
      _count: true,
    }),
    prisma.training_certificates.count({
      where: { organization_id: organizationId, status: 'ISSUED' },
    }),
    computeOrganizationKpis(requester, organizationId),
  ]);
  return {
    organizationId,
    programs,
    cohorts,
    enrollmentsByStatus: enrollments,
    certificatesIssued: certificates,
    kpis: kpis.kpis,
  };
}

module.exports = {
  listDefinitions,
  computeOrganizationKpis,
  listAlerts,
  setTarget,
  organizationReport,
};
