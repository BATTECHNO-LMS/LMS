'use strict';

/**
 * Tafila (online + onsite): mark students who completed required tasks
 * and the post-assessment as eligible, raise hours to 140 if needed,
 * then issue remaining completion letters.
 *
 *   node scripts/_tafila-convert-eligible-and-issue-letters.js
 *   node scripts/_tafila-convert-eligible-and-issue-letters.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const { recordAudit } = require('../src/utils/auditRecorder');
const hoursMod = require('../src/modules/fieldTraining/fieldTraining.hours');
const taskProgress = require('../src/modules/fieldTraining/fieldTraining.taskProgress');
const letterService = require('../src/modules/fieldTraining/fieldTraining.completionLetter.service');
const {
  MIN_COMPLETION_LETTER_HOURS,
} = require('../src/modules/fieldTraining/fieldTraining.completionLetter.template');

const APPLY = process.argv.includes('--apply');
const OPERATION_ID = 'TAFILA_POST_COMPLETE_ELIGIBLE_140H_ISSUE_LETTERS_V1';
const TAFILA_MARKERS = /الطفيلة|tafilah|tafila|\bttu\b/i;
const LETTER_BATCH = 3;
const TARGET_HOURS = MIN_COMPLETION_LETTER_HOURS;

function log(message) {
  process.stderr.write(`[${new Date().toISOString()}] ${message}\n`);
}

function looksLikeTafila(value) {
  return TAFILA_MARKERS.test(String(value || ''));
}

function isExpelled(app) {
  return app.training_status === 'expelled' || Boolean(app.expelled_at);
}

function tasksComplete(progress) {
  if (!progress) return false;
  if (progress.status === taskProgress.TASK_PROGRESS_STATUS.COMPLETED) return true;
  if (progress.status === taskProgress.TASK_PROGRESS_STATUS.NO_REQUIRED_TASKS) return true;
  return false;
}

function isRetryableLetterError(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return (
    code === 'P2028' ||
    code === 'P2024' ||
    code === 'P1017' ||
    /transaction|timed out|Can't reach database|Connection reset/i.test(msg)
  );
}

async function withLetterRetry(fn, tries = 4) {
  let last;
  for (let i = 1; i <= tries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isRetryableLetterError(err) || i === tries) throw err;
      log(`[letter-retry] ${err.code || ''} ${err.message} (${i}/${tries})`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * i));
    }
  }
  throw last;
}

async function findSuperAdminUser() {
  const rows = await prisma.$queryRaw`
    SELECT u.id, u.full_name, u.email
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  if (!rows[0]) throw new Error('No active super_admin');
  return {
    userId: rows[0].id,
    fullName: rows[0].full_name,
    email: rows[0].email,
    roles: ['super_admin'],
    isGlobal: true,
    universityId: null,
    organizationType: 'UNIVERSITY',
  };
}

async function findTafilaOpportunities() {
  const opportunities = await prisma.field_training_opportunities.findMany({
    include: {
      universities: { select: { id: true, name: true, name_en: true } },
      field_training_opportunity_eligibility: {
        where: { is_active: true },
        select: { universities: { select: { name: true } } },
        take: 4,
      },
    },
    orderBy: { created_at: 'asc' },
  });
  return opportunities.filter(
    (row) =>
      looksLikeTafila(row.title) ||
      looksLikeTafila(row.universities?.name) ||
      looksLikeTafila(row.universities?.name_en) ||
      looksLikeTafila(row.field_training_opportunity_eligibility?.[0]?.universities?.name)
  );
}

async function classifyOpportunity(opp) {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opp.id, status: 'approved' },
  });
  const tasks = await prisma.field_training_tasks.findMany({
    where: { opportunity_id: opp.id },
  });
  const submissions = apps.length
    ? await prisma.field_training_task_submissions.findMany({
        where: { application_id: { in: apps.map((row) => row.id) } },
      })
    : [];
  const letters = apps.length
    ? await prisma.field_training_completion_letters.findMany({
        where: { application_id: { in: apps.map((row) => row.id) }, status: 'issued' },
        select: { application_id: true, pdf_url: true },
      })
    : [];
  const letterByApp = new Map(letters.map((row) => [row.application_id, row]));
  const postAttempts = apps.length
    ? await prisma.field_training_assessment_attempts.findMany({
        where: {
          application_id: { in: apps.map((row) => row.id) },
          submitted_at: { not: null },
          field_training_assessments: { type: 'post' },
        },
        select: { application_id: true, score: true, submitted_at: true },
      })
    : [];
  const postByApp = new Map(postAttempts.map((row) => [row.application_id, row]));
  const subsByApp = new Map();
  for (const sub of submissions) {
    if (!subsByApp.has(sub.application_id)) subsByApp.set(sub.application_id, []);
    subsByApp.get(sub.application_id).push(sub);
  }

  const qualifying = [];
  const skipped = { expelled: 0, no_post: 0 };
  for (const app of apps) {
    if (isExpelled(app)) {
      skipped.expelled += 1;
      continue;
    }
    const progress = taskProgress.countProgressFromLoadedRows({
      application: app,
      tasks,
      submissions: subsByApp.get(app.id) || [],
    });
    const postAttempt = postByApp.get(app.id);
    const postScore = app.post_assessment_score != null ? Number(app.post_assessment_score) : null;
    const hasPost = Boolean(postAttempt?.submitted_at) || (postScore != null && !Number.isNaN(postScore));
    if (!hasPost) {
      skipped.no_post += 1;
      continue;
    }
    const currentHours = hoursMod.toNullableInt(app.completed_training_hours) || 0;
    const proposedHours = Math.max(currentHours, TARGET_HOURS);
    const alreadyEligible = app.completion_eligibility_status === 'eligible';
    const hoursNeedLift = currentHours < TARGET_HOURS;
    const letter = letterByApp.get(app.id);
    const hasLetter = Boolean(app.completion_letter_issued_at || letter?.pdf_url);
    qualifying.push({
      applicationId: app.id,
      studentId: app.student_id,
      currentHours,
      proposedHours,
      hoursNeedLift,
      alreadyEligible,
      needsEligibilityWrite: !alreadyEligible || hoursNeedLift,
      hasLetter,
      needsLetter: !hasLetter,
      tasks: `${progress.submitted_required}/${progress.total_required}`,
      post: postScore != null && !Number.isNaN(postScore) ? postScore : Number(postAttempt?.score),
    });
  }

  return {
    opportunity: {
      id: opp.id,
      title: opp.title,
      training_mode: opp.training_mode,
      university_id: opp.university_id || opp.universities?.id || null,
      university_name: opp.universities?.name || null,
    },
    approved: apps.length,
    skipped,
    qualifying,
  };
}

async function applyEligibility(user, classified) {
  const now = new Date();
  const updated = [];
  for (const row of classified.qualifying.filter((item) => item.needsEligibilityWrite)) {
    const current = await prisma.field_training_applications.findUnique({
      where: { id: row.applicationId },
      select: {
        id: true,
        status: true,
        expelled_at: true,
        training_status: true,
        completed_training_hours: true,
        completion_eligibility_status: true,
        hours_updated_by_id: true,
      },
    });
    if (!current || current.status !== 'approved' || current.expelled_at) continue;
    const terminal = ['completed', 'expelled', 'failed'].includes(current.training_status);
    const proposedHours = Math.max(
      hoursMod.toNullableInt(current.completed_training_hours) || 0,
      TARGET_HOURS
    );
    const data = {
      completed_training_hours: proposedHours,
      hours_updated_at: now,
      hours_updated_by_id: user.userId || current.hours_updated_by_id || null,
      completion_eligibility_status: 'eligible',
      eligibility_reason: {
        reasons: [],
        details: {
          conversion: OPERATION_ID,
          tasks: row.tasks,
          post_assessment_score: row.post,
          hours_set_to: proposedHours,
        },
      },
      updated_at: now,
    };
    if (!terminal) data.training_status = 'eligible_for_completion';
    await prisma.field_training_applications.update({ where: { id: current.id }, data });
    await recordAudit({
      userId: user.userId,
      universityId: classified.opportunity.university_id,
      actionType: OPERATION_ID,
      entityType: 'field_training_application',
      entityId: current.id,
      oldValues: {
        completed_training_hours: current.completed_training_hours,
        completion_eligibility_status: current.completion_eligibility_status,
      },
      newValues: {
        completed_training_hours: proposedHours,
        completion_eligibility_status: 'eligible',
        opportunity_id: classified.opportunity.id,
        training_mode: classified.opportunity.training_mode,
      },
    });
    updated.push(row.applicationId);
  }
  return updated;
}

async function issueLetters(user, classified) {
  const ids = classified.qualifying.filter((row) => row.needsLetter).map((row) => row.applicationId);
  const counts = { issued: 0, regenerated: 0, skipped: 0, previously_issued: 0, failed: 0 };
  const errors = [];
  if (!ids.length) return { to_issue: 0, counts, errors };
  for (let i = 0; i < ids.length; i += LETTER_BATCH) {
    const batch = ids.slice(i, i + LETTER_BATCH);
    for (const applicationId of batch) {
      try {
        const result = await withLetterRetry(() =>
          letterService.issueOne(applicationId, user.userId, user, { allowSkip: true })
        );
        counts[result.outcome] = (counts[result.outcome] || 0) + 1;
      } catch (err) {
        counts.failed += 1;
        errors.push({ applicationId, code: err.code, message: err.message });
        log(`[letter-error] ${applicationId} ${err.code || ''} ${err.message}`);
      }
    }
    log(
      `[letter] ${classified.opportunity.training_mode} ${Math.min(i + batch.length, ids.length)}/${ids.length}`
    );
  }
  return { to_issue: ids.length, counts, errors };
}

async function main() {
  log(`${OPERATION_ID} apply=${APPLY}`);
  const user = await findSuperAdminUser();
  const opportunities = await findTafilaOpportunities();
  if (opportunities.length !== 2) {
    log(`Expected 2 Tafila opportunities, found ${opportunities.length}`);
  }

  const report = {
    operation: OPERATION_ID,
    apply: APPLY,
    opportunities: [],
  };

  for (const opp of opportunities) {
    const classified = await classifyOpportunity(opp);
    const summary = {
      id: classified.opportunity.id,
      title: classified.opportunity.title,
      training_mode: classified.opportunity.training_mode,
      approved: classified.approved,
      skipped: classified.skipped,
      qualifying: classified.qualifying.length,
      to_mark_eligible: classified.qualifying.filter((row) => row.needsEligibilityWrite).length,
      to_issue_letters: classified.qualifying.filter((row) => row.needsLetter).length,
      already_have_letters: classified.qualifying.filter((row) => row.hasLetter).length,
    };
    log(
      `${opp.training_mode} approved=${summary.approved} qualify=${summary.qualifying} mark=${summary.to_mark_eligible} letters=${summary.to_issue_letters}`
    );

    let eligibilityUpdated = [];
    let letters = { skipped: true, reason: 'dry_run' };
    if (APPLY) {
      eligibilityUpdated = await applyEligibility(user, classified);
      letters = await issueLetters(user, classified);
    }
    report.opportunities.push({
      ...summary,
      eligibilityUpdated: eligibilityUpdated.length,
      letters,
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
