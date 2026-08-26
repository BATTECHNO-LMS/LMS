'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const {
  validatePlaceholderSet,
  gridCheckmarks,
  buildPlaceholderMap,
  applyPlaceholdersToXml,
  blank,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.placeholders');
const { fillUniversityLabelForm, detectUniversityLabelForm } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill');
const { fillDocxTemplate, extractDocxPlaceholders, assertDocxUpload } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.docx');
const {
  buildEvaluationPdfFilename,
  zipFolderForStatus,
  uniqueZipEntry,
  resolveUniversityNumber,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.filename');
const { buildReportsZip } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.zip');
const { CHECKMARK } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.constants');

describe('field training evaluation templates and placeholders', () => {
  it('validates required placeholder groups', () => {
    const missing = validatePlaceholderSet(['student_name']);
    assert.equal(missing.valid, false);
    assert.equal(missing.groups.find((g) => g.id === 'student_number').found, false);
    const ok = validatePlaceholderSet([
      'student_name',
      'student_number',
      'training_start_date',
      'training_end_date',
      'c1_1',
      'c10_5',
      'professional_evaluation_total',
      'general_comments',
    ]);
    assert.equal(ok.valid, true);
  });

  it('renders 1-5 checkmarks for criterion 1 = 4', () => {
    const grid = gridCheckmarks({ criterion1: 4 });
    assert.equal(grid.c1_1, '');
    assert.equal(grid.c1_2, '');
    assert.equal(grid.c1_3, '');
    assert.equal(grid.c1_4, CHECKMARK);
    assert.equal(grid.c1_5, '');
  });

  it('never writes literal undefined/null', () => {
    assert.equal(blank(undefined), '');
    assert.equal(blank(null), '');
    assert.equal(blank('undefined'), '');
    const map = buildPlaceholderMap({ student_name: 'أحمد', student_number: null, criterion_1_score: 4, criteria: { criterion1: 4 } });
    assert.equal(map.student_number, '');
    assert.equal(map.c1_4, CHECKMARK);
    const xml = applyPlaceholdersToXml('<w:t>{{student_number}}</w:t><w:t>{{student_name}}</w:t>', map);
    assert.equal(xml.includes('undefined'), false);
    assert.equal(xml.includes('أحمد'), true);
  });

  it('fills a DOCX without dropping other zip parts (stamps/images)', async () => {
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      '<w:document><w:t>{{student_name}}</w:t><w:t>{{c1_4}}</w:t><w:t>{{professional_evaluation_total}}</w:t></w:document>'
    );
    zip.file('word/media/stamp.png', Buffer.from([1, 2, 3, 4]));
    zip.file('[Content_Types].xml', '<Types/>');
    const source = await zip.generateAsync({ type: 'nodebuffer' });
    const filled = await fillDocxTemplate(source, buildPlaceholderMap({
      student_name: 'Ahmad',
      criteria: { criterion1: 4 },
      professional_evaluation_total: 40,
    }));
    const out = await JSZip.loadAsync(filled);
    assert.ok(out.file('word/media/stamp.png'), 'stamp image preserved');
    const xml = await out.file('word/document.xml').async('string');
    assert.match(xml, /Ahmad/);
    assert.match(xml, new RegExp(CHECKMARK));
    assert.match(xml, /40/);
  });

  it('rejects non-docx uploads', () => {
    assert.equal(assertDocxUpload({ originalName: 'x.pdf', mimeType: 'application/pdf', size: 10, buffer: Buffer.from('%PDF') }).ok, false);
    assert.equal(assertDocxUpload({ originalName: 'x.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 10, buffer: Buffer.from('PK') }).ok, true);
    assert.equal(assertDocxUpload({ originalName: 'x.docx', mimeType: 'application/zip', size: 10, buffer: Buffer.from('PK') }).ok, true);
  });

  it('extracts placeholders split across XML runs', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', '<w:t>{{stu</w:t><w:t>dent_name}}</w:t>');
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const found = await extractDocxPlaceholders(buf);
    assert.equal(found.has('student_name'), true);
  });

  it('fills Mutah-style Arabic label forms without {{placeholders}}', () => {
    const xml = `<?xml version="1.0"?><w:document>
      <w:tbl>
        <w:tr><w:tc><w:p><w:r><w:t>اسم الطالب:</w:t></w:r></w:p></w:tc></w:tr>
        <w:tr><w:tc><w:p><w:r><w:t>الرقم:</w:t></w:r></w:p></w:tc></w:tr>
      </w:tbl>
      <w:tbl>
        <w:tr>
          <w:tc><w:p><w:r><w:t>ضعيف1</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>متوسط2</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>جيد3</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>جيد جدا4</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>ممتاز5</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>مجال التقييم</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>الرقم</w:t></w:r></w:p></w:tc>
        </w:tr>
        <w:tr>
          <w:tc><w:p></w:p></w:tc><w:tc><w:p></w:p></w:tc><w:tc><w:p></w:p></w:tc>
          <w:tc><w:p></w:p></w:tc><w:tc><w:p></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>الكفاءة في أنجاز العمل</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>1.</w:t></w:r></w:p></w:tc>
        </w:tr>
        ${Array.from({ length: 9 }, (_, i) => `<w:tr>${'<w:tc><w:p></w:p></w:tc>'.repeat(5)}<w:tc><w:p><w:r><w:t>c</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${i + 2}.</w:t></w:r></w:p></w:tc></w:tr>`).join('')}
        <w:tr><w:tc><w:p><w:r><w:t>المجموع:</w:t></w:r></w:p></w:tc></w:tr>
      </w:tbl>
    </w:document>`;
    assert.equal(detectUniversityLabelForm(xml), true);
    const filled = fillUniversityLabelForm(xml, {
      student_name: 'أحمد خالد',
      student_number: '202312345',
      criterion_1_score: 4,
      professional_evaluation_total: 40,
    });
    assert.match(filled, /اسم الطالب: أحمد خالد/);
    assert.match(filled, /الرقم: 202312345/);
    assert.match(filled, new RegExp(CHECKMARK));
    assert.match(filled, /المجموع: 40/);
  });
});

describe('field training evaluation filenames and ZIP', () => {
  it('uses student name and university number, never the internal id', () => {
    const filename = buildEvaluationPdfFilename({
      studentName: 'Ahmad AlKhaldi',
      universityNumber: '202312345',
    });
    assert.equal(filename, 'Ahmad_AlKhaldi_202312345_FieldTrainingEvaluation.pdf');
    assert.equal(resolveUniversityNumber({ id: 'uuid-1', university_student_number: '202312345' }), '202312345');
    assert.equal(resolveUniversityNumber({ id: 'uuid-1', university_student_number: 'uuid-1' }), 'NA');
    assert.equal(resolveUniversityNumber({ id: 'uuid-1' }), 'NA');
  });

  it('sanitizes filesystem characters only', () => {
    const filename = buildEvaluationPdfFilename({ studentName: 'Sara/Ali:Test', universityNumber: '99' });
    assert.equal(filename.includes('/'), false);
    assert.equal(filename.includes(':'), false);
  });

  it('builds mixed ZIP folders and distinguishes duplicate names by university number', async () => {
    const { buffer, included } = await buildReportsZip(
      [
        { finalStatus: 'PASSED', filename: 'Ahmad_202312345_FieldTrainingEvaluation.pdf', buffer: Buffer.from('a') },
        { finalStatus: 'FAILED', filename: 'Mohammad_202312346_FieldTrainingEvaluation.pdf', buffer: Buffer.from('b') },
        { finalStatus: 'NOT_ELIGIBLE', filename: 'Sara_202312347_FieldTrainingEvaluation.pdf', buffer: Buffer.from('c') },
        { finalStatus: 'PASSED', filename: 'Ahmad_202399999_FieldTrainingEvaluation.pdf', buffer: Buffer.from('d') },
      ],
      { mixedFolders: true }
    );
    const zip = await JSZip.loadAsync(buffer);
    assert.ok(zip.file('Passed/Ahmad_202312345_FieldTrainingEvaluation.pdf'));
    assert.ok(zip.file('Failed/Mohammad_202312346_FieldTrainingEvaluation.pdf'));
    assert.ok(zip.file('Not_Eligible/Sara_202312347_FieldTrainingEvaluation.pdf'));
    assert.ok(zip.file('Passed/Ahmad_202399999_FieldTrainingEvaluation.pdf'));
    assert.equal(included.length, 4);
    assert.equal(zipFolderForStatus('PASSED'), 'Passed');
  });

  it('uses a flat ZIP when a single status is downloaded', async () => {
    const { buffer } = await buildReportsZip(
      [{ finalStatus: 'PASSED', filename: 'Ahmad_1_FieldTrainingEvaluation.pdf', buffer: Buffer.from('a') }],
      { mixedFolders: false }
    );
    const zip = await JSZip.loadAsync(buffer);
    assert.ok(zip.file('Ahmad_1_FieldTrainingEvaluation.pdf'));
    assert.equal(zip.file('Passed/Ahmad_1_FieldTrainingEvaluation.pdf'), null);
  });

  it('suffixes colliding filenames', () => {
    const used = new Set();
    const a = uniqueZipEntry(used, 'Passed', 'Ahmad_1_FieldTrainingEvaluation.pdf', true);
    const b = uniqueZipEntry(used, 'Passed', 'Ahmad_1_FieldTrainingEvaluation.pdf', true);
    assert.equal(a, 'Passed/Ahmad_1_FieldTrainingEvaluation.pdf');
    assert.equal(b, 'Passed/Ahmad_1_FieldTrainingEvaluation_2.pdf');
  });
});
