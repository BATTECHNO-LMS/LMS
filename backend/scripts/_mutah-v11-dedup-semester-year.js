'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const { inspectFilledDocx } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.docx');
const { parseSupervisorAssignmentWorkbook } = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.parse');

const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
const FIXTURE = path.join(__dirname, '../tests/fixtures/mutah-field-training-supervisor-assignments.xlsx');
const OUT_DIR = path.join(__dirname, '../tmp/mutah-v11-semester-year-dedup');
const REASON = 'MUTAH_V11_SEMESTER_YEAR_DEDUP';
const EXTRA_IDS = [
  '216f81e3-b927-4977-8aef-85a42119ac17',
  '99eef60c-e498-40a7-9348-3e4bcff2bf46',
  'd81726e6-815d-43dd-8709-88357c14a6e5',
  '4c36f658-e7b8-45b7-affd-4fc80f68fa34',
  'ad0567a2-ddbc-47b7-af32-2f9aeb6a39a7',
];

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

function duplicationFlags(text) {
  const source = String(text || '').replace(/\s+/g, ' ');
  return {
    semesterDup: /الصيفي\s+الصيفي/.test(source) || (source.match(/الصيفي/g) || []).length > 1,
    yearDup: /2025-2026\s*:?\s*2025-2026/.test(source),
    semesterOk: /الفصل الدراسي:\s*الصيفي(?!\s*الصيفي)/.test(source),
    yearOk: /السنة الدراسية:\s*2025-2026(?!\s*:?\s*2025-2026)/.test(source),
  };
}

async function inspectApplication(user, applicationId) {
  const current = await prisma.field_training_final_evaluations.findFirst({
    where: { application_id: applicationId, is_current: true, template_version: 11 },
    select: {
      id: true,
      eligibility_status: true,
      professional_total: true,
      template_version: true,
      filled_docx_file_id: true,
      score_evidence_json: true,
    },
  });
  if (!current?.filled_docx_file_id) return { applicationId, stored: current, inspect: null };
  const downloaded = await service.downloadReport(user, current.id);
  const inspect = await inspectFilledDocx(downloaded.buffer);
  const zip = await JSZip.loadAsync(downloaded.buffer);
  const xml = await zip.file('word/document.xml').async('string');
  const cells = [...xml.matchAll(/<w:tc[\s>][\s\S]*?<\/w:tc>/g)].map((m) =>
    m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  );
  const semesterCell = cells.find((text) => /الفصل الدراسي/.test(text)) || '';
  const yearCell = cells.find((text) => /السنة الدراسية/.test(text)) || '';
  return {
    applicationId,
    evaluationId: current.id,
    eligibility: current.eligibility_status,
    pageCount: inspect.pageCount,
    checkmarks: inspect.checkmarks,
    days: current.score_evidence_json?.templatePayload?.training_days,
    semesterCell,
    yearCell,
    flags: duplicationFlags(`${semesterCell} ${yearCell}`),
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const user = await findSuperAdminUser();
  const excel = await parseSupervisorAssignmentWorkbook(FIXTURE);
  const exportResult = await service.exportMutahExcelPopulationReports(user, OPPORTUNITY_ID, {
    excelRows: excel.rows,
    regenerate: true,
    regenerationReason: REASON,
  });
  const extra = await service.generateForApplications(user, EXTRA_IDS, {
    regenerate: true,
    regenerationReason: REASON,
    finalize: true,
    mutahSoftDelivery: true,
  });

  const current = await prisma.field_training_final_evaluations.findMany({
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
    select: {
      application_id: true,
      eligibility_status: true,
      template_version: true,
      professional_total: true,
      criterion_1_score: true,
      score_evidence_json: true,
    },
  });
  const v11Current = current.filter((row) => Number(row.template_version) === 11);
  const samples = v11Current.slice(0, 2).concat(
    v11Current.filter((row) => row.eligibility_status === 'NOT_ELIGIBLE').slice(0, 1)
  );
  const uniqueSampleIds = [...new Set(samples.map((row) => row.application_id))];
  const qa = [];
  for (const applicationId of uniqueSampleIds) {
    qa.push(await inspectApplication(user, applicationId));
  }

  const technicalFailures = [...(exportResult.results || []), ...(extra.results || [])].filter(
    (r) => r.generated === false || r.classification === 'FAILED_TECHNICAL'
  );
  const out = {
    summary: exportResult.summary,
    extra: extra.results,
    technicalFailures,
    versions: await prisma.field_training_final_evaluations.groupBy({
      by: ['template_version', 'eligibility_status'],
      where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
      _count: { _all: true },
    }),
    qa,
    daysWrong: v11Current.filter(
      (row) => Number(row.score_evidence_json?.templatePayload?.training_days) !== 45
    ).length,
    notEligibleWrong: v11Current.filter(
      (row) =>
        row.eligibility_status === 'NOT_ELIGIBLE' &&
        (Number(row.professional_total) !== 10 || Number(row.criterion_1_score) !== 1)
    ).length,
    pageWrong: v11Current.filter((row) => Number(row.score_evidence_json?.generatedPageCount) !== 2).length,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'result.json'), JSON.stringify(out, null, 2), 'utf8');
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
