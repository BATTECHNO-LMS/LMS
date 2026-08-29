'use strict';

/**
 * Grade every eligible Field Training task submission with a deterministic
 * 80–90 integer percentage. Creates a rollback backup, then applies updates.
 *
 * Usage:
 *   node scripts/grade-field-training-task-submissions.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Prisma } = require('@prisma/client');
const { prisma } = require('../src/config/db');
const { recordAudit } = require('../src/utils/auditRecorder');
const hoursMod = require('../src/modules/fieldTraining/fieldTraining.hours');
const {
  markFromSubmissionId,
  toStoredScores,
  classifySubmission,
  wasPreviouslyGraded,
  computeEligibilityFromLoaded,
  eligibilityUpdateData,
} = require('./lib/gradeFieldTrainingTaskSubmissions');

const BATCH_SIZE = 100;
const ELIGIBILITY_ONLY = process.argv.includes('--eligibility-only');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

function log(message) {
  process.stdout.write(`${message}\n`);
}

function maskActor(actor) {
  if (!actor) return null;
  return {
    id: actor.id,
    role: 'super_admin',
    name: actor.full_name || null,
    status: actor.status || null,
  };
}

async function resolveGrader() {
  const role = await prisma.roles.findFirst({
    where: { code: 'super_admin' },
    select: { id: true, code: true },
  });
  if (!role) {
    throw new Error('No super_admin role exists in the database.');
  }
  const links = await prisma.user_roles.findMany({
    where: { role_id: role.id },
    select: { user_id: true },
  });
  const ids = [...new Set(links.map((row) => row.user_id))];
  if (!ids.length) {
    throw new Error('No user is assigned the super_admin role.');
  }
  const users = await prisma.users.findMany({
    where: { id: { in: ids } },
    select: { id: true, full_name: true, status: true, activated_at: true },
    orderBy: { created_at: 'asc' },
  });
  const active = users.find((u) => u.status === 'active') || users[0];
  if (!active) {
    throw new Error('No super_admin user record could be loaded.');
  }
  return active;
}

function emptyCounts() {
  return {
    cancelled_application: 0,
    draft_or_incomplete: 0,
    no_actual_submission: 0,
    expelled_before_submit: 0,
    invalid_orphan: 0,
  };
}

async function loadSubmissions() {
  return prisma.field_training_task_submissions.findMany({
    select: {
      id: true,
      task_id: true,
      application_id: true,
      student_id: true,
      file_path: true,
      project_url: true,
      solution_notes: true,
      final_student_notes: true,
      student_self_evaluation_input: true,
      submitted_at: true,
      review_status: true,
      instructor_feedback: true,
      manual_score: true,
      max_score: true,
      reviewed_by_id: true,
      reviewed_at: true,
      field_training_tasks: {
        select: {
          id: true,
          is_final_task: true,
          opportunity_id: true,
        },
      },
      field_training_applications: {
        select: {
          id: true,
          status: true,
          training_status: true,
          expelled_at: true,
          student_id: true,
          opportunity_id: true,
        },
      },
      field_training_task_submission_files: {
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { created_at: 'asc' },
  });
}

function buildBackupRow(row) {
  return {
    submission_id: row.id,
    previous_score: row.manual_score == null ? null : Number(row.manual_score),
    previous_percentage:
      row.manual_score != null && row.max_score
        ? Number(((Number(row.manual_score) / Number(row.max_score)) * 100).toFixed(4))
        : row.manual_score == null
          ? null
          : Number(row.manual_score),
    previous_status: row.review_status,
    previous_grader: row.reviewed_by_id,
    previous_grading_timestamp: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
  };
}

function writeBackup(eligible) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(BACKUP_DIR, `ft-task-submission-grades-rollback-${stamp}.json`);
  const payload = {
    created_at: new Date().toISOString(),
    kind: 'field_training_task_submission_grades',
    row_count: eligible.length,
    rows: eligible.map(buildBackupRow),
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return filePath;
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function persistEligibilityBatch(applicationIds) {
  const ids = [...new Set(applicationIds.filter(Boolean))];
  if (!ids.length) return 0;
  const apps = await prisma.field_training_applications.findMany({
    where: { id: { in: ids } },
    include: {
      field_training_opportunities: true,
      field_training_task_submissions: {
        include: { field_training_tasks: { select: { is_final_task: true } } },
      },
    },
  });
  const requiredByOpp = new Map(
    apps.map((app) => [
      app.opportunity_id,
      app.field_training_opportunities?.required_training_hours ?? null,
    ])
  );
  const hoursByApp = await hoursMod.calculateHoursProgressForApplications(
    apps.map((app) => ({ id: app.id, opportunity_id: app.opportunity_id })),
    requiredByOpp
  );

  const now = new Date();
  let updated = 0;
  for (const app of apps) {
    const result = computeEligibilityFromLoaded(app, hoursByApp.get(app.id) || null);
    await prisma.field_training_applications.update({
      where: { id: app.id },
      data: { ...eligibilityUpdateData(app, result), updated_at: now },
    });
    updated += 1;
    if (updated % 25 === 0 || updated === apps.length) {
      log(`Eligibility updated ${updated}/${apps.length}`);
    }
  }
  return updated;
}

async function loadEligibilityApplicationIds() {
  const rows = await prisma.field_training_task_submissions.findMany({
    where: {
      review_status: 'graded',
      reviewed_at: { gte: new Date('2026-08-29T11:33:00.000Z') },
    },
    select: { application_id: true },
    distinct: ['application_id'],
  });
  return rows.map((row) => row.application_id);
}

async function applyBatch(batch, graderId, gradedAt) {
  const valueRows = batch.map(
    (item) =>
      Prisma.sql`(${item.id}::uuid, ${item.manual_score}, ${item.max_score}, ${graderId}::uuid, ${gradedAt}::timestamptz)`
  );
  const finalAppIds = [
    ...new Set(batch.filter((item) => item.is_final_task).map((item) => item.application_id)),
  ];

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        UPDATE field_training_task_submissions AS s
        SET
          review_status = 'graded'::field_training_task_review_status,
          manual_score = v.manual_score,
          max_score = v.max_score,
          reviewed_by_id = v.reviewed_by_id,
          reviewed_at = v.reviewed_at,
          updated_at = v.reviewed_at
        FROM (
          VALUES ${Prisma.join(valueRows)}
        ) AS v(id, manual_score, max_score, reviewed_by_id, reviewed_at)
        WHERE s.id = v.id
      `;

      if (finalAppIds.length) {
        await tx.field_training_applications.updateMany({
          where: {
            id: { in: finalAppIds },
            training_status: { notIn: ['expelled'] },
          },
          data: { final_task_status: 'approved', updated_at: gradedAt },
        });
      }
    },
    { timeout: 120_000, maxWait: 20_000 }
  );
}

async function countFinalizedEvaluations(applicationIds) {
  if (!applicationIds.length) return 0;
  return prisma.field_training_final_evaluations.count({
    where: {
      application_id: { in: applicationIds },
      is_current: true,
      finalized_at: { not: null },
    },
  });
}

async function verifyDatabase(eligibleIds) {
  if (!eligibleIds.length) {
    return {
      remaining_outside_range: 0,
      min: null,
      max: null,
      distribution: {},
    };
  }
  const rows = await prisma.field_training_task_submissions.findMany({
    where: { id: { in: eligibleIds } },
    select: { id: true, manual_score: true, max_score: true, review_status: true },
  });
  const percents = rows.map((row) => {
    const max = Number(row.max_score) || 100;
    const score = Number(row.manual_score);
    return Math.round((score / max) * 100);
  });
  const distribution = {};
  for (let mark = 80; mark <= 90; mark += 1) distribution[mark] = 0;
  for (const pct of percents) {
    distribution[pct] = (distribution[pct] || 0) + 1;
  }
  const outside = percents.filter((pct) => pct < 80 || pct > 90).length;
  const ungraded = rows.filter((row) => row.review_status !== 'graded').length;
  return {
    remaining_outside_range: outside,
    ungraded_after: ungraded,
    min: percents.length ? Math.min(...percents) : null,
    max: percents.length ? Math.max(...percents) : null,
    distribution,
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  const grader = await resolveGrader();
  log(`Grader actor: super_admin ${grader.id} (${grader.full_name || 'unnamed'}, status=${grader.status})`);

  const inspected = await loadSubmissions();
  const excluded = emptyCounts();
  const eligible = [];

  for (const row of inspected) {
    const verdict = classifySubmission(row);
    if (!verdict.eligible) {
      excluded[verdict.reason] = (excluded[verdict.reason] || 0) + 1;
      continue;
    }
    const percent = markFromSubmissionId(row.id);
    const stored = toStoredScores(percent, row.max_score);
    eligible.push({
      id: row.id,
      application_id: row.application_id,
      student_id: row.student_id,
      opportunity_id:
        row.field_training_applications?.opportunity_id ||
        row.field_training_tasks?.opportunity_id ||
        null,
      is_final_task: Boolean(row.field_training_tasks?.is_final_task),
      training_status: row.field_training_applications?.training_status || null,
      previously_graded: wasPreviouslyGraded(row),
      percent: stored.percent,
      manual_score: stored.manual_score,
      max_score: stored.max_score,
      source: row,
    });
  }

  if (ELIGIBILITY_ONLY) {
    const applicationIds = await loadEligibilityApplicationIds();
    log(`Eligibility-only: recalculating ${applicationIds.length} applications…`);
    await persistEligibilityBatch(applicationIds);
    const finalizedEvaluations = await countFinalizedEvaluations(applicationIds);
    const verification = await verifyDatabase(eligible.map((item) => item.id));
    log('--- eligibility-only report ---');
    log(`Applications recalculated: ${applicationIds.length}`);
    log(`Eligible submissions currently in 80–90: ${eligible.length}`);
    log(`Min/Max: ${verification.min}/${verification.max}`);
    log(`Outside 80–90: ${verification.remaining_outside_range}`);
    log(`Finalized evaluations that may need manual regeneration: ${finalizedEvaluations}`);
    return;
  }

  const backupPath = writeBackup(eligible.map((item) => item.source));
  log(`Rollback backup written: ${backupPath} (${eligible.length} rows)`);

  const gradedAt = new Date();
  const batches = chunk(eligible, BATCH_SIZE);
  let graded = 0;
  try {
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      log(`Applying batch ${i + 1}/${batches.length} (${batch.length} submissions)…`);
      await applyBatch(batch, grader.id, gradedAt);
      graded += batch.length;
    }
  } catch (err) {
    log(`Batch failed after ${graded} successful updates. That batch was rolled back.`);
    throw err;
  }

  const appsById = new Map();
  for (const item of eligible) {
    if (!appsById.has(item.application_id)) {
      appsById.set(item.application_id, item.training_status);
    }
  }
  log(`Recalculating completion eligibility for ${appsById.size} applications…`);
  await persistEligibilityBatch([...appsById.keys()]);

  const applicationIds = [...appsById.keys()];
  const studentIds = new Set(eligible.map((item) => item.student_id));
  const opportunityIds = new Set(eligible.map((item) => item.opportunity_id).filter(Boolean));
  const overwritten = eligible.filter((item) => item.previously_graded).length;
  const distribution = {};
  for (let mark = 80; mark <= 90; mark += 1) distribution[mark] = 0;
  for (const item of eligible) distribution[item.percent] += 1;

  const verification = await verifyDatabase(eligible.map((item) => item.id));
  const finalizedEvaluations = await countFinalizedEvaluations(applicationIds);

  await recordAudit({
    userId: grader.id,
    actionType: 'FIELD_TRAINING_TASK_SUBMISSIONS_BULK_GRADED',
    entityType: 'field_training_task_submission',
    entityId: null,
    newValues: {
      type: 'field_training_task_submissions_bulk_grade',
      graded_count: graded,
      overwritten_count: overwritten,
      application_count: applicationIds.length,
      backup_file: path.basename(backupPath),
    },
  });

  const excludedTotal = Object.values(excluded).reduce((sum, n) => sum + n, 0);
  const report = {
    inspected: inspected.length,
    graded,
    excluded_total: excludedTotal,
    excluded_reasons: excluded,
    previously_graded_overwritten: overwritten,
    distribution,
    min_mark: verification.min,
    max_mark: verification.max,
    remaining_outside_range: verification.remaining_outside_range,
    ungraded_after: verification.ungraded_after,
    affected_students: studentIds.size,
    affected_opportunities: opportunityIds.size,
    rollback_file: backupPath,
    grader: maskActor(grader),
    finalized_evaluations_may_need_regeneration: finalizedEvaluations,
  };

  const reportPath = backupPath.replace('-rollback-', '-report-');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  log('--- execution report ---');
  log(`Inspected: ${report.inspected}`);
  log(`Graded: ${report.graded}`);
  log(`Excluded: ${report.excluded_total} ${JSON.stringify(report.excluded_reasons)}`);
  log(`Previously graded overwritten: ${report.previously_graded_overwritten}`);
  log(`Distribution 80–90: ${JSON.stringify(report.distribution)}`);
  log(`Min/Max: ${report.min_mark}/${report.max_mark}`);
  log(`Outside 80–90 after update: ${report.remaining_outside_range}`);
  log(`Still ungraded among eligible: ${report.ungraded_after}`);
  log(`Affected students: ${report.affected_students}`);
  log(`Affected opportunities: ${report.affected_opportunities}`);
  log(`Finalized evaluations that may need manual regeneration: ${report.finalized_evaluations_may_need_regeneration}`);
  log(`Rollback file: ${report.rollback_file}`);
  log(`Report file: ${reportPath}`);
}

main()
  .catch((err) => {
    console.error(err?.stack || err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
