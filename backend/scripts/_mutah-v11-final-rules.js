'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const letterService = require('../src/modules/fieldTraining/fieldTraining.completionLetter.service');
const { inspectFilledDocx } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.docx');
const {
  countBidiVisual,
  cellPlainText,
  scoreGridHeaderCells,
  ratingColumnIndexForScore,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill');
const { parseSupervisorAssignmentWorkbook } = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.parse');

const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
const FIXTURE = path.join(__dirname, '../tests/fixtures/mutah-field-training-supervisor-assignments.xlsx');
const OUT_DIR = path.join(__dirname, '../tmp/mutah-v11-finalize');
const REASON = 'MUTAH_V11_FINAL_EVALUATION_RULES';

async function findSuperAdminUser() {
  const rows = await prisma.$queryRaw`
    SELECT u.id FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  return { userId: rows[0].id, roles: ['super_admin'], isGlobal: true, universityId: null };
}

async function setExpectedTrainingDays() {
  const opp = await prisma.field_training_opportunities.findUnique({
    where: { id: OPPORTUNITY_ID },
    select: { host_organization: true, title: true },
  });
  const current =
    opp?.host_organization && typeof opp.host_organization === 'object' ? opp.host_organization : {};
  await prisma.field_training_opportunities.update({
    where: { id: OPPORTUNITY_ID },
    data: {
      host_organization: { ...current, expectedTrainingDays: 45 },
      updated_at: new Date(),
    },
  });
  return { title: opp.title, expectedTrainingDays: 45 };
}

async function inspectDocx(buffer) {
  const inspect = await inspectFilledDocx(buffer);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');
  const score = [...xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)]
    .map((m) => m[0])
    .find((table) => /مجال التقييم/.test(cellPlainText(table)));
  const headers = scoreGridHeaderCells(score);
  const weakCol = ratingColumnIndexForScore(headers, 1);
  const rows = [...(score || '').matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].slice(1, 11);
  let weakCheckmarks = 0;
  rows.forEach((row) => {
    const cells = [...row[0].matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)];
    if (weakCol >= 0 && cells[weakCol] && cellPlainText(cells[weakCol][0]).includes('✓')) {
      weakCheckmarks += 1;
    }
  });
  return {
    pageCount: inspect.pageCount,
    lastRenderedPageBreaks: inspect.lastRenderedPageBreaks,
    checkmarks: inspect.checkmarks,
    stamp: inspect.hasOfficialStamp,
    signatures: inspect.hasSignatures,
    media: inspect.media.length,
    bidiVisual: countBidiVisual(score),
    weakCheckmarks,
    has45: /(?<![\d])45(?![\d])/.test(inspect.text) || /عدد الأيام[\s\S]{0,40}45/.test(inspect.text),
    hasTotal10: /المجموع:\s*10/.test(inspect.text),
    hasTotal0: /المجموع:\s*0/.test(inspect.text),
    notEligibleStatus: /حالة الطالب:\s*غير مؤهل/.test(inspect.text),
    eligibleFormal:
      /التقييم القبلي/.test(inspect.text) &&
      /البعدي/.test(inspect.text) &&
      /التسليمات/.test(inspect.text) &&
      /الحضور/.test(inspect.text),
    commentsSnippet: (inspect.text.match(/حالة الطالب:[\s\S]{0,220}/) || [''])[0].replace(/\s+/g, ' ').trim(),
  };
}

async function pickSample(status) {
  const rows = await prisma.field_training_applications.findMany({
    where: {
      opportunity_id: OPPORTUNITY_ID,
      status: 'approved',
      completion_eligibility_status: status,
    },
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      completed_training_hours: true,
      completion_eligibility_status: true,
      student_id: true,
    },
    take: 40,
  });
  const evals = await prisma.field_training_final_evaluations.findMany({
    where: {
      opportunity_id: OPPORTUNITY_ID,
      is_current: true,
      template_version: 11,
      application_id: { in: rows.map((row) => row.id) },
    },
    select: { application_id: true },
  });
  const v11 = new Set(evals.map((row) => row.application_id));
  const picked = rows.find((row) => v11.has(row.id));
  if (!picked) throw new Error(`No V11 ${status} Mutah sample found`);
  return picked;
}

async function generateAndInspect(user, applicationId) {
  const gen = await service.generateForApplications(user, [applicationId], {
    regenerate: true,
    regenerationReason: REASON,
    finalize: true,
    mutahSoftDelivery: true,
  });
  const row = gen.results[0] || {};
  const current = await prisma.field_training_final_evaluations.findFirst({
    where: { application_id: applicationId, is_current: true, template_version: 11 },
    select: {
      id: true,
      eligibility_status: true,
      professional_total: true,
      criterion_1_score: true,
      template_version: true,
      general_comments: true,
      score_evidence_json: true,
      filled_docx_file_id: true,
    },
  });
  if (!current?.id || !current.filled_docx_file_id) {
    return { generate: row, inspect: null, stored: current };
  }
  const downloaded = await service.downloadReport(user, current.id);
  const inspect = await inspectDocx(downloaded.buffer);
  return { generate: row, evaluationId: current.id, inspect, stored: current };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const user = await findSuperAdminUser();
  const days = await setExpectedTrainingDays();
  const eligibleApp = await pickSample('eligible');
  const notEligibleApp = await pickSample('ineligible');
  const eligibleQa = await generateAndInspect(user, eligibleApp.id);
  const notEligibleQa = await generateAndInspect(user, notEligibleApp.id);

  const excel = await parseSupervisorAssignmentWorkbook(FIXTURE);
  const exportResult = await service.exportMutahExcelPopulationReports(user, OPPORTUNITY_ID, {
    excelRows: excel.rows,
    regenerate: true,
    regenerationReason: REASON,
  });
  const extraIds = [
    '216f81e3-b927-4977-8aef-85a42119ac17',
    '99eef60c-e498-40a7-9348-3e4bcff2bf46',
    'd81726e6-815d-43dd-8709-88357c14a6e5',
    '4c36f658-e7b8-45b7-affd-4fc80f68fa34',
    'ad0567a2-ddbc-47b7-af32-2f9aeb6a39a7',
  ];
  const extra = await service.generateForApplications(user, extraIds, {
    regenerate: true,
    regenerationReason: REASON,
    finalize: true,
    mutahSoftDelivery: true,
  });

  const current = await prisma.field_training_final_evaluations.findMany({
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
    select: {
      eligibility_status: true,
      template_version: true,
      professional_total: true,
      criterion_1_score: true,
      general_comments: true,
      score_evidence_json: true,
    },
  });
  const v11Current = current.filter((row) => Number(row.template_version) === 11);
  const daysWrong = v11Current.filter(
    (row) => Number(row.score_evidence_json?.templatePayload?.training_days) !== 45
  );
  const notEligibleWrong = v11Current.filter(
    (row) =>
      row.eligibility_status === 'NOT_ELIGIBLE' &&
      (Number(row.professional_total) !== 10 || Number(row.criterion_1_score) !== 1)
  );
  const pageWrong = v11Current.filter((row) => Number(row.score_evidence_json?.generatedPageCount) !== 2);

  const preview = await letterService.previewBulkIssue(OPPORTUNITY_ID, user, {});
  let letters = { skipped: true, reason: 'already_current_or_none' };
  if ((preview.letters_to_issue || 0) > 0) {
    try {
      letters = await letterService.startBulkIssue(OPPORTUNITY_ID, user, { sync: true });
    } catch (err) {
      letters = { failed: true, code: err.code, message: err.message };
    }
  }

  const versions = await prisma.field_training_final_evaluations.groupBy({
    by: ['template_version', 'eligibility_status'],
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
    _count: { _all: true },
  });
  const letterCounts = await prisma.field_training_completion_letters.groupBy({
    by: ['status'],
    where: { opportunity_id: OPPORTUNITY_ID },
    _count: { _all: true },
  });
  const notEligibleLetters = await prisma.field_training_completion_letters.count({
    where: {
      opportunity_id: OPPORTUNITY_ID,
      status: 'issued',
      field_training_applications: { completion_eligibility_status: { not: 'eligible' } },
    },
  });
  const technicalFailures = [...(exportResult.results || []), ...(extra.results || [])].filter(
    (r) => r.generated === false || r.classification === 'FAILED_TECHNICAL'
  );

  const out = {
    days,
    eligibleQa,
    notEligibleQa,
    summary: exportResult.summary,
    extra: extra.results,
    technicalFailures,
    versions,
    qa: {
      currentCount: current.length,
      v11Count: v11Current.length,
      daysWrong: daysWrong.length,
      notEligibleWrong: notEligibleWrong.length,
      pageWrong: pageWrong.length,
    },
    lettersPreview: {
      eligible: preview.eligible,
      letters_to_issue: preview.letters_to_issue,
      notEligibleExcluded: preview.notEligibleExcluded,
      alreadyCurrent: preview.alreadyCurrent,
    },
    letters,
    letterCounts,
    notEligibleLetters,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'v11-final-rules.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
