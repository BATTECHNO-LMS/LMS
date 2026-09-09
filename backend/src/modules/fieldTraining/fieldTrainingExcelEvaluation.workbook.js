'use strict';

const ExcelJS = require('exceljs');
const { SHEET_NAME, NEW_HEADERS } = require('./fieldTrainingExcelEvaluation.constants');

function cellText(cell) {
  const value = cell?.value;
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
    if (value.text) return String(value.text);
    if (value.result != null) return String(value.result);
  }
  return String(value);
}

function headerTexts(worksheet) {
  const row = worksheet.getRow(1);
  const count = Math.max(worksheet.columnCount || 0, row.cellCount || 0);
  const texts = [];
  for (let col = 1; col <= count; col += 1) {
    texts.push(cellText(row.getCell(col)).replace(/\s+/g, ' ').trim());
  }
  return texts;
}

function findColumn(headers, pattern) {
  return headers.findIndex((text) => pattern.test(text)) + 1;
}

function copyHeaderStyle(fromCell, toCell) {
  if (!fromCell || !toCell) return;
  toCell.font = { ...(fromCell.font || { name: 'Arial', size: 12, bold: true }), bold: true };
  toCell.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
    ...(fromCell.alignment || {}),
    wrapText: true,
  };
  if (fromCell.fill && fromCell.fill.type) toCell.fill = { ...fromCell.fill };
  if (fromCell.border) toCell.border = { ...fromCell.border };
}

function styleDataCell(cell, { wrap = false, align = 'center' } = {}) {
  cell.alignment = {
    horizontal: align,
    vertical: 'middle',
    wrapText: wrap,
    readingOrder: 'rtl',
  };
  cell.font = { name: 'Arial', size: 11 };
}

function insertColumn(worksheet, at, headerText, width) {
  worksheet.spliceColumns(at, 0, []);
  const header = worksheet.getRow(1);
  const source = header.getCell(Math.max(1, at - 1));
  const cell = header.getCell(at);
  cell.value = headerText;
  copyHeaderStyle(source, cell);
  worksheet.getColumn(at).width = width;
}

function ensureLayout(worksheet) {
  let headers = headerTexts(worksheet);
  let universityCol = findColumn(headers, /^الجامعة$/);
  const studentNumberCol = findColumn(headers, /الرقم الجامعي/);
  if (!universityCol && studentNumberCol) {
    insertColumn(worksheet, studentNumberCol + 1, NEW_HEADERS.university, 24);
    headers = headerTexts(worksheet);
    universityCol = findColumn(headers, /^الجامعة$/);
  }

  headers = headerTexts(worksheet);
  let statusCol = findColumn(headers, /^الحالة$/);
  let reasonCol = findColumn(headers, /سبب عدم التأهيل/);
  const generalCol = findColumn(headers, /التقييم العام/);
  if (!statusCol && generalCol) {
    insertColumn(worksheet, generalCol, NEW_HEADERS.status, 14);
    headers = headerTexts(worksheet);
    statusCol = findColumn(headers, /^الحالة$/);
  }
  headers = headerTexts(worksheet);
  reasonCol = findColumn(headers, /سبب عدم التأهيل/);
  statusCol = findColumn(headers, /^الحالة$/);
  if (!reasonCol && statusCol) {
    insertColumn(worksheet, statusCol + 1, NEW_HEADERS.ineligibilityReason, 36);
  }

  worksheet.views = [
    {
      ...(worksheet.views?.[0] || {}),
      workbookViewId: 0,
      rightToLeft: true,
      state: 'frozen',
      ySplit: 1,
      topLeftCell: 'A2',
    },
  ];
  worksheet.dataValidations.model = {};
  worksheet.getRow(1).height = Math.max(worksheet.getRow(1).height || 0, 72);
  worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  const nextHeaders = headerTexts(worksheet);
  const problemCols = [];
  nextHeaders.forEach((text, index) => {
    if (/ابتكار حلول للمشكلات/.test(text)) problemCols.push(index + 1);
  });
  return {
    supervisorName: findColumn(nextHeaders, /اسم الشخص المسؤول/),
    supervisorPhone: findColumn(nextHeaders, /رقم الموبايل/),
    supervisorEmail: findColumn(nextHeaders, /البريد الإلكتروني للمشرف/),
    studentName: findColumn(nextHeaders, /اسم الطالب/),
    universityNumber: findColumn(nextHeaders, /الرقم الجامعي/),
    university: findColumn(nextHeaders, /^الجامعة$/),
    hours: findColumn(nextHeaders, /عدد الساعات/),
    commitment: findColumn(nextHeaders, /التزام الطالب/),
    tasksOnTime: findColumn(nextHeaders, /في وقتها المحدد/),
    taskQuality: findColumn(nextHeaders, /بشكل صحيح/),
    learning: findColumn(nextHeaders, /التعلم وبناء مهارات/),
    cooperation: findColumn(nextHeaders, /تعاونا.? واحتراما/),
    teamwork: findColumn(nextHeaders, /تحمل المسؤولية/),
    communication: findColumn(nextHeaders, /التواصل والتعبير/),
    problemSolving: problemCols[0] || 0,
    problemSolvingDuplicate: problemCols[1] || problemCols[0] || 0,
    status: findColumn(nextHeaders, /^الحالة$/),
    ineligibilityReason: findColumn(nextHeaders, /سبب عدم التأهيل/),
    generalScore: findColumn(nextHeaders, /التقييم العام/),
    tasks: findColumn(nextHeaders, /المهام التي قام الطالب/),
    attachment: findColumn(nextHeaders, /رفع ملف بالمهام|اختياري/),
    headers: nextHeaders,
  };
}

async function fillExcelEvaluationWorkbook(templateBuffer, rows = []) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);
  const worksheet = workbook.worksheets.find((sheet) => sheet.name === SHEET_NAME) || workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel template sheet is missing');
  const cols = ensureLayout(worksheet);

  let rowNumber = 2;
  for (const row of rows) {
    const excelRow = worksheet.getRow(rowNumber);
    const set = (col, value, options) => {
      if (!col) return;
      const cell = excelRow.getCell(col);
      cell.value = value == null ? '' : value;
      styleDataCell(cell, options);
    };
    set(cols.supervisorName, row.supervisorName, { align: 'right', wrap: true });
    set(cols.supervisorPhone, row.supervisorPhone);
    set(cols.supervisorEmail, row.supervisorEmail, { align: 'left' });
    set(cols.studentName, row.studentName, { align: 'right', wrap: true });
    set(cols.universityNumber, row.universityNumber);
    set(cols.university, row.universityName, { align: 'right', wrap: true });
    set(cols.hours, row.hours);
    if (cols.hours) {
      const hoursCell = excelRow.getCell(cols.hours);
      if (typeof row.hours === 'string') hoursCell.numFmt = '@';
    }
    set(cols.commitment, row.ratings.commitment.score);
    set(cols.tasksOnTime, row.ratings.tasksOnTime.score);
    set(cols.taskQuality, row.ratings.taskQuality.score);
    set(cols.learning, row.ratings.learning.score);
    set(cols.cooperation, row.ratings.cooperation.score);
    set(cols.teamwork, row.ratings.teamwork.score);
    set(cols.communication, row.ratings.communication.score);
    set(cols.problemSolving, row.ratings.problemSolving.score);
    set(cols.problemSolvingDuplicate, row.ratings.problemSolvingDuplicate.score);
    set(cols.status, row.status);
    set(cols.ineligibilityReason, row.ineligibilityReason, { align: 'right', wrap: true });
    set(cols.generalScore, row.generalScore);
    set(cols.tasks, row.tasksText, { align: 'right', wrap: true });
    set(cols.attachment, row.attachment || '');
    excelRow.height = row.tasksText && String(row.tasksText).includes('\n') ? 48 : 22;
    excelRow.commit();
    rowNumber += 1;
  }

  const reasonCol = worksheet.getColumn(cols.ineligibilityReason || 18);
  reasonCol.alignment = { wrapText: true, vertical: 'middle' };
  const tasksCol = worksheet.getColumn(cols.tasks || 20);
  tasksCol.alignment = { wrapText: true, vertical: 'middle' };

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  cellText,
  headerTexts,
  findColumn,
  ensureLayout,
  fillExcelEvaluationWorkbook,
};
