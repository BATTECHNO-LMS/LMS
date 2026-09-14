'use strict';

const { prisma } = require('../../config/db');
const { Prisma } = require('@prisma/client');
const {
  STARTED_TRAINING_STATUSES,
  COMPLETED_TRAINING_STATUSES,
  ATTENDED_STATUSES,
  SCORE_BUCKETS,
} = require('./analytics.definitions');
const { intCount, safePercent, round } = require('./analytics.percent');
const { ftAppScopeSql, ftOppScopeSql } = require('./commandCenter.sql');

const officialEligibleSql = Prisma.sql`(
  COALESCE(
    UPPER(app.eligibility_reason #>> '{details,approvedEvaluationResult,approvedStatus}'),
    UPPER(app.completion_eligibility_status::text)
  ) IN ('ELIGIBLE')
)`;

/**
 * Funnel is CURRENT cohort state (not created_at-filtered).
 * Period does not drop historically active applications.
 * Opportunity + organization/university scope still apply.
 */
async function getFieldTrainingFunnel(scope) {
  const started = Prisma.join(STARTED_TRAINING_STATUSES.map((s) => Prisma.sql`${s}::field_training_training_status`));
  const completed = Prisma.join(
    COMPLETED_TRAINING_STATUSES.map((s) => Prisma.sql`${s}::field_training_training_status`)
  );

  const rows = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE app.status <> 'cancelled'::field_training_application_status)::int AS applications,
      COUNT(*) FILTER (WHERE app.status = 'approved'::field_training_application_status)::int AS approved,
      COUNT(*) FILTER (
        WHERE app.status = 'approved'::field_training_application_status
          AND (
            app.training_started_at IS NOT NULL
            OR app.training_status IN (${started})
          )
      )::int AS started,
      COUNT(*) FILTER (
        WHERE app.status = 'approved'::field_training_application_status
          AND app.training_status IN (${completed})
      )::int AS completed,
      COUNT(*) FILTER (
        WHERE app.status = 'approved'::field_training_application_status
          AND ${officialEligibleSql}
      )::int AS eligible
    FROM field_training_applications app
    WHERE 1=1
      ${ftAppScopeSql(scope)}
  `;

  const r = rows[0] || {};
  const applications = intCount(r.applications);
  const stages = [
    { key: 'applications', labelAr: 'قدموا طلبات', count: applications },
    { key: 'approved', labelAr: 'تمت الموافقة', count: intCount(r.approved) },
    { key: 'started', labelAr: 'بدأوا التدريب', count: intCount(r.started) },
    { key: 'completed', labelAr: 'أكملوا التدريب', count: intCount(r.completed) },
    { key: 'eligible', labelAr: 'مؤهلون', count: intCount(r.eligible) },
  ].map((s) => ({
    ...s,
    percentOfCohort: safePercent(s.count, applications, 1),
  }));

  return {
    semantics: 'current_cohort_state',
    source: 'field_training_applications + stored official eligibility overlay',
    stages,
  };
}

/**
 * Score distribution from current official evaluation snapshots.
 * Applications without a current final evaluation are excluded (not live-rescored).
 */
async function getScoreDistribution(scope) {
  const rows = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE fe.final_score < 60)::int AS lt60,
      COUNT(*) FILTER (WHERE fe.final_score >= 60 AND fe.final_score < 70)::int AS b60,
      COUNT(*) FILTER (WHERE fe.final_score >= 70 AND fe.final_score < 80)::int AS b70,
      COUNT(*) FILTER (WHERE fe.final_score >= 80 AND fe.final_score < 90)::int AS b80,
      COUNT(*) FILTER (WHERE fe.final_score >= 90 AND fe.final_score <= 100)::int AS b90
    FROM field_training_final_evaluations fe
    JOIN field_training_applications app ON app.id = fe.application_id
    WHERE fe.is_current = true
      AND fe.final_score IS NOT NULL
      ${scope.universityId ? Prisma.sql`AND fe.university_id = ${scope.universityId}::uuid` : Prisma.empty}
      ${scope.opportunityId ? Prisma.sql`AND fe.opportunity_id = ${scope.opportunityId}::uuid` : Prisma.empty}
      ${ftAppScopeSql(scope)}
  `;
  const r = rows[0] || {};
  const counts = {
    lt60: intCount(r.lt60),
    '60_69': intCount(r.b60),
    '70_79': intCount(r.b70),
    '80_89': intCount(r.b80),
    '90_100': intCount(r.b90),
  };
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return {
    source: 'field_training_final_evaluations.is_current',
    total,
    buckets: SCORE_BUCKETS.map((b) => ({
      key: b.key,
      labelAr: b.labelAr,
      min: b.min,
      max: b.max,
      count: counts[b.key] || 0,
      percent: safePercent(counts[b.key] || 0, total, 1),
    })),
  };
}

async function getAttendanceAnalytics(scope) {
  const attended = Prisma.join(ATTENDED_STATUSES.map((s) => Prisma.sql`${s}::field_training_attendance_status`));
  const rows = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE a.status IN (${attended}))::int AS present,
      COUNT(*) FILTER (WHERE a.status = 'absent'::field_training_attendance_status)::int AS absent,
      COUNT(*) FILTER (WHERE a.status = 'unconfirmed'::field_training_attendance_status)::int AS unspecified
    FROM field_training_attendance a
    JOIN field_training_applications app ON app.id = a.application_id
    WHERE 1=1
      ${ftAppScopeSql(scope)}
  `;
  const r = rows[0] || {};
  const total = intCount(r.total);
  const present = intCount(r.present);
  const absent = intCount(r.absent);
  const unspecified = intCount(r.unspecified);
  return {
    source: 'field_training_attendance',
    denominator: 'all recorded attendance rows (unconfirmed is not treated as absent)',
    total,
    present,
    absent,
    unspecified,
    attendanceRate: safePercent(present, total, 1),
  };
}

async function getAssessmentComparison(scope, period) {
  const rows = await prisma.$queryRaw`
    SELECT
      ta.type AS assessment_type,
      COUNT(att.id)::int AS submissions,
      AVG(CASE WHEN att.max_score > 0 THEN (att.score / att.max_score) * 100 END)::float AS avg_pct,
      COUNT(*) FILTER (
        WHERE att.max_score > 0 AND (att.score / att.max_score) * 100 >= 60
      )::int AS passed
    FROM field_training_assessment_attempts att
    JOIN field_training_assessments ta ON ta.id = att.assessment_id
    JOIN field_training_applications app ON app.id = att.application_id
    WHERE att.submitted_at IS NOT NULL
      AND att.submitted_at >= ${period.periodStart}
      AND att.submitted_at < ${period.periodEnd}
      ${ftAppScopeSql(scope)}
      ${scope.opportunityId ? Prisma.sql`AND ta.opportunity_id = ${scope.opportunityId}::uuid` : Prisma.empty}
    GROUP BY ta.type
  `;

  const pre = rows.find((r) => r.assessment_type === 'pre') || {};
  const post = rows.find((r) => r.assessment_type === 'post') || {};
  const preAvg = round(pre.avg_pct, 1);
  const postAvg = round(post.avg_pct, 1);
  const improvement =
    preAvg != null && postAvg != null ? round(postAvg - preAvg, 1) : null;

  return {
    source: 'field_training_assessment_attempts (submitted only)',
    note: 'PRE is a baseline metric and is not a Field Training final-score component.',
    pre: {
      average: preAvg,
      submissions: intCount(pre.submissions),
      passRate: safePercent(pre.passed, pre.submissions, 1),
    },
    post: {
      average: postAvg,
      submissions: intCount(post.submissions),
      passRate: safePercent(post.passed, post.submissions, 1),
    },
    improvementPoints: improvement,
  };
}

async function countOpportunities(scope) {
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS c
    FROM field_training_opportunities o
    WHERE o.status IN ('published'::field_training_opportunity_status, 'in_progress'::field_training_opportunity_status)
      ${ftOppScopeSql(scope)}
  `;
  return intCount(rows[0]?.c);
}

async function getFieldTrainingAnalytics(scope, period) {
  if (!scope.modules.fieldTraining) {
    return { available: false, reason: 'NOT_IN_SCOPE' };
  }

  const [funnel, scores, attendance, assessments, opportunities] = await Promise.all([
    getFieldTrainingFunnel(scope),
    getScoreDistribution(scope),
    getAttendanceAnalytics(scope),
    getAssessmentComparison(scope, period),
    countOpportunities(scope),
  ]);

  return {
    available: true,
    opportunities,
    funnel,
    scores,
    attendance,
    assessments,
  };
}

module.exports = {
  getFieldTrainingAnalytics,
  getFieldTrainingFunnel,
  getScoreDistribution,
  countOpportunities,
  officialEligibleSql,
};
