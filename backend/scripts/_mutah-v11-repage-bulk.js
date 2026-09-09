'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const { parseSupervisorAssignmentWorkbook } = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.parse');
const { buildReportsZip } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.zip');
const {
  reconcileZipUniversityNumbers,
  normalizeUniversityNumber,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.mutahExcelDelivery');

const OPPORTUNITY_ID = '6c8783ec-49fd-428e-83e2-8b65e52c3b4f';
const FIXTURE = path.join(__dirname, '../tests/fixtures/mutah-field-training-supervisor-assignments.xlsx');
const OUT_DIR = path.join(__dirname, '../tmp/mutah-v11-finalize');

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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const user = await findSuperAdminUser();
  const excel = await parseSupervisorAssignmentWorkbook(FIXTURE);
  const exportResult = await service.exportMutahExcelPopulationReports(user, OPPORTUNITY_ID, {
    excelRows: excel.rows,
    regenerate: true,
    regenerationReason: 'MUTAH_V11_TWO_PAGE_FINAL',
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
    regenerationReason: 'MUTAH_V11_TWO_PAGE_FINAL',
    finalize: true,
    mutahSoftDelivery: true,
  });

  const versions = await prisma.field_training_final_evaluations.groupBy({
    by: ['template_version', 'eligibility_status'],
    where: { opportunity_id: OPPORTUNITY_ID, is_current: true },
    _count: { _all: true },
  });
  const technicalFailures = [...(exportResult.results || []), ...(extra.results || [])].filter(
    (r) => r.generated === false || r.classification === 'FAILED_TECHNICAL'
  );
  const out = {
    summary: exportResult.summary,
    extra: extra.results,
    technicalFailures,
    versions,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'v11-repage-bulk.json'), JSON.stringify(out, null, 2), 'utf8');
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
