'use strict';

const { prisma } = require('../../config/db');
const { Prisma } = require('@prisma/client');
const { intCount, safePercent, round } = require('./analytics.percent');
const { scopeUsersSql } = require('./commandCenter.sql');

async function getContentCoursesAnalytics(scope, period) {
  const studentScope = scopeUsersSql(scope);

  const [published, enrollments, completed, startedInPeriod, popular] = await Promise.all([
    prisma.courses.count({ where: { status: 'published' } }),
    prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS enrollments,
        COUNT(*) FILTER (WHERE e.status = 'completed'::course_enrollment_status)::int AS completed,
        COUNT(DISTINCT e.student_id)::int AS learners
      FROM course_enrollments e
      JOIN users u ON u.id = e.student_id
      WHERE 1=1
        ${studentScope}
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS c
      FROM course_enrollments e
      JOIN users u ON u.id = e.student_id
      WHERE e.status = 'completed'::course_enrollment_status
        AND e.completed_at >= ${period.periodStart}
        AND e.completed_at < ${period.periodEnd}
        ${studentScope}
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS c
      FROM course_enrollments e
      JOIN users u ON u.id = e.student_id
      WHERE e.started_at >= ${period.periodStart}
        AND e.started_at < ${period.periodEnd}
        ${studentScope}
    `,
    prisma.$queryRaw`
      SELECT c.id, c.title, COUNT(*)::int AS enrollments,
        COUNT(*) FILTER (WHERE e.status = 'completed'::course_enrollment_status)::int AS completed
      FROM course_enrollments e
      JOIN courses c ON c.id = e.course_id
      JOIN users u ON u.id = e.student_id
      WHERE 1=1
        ${studentScope}
      GROUP BY c.id, c.title
      ORDER BY enrollments DESC
      LIMIT 5
    `,
  ]);

  const e = enrollments[0] || {};
  const enrollmentCount = intCount(e.enrollments);
  const completedCount = intCount(e.completed);

  const progressRows = await prisma.$queryRaw`
    SELECT AVG(pct)::float AS avg_progress
    FROM (
      SELECT
        CASE
          WHEN COUNT(cl.id) = 0 THEN NULL
          ELSE (COUNT(p.id) FILTER (WHERE p.is_completed = true)) * 100.0 / COUNT(cl.id)
        END AS pct
      FROM course_enrollments e
      JOIN users u ON u.id = e.student_id
      LEFT JOIN course_lessons cl ON cl.course_id = e.course_id AND cl.status = 'published'::course_lesson_status
      LEFT JOIN course_lesson_progress p
        ON p.lesson_id = cl.id AND p.student_id = e.student_id
      WHERE 1=1
        ${studentScope}
      GROUP BY e.id
    ) x
  `;

  return {
    kind: 'content_courses',
    publishedCourses: published,
    enrollments: enrollmentCount,
    activeLearners: intCount(e.learners),
    startedInPeriod: intCount(startedInPeriod[0]?.c),
    completedInPeriod: intCount(completed[0]?.c),
    completed: completedCount,
    completionRate: safePercent(completedCount, enrollmentCount, 1),
    averageProgress: round(progressRows[0]?.avg_progress, 1),
    mostPopular: popular.map((row) => ({
      id: row.id,
      title: row.title,
      enrollments: intCount(row.enrollments),
      completed: intCount(row.completed),
      completionRate: safePercent(row.completed, row.enrollments, 1),
    })),
  };
}

async function getTrainingProgramAnalytics(scope, period) {
  const orgFilter = scope.organizationId
    ? Prisma.sql`AND tp.organization_id = ${scope.organizationId}::uuid`
    : scope.organizationType === 'INSTITUTION'
      ? Prisma.sql`AND org.type = 'INSTITUTION'::organization_type`
      : Prisma.empty;

  const rows = await prisma.$queryRaw`
    SELECT
      COUNT(DISTINCT tp.id)::int AS programs,
      COUNT(te.id)::int AS enrollments,
      COUNT(*) FILTER (WHERE te.status IN ('ACTIVE'::training_enrollment_status, 'REQUIREMENTS_COMPLETED'::training_enrollment_status))::int AS active_learners,
      COUNT(*) FILTER (WHERE te.status = 'COMPLETED'::training_enrollment_status)::int AS completed
    FROM training_programs tp
    JOIN organizations org ON org.id = tp.organization_id
    LEFT JOIN training_cohorts tc ON tc.program_id = tp.id
    LEFT JOIN training_enrollments te ON te.cohort_id = tc.id
    WHERE tp.status IN (
      'PUBLISHED'::training_program_status,
      'REGISTRATION_OPEN'::training_program_status,
      'IN_PROGRESS'::training_program_status
    )
      ${orgFilter}
  `;
  const r = rows[0] || {};
  return {
    kind: 'institution_training_programs',
    publishedPrograms: intCount(r.programs),
    enrollments: intCount(r.enrollments),
    activeLearners: intCount(r.active_learners),
    completed: intCount(r.completed),
    completionRate: safePercent(r.completed, r.enrollments, 1),
  };
}

async function getMicroCredentialAnalytics(scope, period) {
  const uniFilter = scope.universityId
    ? Prisma.sql`AND co.university_id = ${scope.universityId}::uuid`
    : Prisma.empty;
  const mcFilter = scope.microCredentialId
    ? Prisma.sql`AND mc.id = ${scope.microCredentialId}::uuid`
    : Prisma.empty;

  if (scope.organizationType === 'INSTITUTION' && !scope.isGlobal) {
    return { available: false, reason: 'UNIVERSITY_SCOPED_PRODUCT' };
  }

  const [published, enroll, certs] = await Promise.all([
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS c
      FROM micro_credentials mc
      WHERE mc.status IN ('active'::micro_credential_status, 'approved'::micro_credential_status)
        ${mcFilter}
    `,
    prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS enrollments,
        COUNT(*) FILTER (WHERE e.enrollment_status = 'completed'::enrollment_status)::int AS completed,
        COUNT(DISTINCT e.student_id)::int AS learners
      FROM enrollments e
      JOIN cohorts co ON co.id = e.cohort_id
      JOIN micro_credentials mc ON mc.id = co.micro_credential_id
      WHERE 1=1
        ${uniFilter}
        ${mcFilter}
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS c
      FROM certificates cert
      JOIN cohorts co ON co.id = cert.cohort_id
      WHERE cert.status = 'issued'::certificate_status
        AND cert.issued_at >= ${period.periodStart}
        AND cert.issued_at < ${period.periodEnd}
        ${uniFilter}
        ${scope.microCredentialId ? Prisma.sql`AND cert.micro_credential_id = ${scope.microCredentialId}::uuid` : Prisma.empty}
    `,
  ]);

  const e = enroll[0] || {};
  return {
    available: true,
    publishedCredentials: intCount(published[0]?.c),
    enrollments: intCount(e.enrollments),
    activeLearners: intCount(e.learners),
    completed: intCount(e.completed),
    completionRate: safePercent(e.completed, e.enrollments, 1),
    certificatesIssuedInPeriod: intCount(certs[0]?.c),
  };
}

async function getCoursesAnalytics(scope, period) {
  const [content, training] = await Promise.all([
    getContentCoursesAnalytics(scope, period),
    scope.modules.trainingPrograms ? getTrainingProgramAnalytics(scope, period) : Promise.resolve(null),
  ]);
  return {
    contentCourses: content,
    trainingPrograms: training,
  };
}

module.exports = {
  getCoursesAnalytics,
  getMicroCredentialAnalytics,
  getContentCoursesAnalytics,
};
