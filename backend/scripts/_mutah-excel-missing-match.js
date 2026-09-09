'use strict';

const path = require('path');
const {
  parseSupervisorAssignmentWorkbook,
} = require('../src/modules/fieldTraining/fieldTraining.supervisorExcel.parse');

const FIXTURE = path.join(__dirname, '../tests/fixtures/mutah-field-training-supervisor-assignments.xlsx');

const WANT = [
  '120232222041', // ينال
  '120252222134', // Malak
  '120252222116', // ابرار
  '120252222154', // Noor
  '120212212023', // زيد
  '120232222149', // سلمى
  '120232222080', // عمر
  '120232211057', // أيمن
  '120232231055', // عهد
  '120232221095', // بشرى
];

(async () => {
  const parsed = await parseSupervisorAssignmentWorkbook(FIXTURE);
  console.log('excelRows', parsed.rows.length, 'error', parsed.error);
  for (const num of WANT) {
    const hit = parsed.rows.find((r) => String(r.universityNumber) === num);
    console.log(
      num,
      hit
        ? { name: hit.studentName, supervisor: hit.supervisorName, email: hit.universityEmail }
        : 'NOT_IN_EXCEL'
    );
  }
  const nums = new Set(parsed.rows.map((r) => String(r.universityNumber)));
  console.log('excelCount', nums.size);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
