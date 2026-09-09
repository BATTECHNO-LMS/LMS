'use strict';

/**
 * Unify Tafila's official evaluation template across all field-training
 * opportunities, generate remaining official post-evaluations for eligible
 * students, and issue remaining completion letters.
 *
 * Usage:
 *   node scripts/unify-tafila-template-convert-eligible.js
 *   node scripts/unify-tafila-template-convert-eligible.js --apply
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const evalService = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const letterService = require('../src/modules/fieldTraining/fieldTraining.completionLetter.service');
const { recordAudit } = require('../src/utils/auditRecorder');

const APPLY = process.argv.includes('--apply');
const OPERATION_ID = 'FIELD_TRAINING_UNIFY_TAFILA_TEMPLATE_CONVERT_ELIGIBLE_V1';
const TAFILA_MARKERS = /الطفيلة|tafilah|tafila|\bttu\b/i;
const EVAL_BATCH = 8;
const RATING_BATCH = 8;
const LETTER_BATCH = 4;
const REPORT_PATH = path.join(__dirname, '../tmp/unify-tafila-apply-report.json');

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  process.stderr.write(`${line}\n`);
}

function isRetryable(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || err || '');
  return (
    code === 'P1017' ||
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P2024' ||
    /closed the connection|Connection reset|Can't reach database|Timed out/i.test(msg)
  );
}

async function withRetry(label, fn, tries = 6) {
  let last;
  for (let i = 1; i <= tries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      log(`${label} failed (${i}/${tries}): ${err?.code || ''} ${err?.message || err}`);
      if (!isRetryable(err) || i === tries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2500 * i));
    }
  }
  throw last;
}

function looksLikeTafila(value) {
  return TAFILA_MARKERS.test(String(value || ''));
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
  };
}

async function findTafilaTemplate() {
  const unis = await prisma.universities.findMany({
    select: { id: true, name: true, name_en: true, code: true },
  });
  const tafila = unis.find(
    (u) => looksLikeTafila(u.name) || looksLikeTafila(u.name_en) || looksLikeTafila(u.code)
  );
  if (!tafila) throw new Error('لم يتم العثور على جامعة الطفيلة التقنية');

  const template = await prisma.field_training_evaluation_templates.findFirst({
    where: {
      university_id: tafila.id,
      is_default: true,
      is_active: true,
      archived_at: null,
      validation_status: 'valid',
    },
    orderBy: { version: 'desc' },
  });
  if (!template) throw new Error('لم يتم العثور على قالب الطفيلة الافتراضي الصالح');
  return { tafila, template };
}

function summarizeResults(rows) {
  const generated = rows.filter((r) => r.generated).length;
  const reused = rows.filter((r) => r.reused || r.code === 'ALREADY_GENERATED').length;
  const missing = rows.filter((r) => r.code === 'DATA_INCOMPLETE' || r.code === 'PROFESSIONAL_INCOMPLETE').length;
  const failed = rows.filter((r) => !r.generated && !r.reused && r.code !== 'ALREADY_GENERATED').length;
  return { generated, reused, missing, failed, total: rows.length };
}

async function unifyTemplates(user, template, opportunities) {
  const before = opportunities.map((o) => ({
    id: o.id,
    title: o.title,
    evaluation_template_id: o.evaluation_template_id,
  }));
  if (!APPLY) {
    return {
      applied: false,
      before,
      after: before.map((o) => ({ ...o, evaluation_template_id: template.id })),
      updated: opportunities.filter((o) => o.evaluation_template_id !== template.id).length,
    };
  }

  const updated = [];
  for (const opp of opportunities) {
    if (opp.evaluation_template_id === template.id) continue;
    await evalService.assignOpportunityTemplate(user, opp.id, template.id);
    updated.push(opp.id);
    await recordAudit({
      userId: user.userId,
      universityId: template.university_id,
      actionType: OPERATION_ID,
      entityType: 'field_training_opportunity',
      entityId: opp.id,
      oldValues: { evaluation_template_id: opp.evaluation_template_id },
      newValues: { evaluation_template_id: template.id, template_name: template.name },
    });
  }
  const afterRows = await prisma.field_training_opportunities.findMany({
    select: { id: true, title: true, evaluation_template_id: true },
    orderBy: { created_at: 'asc' },
  });
  return { applied: true, before, after: afterRows, updated: updated.length, updatedIds: updated };
}

async function remainingEligibleApps(opportunityId) {
  const apps = await prisma.field_training_applications.findMany({
    where: {
      opportunity_id: opportunityId,
      status: 'approved',
      completion_eligibility_status: 'eligible',
      expelled_at: null,
      training_status: { not: 'expelled' },
    },
    select: {
      id: true,
      completed_training_hours: true,
      completion_letter_issued_at: true,
      post_assessment_score: true,
    },
  });
  const evals = apps.length
    ? await prisma.field_training_final_evaluations.findMany({
        where: { application_id: { in: apps.map((a) => a.id) }, is_current: true },
        select: { application_id: true, filled_docx_file_id: true, template_id: true },
      })
    : [];
  const evalByApp = new Map(evals.map((e) => [e.application_id, e]));
  const letters = apps.length
    ? await prisma.field_training_completion_letters.findMany({
        where: { application_id: { in: apps.map((a) => a.id) }, status: 'issued' },
        select: { application_id: true, pdf_url: true },
      })
    : [];
  const letterByApp = new Map(letters.map((l) => [l.application_id, l]));

  return apps.map((app) => {
    const ev = evalByApp.get(app.id);
    const letter = letterByApp.get(app.id);
    return {
      id: app.id,
      hours: app.completed_training_hours != null ? Number(app.completed_training_hours) : 0,
      hasPost: app.post_assessment_score != null,
      needsEval: !ev?.filled_docx_file_id,
      needsLetter: !app.completion_letter_issued_at && !letter,
      currentTemplateId: ev?.template_id || null,
    };
  });
}

async function convertRemainingEvals(user, opportunityId, applicationIds) {
  if (!applicationIds.length) {
    return { skipped: true, reason: 'none_remaining', summary: summarizeResults([]) };
  }
  if (!APPLY) {
    return { skipped: true, reason: 'dry_run', remaining: applicationIds.length };
  }

  let studentsAffected = 0;
  let ratingsApplied = 0;
  for (let i = 0; i < applicationIds.length; i += RATING_BATCH) {
    const batch = applicationIds.slice(i, i + RATING_BATCH);
    const bulk = await withRetry(`bulk-ratings ${i + 1}-${i + batch.length}`, () =>
      evalService.applyBulkEligibleProfessionalRatings(user, opportunityId, {
        confirmed: true,
        application_ids: batch,
        reason: 'اعتماد البنود المهنية الناقصة للطلاب المؤهلين قبل إصدار التقييم البعدي وكتاب الإنهاء',
      })
    );
    studentsAffected += bulk.studentsAffected || 0;
    ratingsApplied += bulk.ratingsApplied || 0;
    log(
      `[ratings] ${opportunityId} ${Math.min(i + batch.length, applicationIds.length)}/${applicationIds.length} affected=${bulk.studentsAffected}`
    );
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  const results = [];
  for (let i = 0; i < applicationIds.length; i += EVAL_BATCH) {
    const batch = applicationIds.slice(i, i + EVAL_BATCH);
    const out = await withRetry(`generate-evals ${i + 1}-${i + batch.length}`, () =>
      evalService.generateForApplications(user, batch, {
        regenerate: false,
        finalize: true,
      })
    );
    results.push(...(out.results || []));
    log(`[eval] ${opportunityId} ${Math.min(i + batch.length, applicationIds.length)}/${applicationIds.length}`);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return {
    skipped: false,
    bulkRatings: { studentsAffected, ratingsApplied },
    summary: summarizeResults(results),
    errors: results
      .filter((r) => !r.generated && !r.reused)
      .slice(0, 25)
      .map((r) => ({
        applicationId: r.applicationId,
        name: r.studentName,
        code: r.code,
        missing: r.missingFields,
      })),
  };
}

async function issueRemainingLetters(user, opportunityId) {
  const preview = await withRetry(`preview-letters ${opportunityId}`, () =>
    letterService.previewBulkIssue(opportunityId, user)
  );
  const ids = preview.to_issue_ids || [];
  if (!APPLY) {
    return {
      skipped: true,
      reason: 'dry_run',
      to_issue: ids.length,
      already_current: preview.already_current,
      ineligible: preview.ineligible,
    };
  }
  if (!ids.length) {
    return { skipped: true, reason: 'no_eligible_or_already_issued', to_issue: 0 };
  }

  const counts = { issued: 0, regenerated: 0, skipped: 0, previously_issued: 0, failed: 0 };
  const errors = [];
  for (let i = 0; i < ids.length; i += LETTER_BATCH) {
    const batch = ids.slice(i, i + LETTER_BATCH);
    for (const applicationId of batch) {
      try {
        const result = await withRetry(`letter ${applicationId}`, () =>
          letterService.issueOne(applicationId, user.userId, user, { allowSkip: true })
        );
        counts[result.outcome] = (counts[result.outcome] || 0) + 1;
      } catch (err) {
        counts.failed += 1;
        errors.push({ applicationId, code: err.code, message: err.message });
        log(`[letter-error] ${applicationId} ${err.code || ''} ${err.message}`);
      }
    }
    log(`[letter] ${opportunityId} ${Math.min(i + batch.length, ids.length)}/${ids.length}`);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return { skipped: false, to_issue: ids.length, counts, errors: errors.slice(0, 25) };
}

async function main() {
  log(`Starting ${OPERATION_ID} apply=${APPLY}`);
  const user = await findSuperAdminUser();
  const { tafila, template } = await findTafilaTemplate();
  const opportunities = await prisma.field_training_opportunities.findMany({
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      title: true,
      status: true,
      evaluation_template_id: true,
    },
  });

  const templateReport = await withRetry('unify-templates', () => unifyTemplates(user, template, opportunities));

  const perOpportunity = [];
  for (const opp of opportunities) {
    const remaining = await withRetry(`remaining ${opp.id}`, () => remainingEligibleApps(opp.id));
    const needEval = remaining.filter((r) => r.needsEval).map((r) => r.id);
    const needLetter = remaining.filter((r) => r.needsLetter && r.hours >= 140);
    const evalResult = await convertRemainingEvals(user, opp.id, needEval);
    const letterResult = await issueRemainingLetters(user, opp.id);
    perOpportunity.push({
      id: opp.id,
      title: opp.title,
      eligible: remaining.length,
      remaining_evals: needEval.length,
      remaining_letters: needLetter.length,
      evals: evalResult,
      letters: letterResult,
    });
  }

  const afterOpps = await prisma.field_training_opportunities.findMany({
    select: { id: true, title: true, evaluation_template_id: true },
  });
  const sharingTafila = afterOpps.filter((o) => o.evaluation_template_id === template.id).length;

  const report = {
    operation: OPERATION_ID,
    apply: APPLY,
    tafila: { id: tafila.id, name: tafila.name },
    template: {
      id: template.id,
      name: template.name,
      version: template.version,
      university_id: template.university_id,
    },
    template_unification: templateReport,
    opportunities_sharing_tafila_template: sharingTafila,
    opportunities_total: afterOpps.length,
    per_opportunity: perOpportunity,
    totals: {
      remaining_evals: perOpportunity.reduce((n, o) => n + o.remaining_evals, 0),
      remaining_letters: perOpportunity.reduce((n, o) => n + o.remaining_letters, 0),
      evals_generated: perOpportunity.reduce((n, o) => n + (o.evals.summary?.generated || 0), 0),
      evals_reused: perOpportunity.reduce((n, o) => n + (o.evals.summary?.reused || 0), 0),
      evals_failed: perOpportunity.reduce((n, o) => n + (o.evals.summary?.failed || 0), 0),
    },
  };

  console.log(JSON.stringify(report, null, 2));
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  log(`Wrote report ${REPORT_PATH}`);
  if (!APPLY) {
    log('Dry-run only. Re-run with --apply to write.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
