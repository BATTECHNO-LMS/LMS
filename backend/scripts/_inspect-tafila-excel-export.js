'use strict';

require('dotenv').config();
const ExcelJS = require('exceljs');
const path = require('path');
const { prisma } = require('../src/config/db');

function cellText(cell) {
  const value = cell?.value;
  if (value == null) return '';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text || '').join('');
  }
  if (typeof value === 'object' && value.text) return String(value.text);
  return String(value);
}

async function main() {
  const id = '01666ebc-bfc1-4948-87a5-2add3f641c65';
  const apps = await prisma.field_training_applications.groupBy({
    by: ['status'],
    where: { opportunity_id: id },
    _count: true,
  });
  const eligibility = await prisma.field_training_applications.groupBy({
    by: ['completion_eligibility_status'],
    where: { opportunity_id: id, status: 'approved' },
    _count: true,
  });
  const file = path.join(__dirname, '../tmp/tafila-excel-evaluation/تقييم_التدريب_الميداني_جامعة_الطفيلة_التقنية.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  const headers = [];
  for (let i = 1; i <= ws.columnCount; i += 1) headers.push(cellText(ws.getRow(1).getCell(i)));
  const nameCol = headers.findIndex((text) => /اسم الطالب/.test(text)) + 1;
  const numCol = headers.findIndex((text) => /الرقم الجامعي/.test(text)) + 1;
  const uniCol = headers.findIndex((text) => text === 'الجامعة') + 1;
  const statusCol = headers.findIndex((text) => text === 'الحالة') + 1;
  const hoursCol = headers.findIndex((text) => /عدد الساعات/.test(text)) + 1;
  const commitmentCol = headers.findIndex((text) => /التزام الطالب/.test(text)) + 1;
  const reasonCol = headers.findIndex((text) => /سبب عدم التأهيل/.test(text)) + 1;
  const generalCol = headers.findIndex((text) => /التقييم العام/.test(text)) + 1;
  const supervisorCol = headers.findIndex((text) => /اسم الشخص المسؤول/.test(text)) + 1;
  const tasksCol = headers.findIndex((text) => /المهام التي قام الطالب/.test(text)) + 1;
  const rows = [];
  for (let r = 2; r <= ws.rowCount; r += 1) {
    rows.push({
      name: cellText(ws.getRow(r).getCell(nameCol)),
      number: cellText(ws.getRow(r).getCell(numCol)),
      uni: cellText(ws.getRow(r).getCell(uniCol)),
      status: cellText(ws.getRow(r).getCell(statusCol)),
      hours: cellText(ws.getRow(r).getCell(hoursCol)),
      hoursRaw: ws.getRow(r).getCell(hoursCol).value,
      commitment: ws.getRow(r).getCell(commitmentCol).value,
      supervisor: cellText(ws.getRow(r).getCell(supervisorCol)),
      tasks: cellText(ws.getRow(r).getCell(tasksCol)).slice(0, 80),
      reason: cellText(ws.getRow(r).getCell(reasonCol)).slice(0, 120),
      general: ws.getRow(r).getCell(generalCol).value,
    });
  }
  console.log(
    JSON.stringify(
      {
        apps,
        eligibility,
        sheet: ws.name,
        rtl: ws.views?.[0]?.rightToLeft,
        colCount: ws.columnCount,
        dataRows: ws.rowCount - 1,
        headers,
        hoursHeader: headers[hoursCol - 1],
        hoursCol,
        sample: rows.slice(0, 6),
        uniqueNumbers: [...new Set(rows.map((row) => row.number))].length,
        statuses: [...new Set(rows.map((row) => row.status))],
        universities: [...new Set(rows.map((row) => row.uni))],
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
