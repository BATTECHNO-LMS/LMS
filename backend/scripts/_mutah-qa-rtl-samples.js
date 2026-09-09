'use strict';

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');
const service = require('../src/modules/fieldTraining/fieldTrainingEvaluation.service');
const formFill = require('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill');
const { officialTemplatePath } = require('./lib/mutahOfficialEvaluationTemplate');
const { convertFilledDocxToPdf } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.pdf');
const { fillDocxTemplate } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.docx');
const { buildPlaceholderMap } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.placeholders');

(async () => {
  const summary = require('../tmp/mutah-excel98-export/export-summary.json');
  const elig = summary.results.find((r) => r.eligibilityStatus === 'ELIGIBLE');
  const notElig = summary.results.find((r) => r.eligibilityStatus === 'NOT_ELIGIBLE');
  const userRows = await prisma.$queryRaw`
    SELECT u.id, u.full_name, u.email
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  const user = {
    userId: userRows[0].id,
    fullName: userRows[0].full_name,
    email: userRows[0].email,
    roles: ['super_admin'],
    isGlobal: true,
    universityId: null,
  };
  const out = path.join(__dirname, '../tmp/mutah-excel98-export/qa');
  fs.mkdirSync(out, { recursive: true });
  for (const [label, row] of [
    ['eligible', elig],
    ['not_eligible', notElig],
  ]) {
    const pdf = await service.downloadPdf(user, row.evaluationId);
    fs.writeFileSync(path.join(out, `${label}.pdf`), pdf.buffer);
  }

  const template = fs.readFileSync(officialTemplatePath());
  const payload = {
    student_name: 'فحص اتجاه الجدول',
    student_number: '120232222080',
    student_specialty: 'علم البيانات',
    semester: 'الصيفي',
    academic_year: '2025-2026',
    training_start_date: '23 / 7 / 2026',
    training_end_date: '5 / 9 / 2026',
    training_days: 45,
    training_hours_display: 140,
    absence_days: 0,
    organization_name: 'شركة الرجل الوطواط',
    organization_department: 'قسم التدريب',
    organization_email: 'it@battechno.com',
    organization_phone: '06',
    organization_fax: '',
    organization_address: 'عمان',
    criterion_1_score: 1,
    criterion_2_score: 2,
    criterion_3_score: 3,
    criterion_4_score: 4,
    criterion_5_score: 5,
    criterion_6_score: 5,
    criterion_7_score: 5,
    criterion_8_score: 5,
    criterion_9_score: 5,
    criterion_10_score: 5,
    professional_evaluation_total: 45,
    eligibility_status: 'ELIGIBLE',
    eligibility_reasons: '',
    general_comments: 'حالة الطالب: مؤهل',
    field_supervisor_name: 'مشرف',
    responsible_person_name: 'زكريا الطراونه',
    academic_supervisor_name: 'زكريا الطراونه',
    evaluation_date: '2 / 9 / 2026',
    field_supervisor_date: '2 / 9 / 2026',
    academic_supervisor_date: '2 / 9 / 2026',
  };
  const filled = await fillDocxTemplate(template, buildPlaceholderMap(payload));
  fs.writeFileSync(path.join(out, 'rtl-check.docx'), filled);
  const zip = await JSZip.loadAsync(filled);
  const xml = await zip.file('word/document.xml').async('string');
  const score = [...xml.matchAll(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/g)]
    .map((m) => m[0])
    .find((t) => /مجال التقييم/.test(formFill.cellPlainText(t)));
  const headers = formFill.scoreGridHeaderCells(score);
  const pdf = await convertFilledDocxToPdf(filled, { expectedPageCount: 2 });
  fs.writeFileSync(path.join(out, 'rtl-check.pdf'), pdf);

  console.log(
    JSON.stringify(
      {
        eligible: elig.universityNumber,
        notEligible: notElig.universityNumber,
        headers,
        desired: formFill.assertDesiredScoreGridHeaderOrder(headers),
        hasTblpPr: /tblpPr/.test(score),
        hasBidiVisual: /bidiVisual/.test(score),
        pages: 2,
      },
      null,
      2
    )
  );
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
