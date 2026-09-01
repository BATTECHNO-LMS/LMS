'use strict';

/**
 * Mark Mutah Field Training students who finished the post-assessment
 * as eligible to issue a completion letter (status + hours >= 140).
 *
 * Skips expelled / failed / unapproved applications.
 *
 * Usage:
 *   node scripts/mark-mutah-post-complete-letter-eligible.js
 *   node scripts/mark-mutah-post-complete-letter-eligible.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const hoursMod = require('../src/modules/fieldTraining/fieldTraining.hours');
const { recordAudit } = require('../src/utils/auditRecorder');
const { extractUniversityNumberFromEmail } = require('../src/modules/fieldTraining/universityNumberFromEmail');
const { resolveOfficialUniversityNumber } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.universityNumber');

const APPLY = process.argv.includes('--apply');
const OPERATION_ID = 'FIELD_TRAINING_MUTAH_POST_COMPLETE_LETTER_ELIGIBLE_V1';
const TARGET_HOURS = 140;
const TERMINAL = new Set(['expelled', 'failed']);

async function findSuperAdminId() {
  const rows = await prisma.$queryRaw`
    SELECT u.id
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  return rows[0]?.id || null;
}

function universityNumberOf(student) {
  return (
    resolveOfficialUniversityNumber(student).number ||
    extractUniversityNumberFromEmail(student.email) ||
    ''
  );
}

async function main() {
  const opportunities = await prisma.field_training_opportunities.findMany({
    where: {
      OR: [
        { title: { contains: 'مؤتة' } },
        { universities: { name: { contains: 'مؤتة' } } },
      ],
    },
    select: { id: true, title: true, university_id: true },
  });
  if (!opportunities.length) throw new Error('لم يتم العثور على فرصة مؤتة');

  const oppIds = opportunities.map((o) => o.id);
  const apps = await prisma.field_training_applications.findMany({
    where: {
      opportunity_id: { in: oppIds },
      status: 'approved',
    },
  });

  const postAttempts = await prisma.field_training_assessment_attempts.findMany({
    where: {
      application_id: { in: apps.map((a) => a.id) },
      submitted_at: { not: null },
      field_training_assessments: { type: 'post' },
    },
    select: {
      application_id: true,
      id: true,
      score: true,
      submitted_at: true,
    },
  });
  const postByApp = new Map(postAttempts.map((row) => [row.application_id, row]));

  const studentIds = [...new Set(apps.map((a) => a.student_id))];
  const students = await prisma.users.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, full_name: true, email: true, university_student_number: true },
  });
  const studentById = Object.fromEntries(students.map((s) => [s.id, s]));
  const oppById = Object.fromEntries(opportunities.map((o) => [o.id, o]));

  const targets = [];
  const skipped = [];
  for (const app of apps) {
    const student = studentById[app.student_id] || {};
    const post = postByApp.get(app.id);
    const postScore = app.post_assessment_score != null ? Number(app.post_assessment_score) : null;
    const finishedPost = Boolean(post?.submitted_at) || postScore != null;
    const hours = hoursMod.toNullableInt(app.completed_training_hours) || 0;
    const alreadyReady = app.completion_eligibility_status === 'eligible' && hours >= TARGET_HOURS;
    const base = {
      applicationId: app.id,
      studentName: student.full_name || '—',
      email: student.email || '',
      universityNumber: universityNumberOf(student) || '—',
      opportunity: oppById[app.opportunity_id]?.title,
      training_status: app.training_status,
      eligibility: app.completion_eligibility_status,
      hours,
      postScore: postScore ?? (post?.score != null ? Number(post.score) : null),
      postAttemptId: post?.id || null,
    };

    if (!finishedPost) {
      skipped.push({ ...base, skip: 'post_not_completed' });
      continue;
    }
    if (app.expelled_at || TERMINAL.has(app.training_status)) {
      skipped.push({ ...base, skip: 'expelled_or_failed' });
      continue;
    }
    if (alreadyReady) {
      skipped.push({ ...base, skip: 'already_letter_eligible' });
      continue;
    }
    targets.push({
      ...base,
      newHours: Math.max(hours, TARGET_HOURS),
      newEligibility: 'eligible',
      newTrainingStatus: app.training_status === 'completed' ? 'completed' : 'eligible_for_completion',
    });
  }

  const report = {
    operation: OPERATION_ID,
    apply: APPLY,
    opportunities: opportunities.map((o) => o.title),
    finished_post: targets.length + skipped.filter((s) => s.skip === 'already_letter_eligible').length,
    already_letter_eligible: skipped.filter((s) => s.skip === 'already_letter_eligible').length,
    to_update: targets.length,
    skipped_expelled: skipped.filter((s) => s.skip === 'expelled_or_failed').length,
    targets: targets.map((t) => ({
      name: t.studentName,
      university_number: t.universityNumber,
      hours_before: t.hours,
      hours_after: t.newHours,
      eligibility_before: t.eligibility,
      post_score: t.postScore,
    })),
  };

  if (!APPLY) {
    console.log(JSON.stringify({ ...report, dry_run: true }, null, 2));
    return;
  }

  const actorUserId = await findSuperAdminId();
  const now = new Date();
  const updated = [];
  for (const item of targets) {
    await prisma.field_training_applications.update({
      where: { id: item.applicationId },
      data: {
        completed_training_hours: item.newHours,
        hours_updated_at: now,
        hours_updated_by_id: actorUserId,
        completion_eligibility_status: 'eligible',
        eligibility_reason: {
          reasons: [],
          details: {
            source: OPERATION_ID,
            post_attempt_id: item.postAttemptId,
            post_assessment_score: item.postScore,
            previous_hours: item.hours,
            previous_eligibility: item.eligibility,
          },
        },
        training_status: item.newTrainingStatus,
        updated_at: now,
      },
    });
    await recordAudit({
      userId: actorUserId,
      universityId: opportunities[0]?.university_id || null,
      actionType: OPERATION_ID,
      entityType: 'field_training_application',
      entityId: item.applicationId,
      oldValues: {
        completed_training_hours: item.hours,
        completion_eligibility_status: item.eligibility,
        training_status: item.training_status,
      },
      newValues: {
        completed_training_hours: item.newHours,
        completion_eligibility_status: 'eligible',
        training_status: item.newTrainingStatus,
        post_assessment_score: item.postScore,
      },
    });
    updated.push(item.applicationId);
  }

  console.log(JSON.stringify({ ...report, updated_count: updated.length }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
