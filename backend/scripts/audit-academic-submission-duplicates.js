'use strict';

/**
 * Read-only aggregate audit for academic submissions uniqueness.
 * Prints masked aggregates only — no PII, content, or raw IDs.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.submissions.count();

  const groups = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS uniqueness_groups
    FROM (
      SELECT assessment_id, student_id
      FROM submissions
      GROUP BY assessment_id, student_id
    ) g
  `;

  const dup = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS duplicate_groups,
      COALESCE(SUM(cnt), 0)::int AS rows_in_duplicate_groups,
      COALESCE(MAX(cnt), 0)::int AS max_rows_in_one_group
    FROM (
      SELECT assessment_id, student_id, COUNT(*)::int AS cnt
      FROM submissions
      GROUP BY assessment_id, student_id
      HAVING COUNT(*) > 1
    ) d
  `;

  const statusDist = await prisma.$queryRaw`
    SELECT s.status::text AS status, COUNT(*)::int AS cnt
    FROM submissions s
    INNER JOIN (
      SELECT assessment_id, student_id
      FROM submissions
      GROUP BY assessment_id, student_id
      HAVING COUNT(*) > 1
    ) d ON d.assessment_id = s.assessment_id AND d.student_id = s.student_id
    GROUP BY s.status
    ORDER BY cnt DESC
  `;

  const crossScope = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE uni_cnt > 1)::int AS dup_groups_cross_university,
      COUNT(*) FILTER (WHERE cohort_cnt > 1)::int AS dup_groups_cross_cohort
    FROM (
      SELECT d.assessment_id, d.student_id,
        COUNT(DISTINCT a.cohort_id)::int AS cohort_cnt,
        COUNT(DISTINCT c.university_id)::int AS uni_cnt
      FROM (
        SELECT assessment_id, student_id
        FROM submissions
        GROUP BY assessment_id, student_id
        HAVING COUNT(*) > 1
      ) d
      JOIN assessments a ON a.id = d.assessment_id
      JOIN cohorts c ON c.id = a.cohort_id
      GROUP BY d.assessment_id, d.student_id
    ) x
  `;

  const gradeRefs = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS dup_groups_with_grade
    FROM (
      SELECT d.assessment_id, d.student_id
      FROM (
        SELECT assessment_id, student_id
        FROM submissions
        GROUP BY assessment_id, student_id
        HAVING COUNT(*) > 1
      ) d
      WHERE EXISTS (
        SELECT 1 FROM grades g
        WHERE g.assessment_id = d.assessment_id AND g.student_id = d.student_id
      )
    ) y
  `;

  const report = {
    total_academic_submissions: total,
    uniqueness_groups: groups[0]?.uniqueness_groups ?? 0,
    duplicate_groups: dup[0]?.duplicate_groups ?? 0,
    rows_in_duplicate_groups: Number(dup[0]?.rows_in_duplicate_groups ?? 0),
    max_rows_in_one_group: dup[0]?.max_rows_in_one_group ?? 0,
    status_distribution_in_duplicate_groups: statusDist,
    dup_groups_cross_university: crossScope[0]?.dup_groups_cross_university ?? 0,
    dup_groups_cross_cohort: crossScope[0]?.dup_groups_cross_cohort ?? 0,
    dup_groups_with_any_grade: gradeRefs[0]?.dup_groups_with_grade ?? 0,
    grades_link_note: 'grades use assessment_id+student_id; no submission_id FK',
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error('AUDIT_ERROR', e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
