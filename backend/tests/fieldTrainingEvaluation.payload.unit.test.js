'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('path');
const {
  buildFieldTrainingEvaluationTemplatePayload,
  missingRequiredIdentityFields,
  publicPreviewPayload,
  academicPeriod,
  summarizeAttendance,
  DATA_INCOMPLETE_CODE,
} = require('../src/modules/fieldTraining/fieldTrainingEvaluation.payload');
const { buildEvaluationPdfFilename } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.filename');
const { fillUniversityLabelForm, matchLabelKey } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.formFill');
const { buildPlaceholderMap } = require('../src/modules/fieldTraining/fieldTrainingEvaluation.placeholders');

const studentAr = {
  id: '11111111-1111-1111-1111-111111111111',
  full_name: 'راما بكر عبد الجليل الجلامده',
  university_student_number: '202312345',
  university_specialty: { name_ar: 'الأمن السيبراني', name_en: 'Cybersecurity' },
};

const studentEn = {
  id: '22222222-2222-2222-2222-222222222222',
  full_name: 'Ahmad Khaled',
  university_student_number: '20190012',
  specialty: { name_ar: 'هندسة البرمجيات', name_en: 'Software Engineering' },
};

const opportunity = {
  start_date: new Date('2026-07-23T00:00:00.000Z'),
  end_date: new Date('2026-09-05T00:00:00.000Z'),
  organization_name: 'شركة الاختبار',
  required_training_hours: 140,
};

const application = {
  completed_training_hours: 0,
  attendance_percentage: 100,
  completion_eligibility_status: 'eligible',
};

const attendanceRows = [
  {
    status: 'present',
    session_id: 's1',
    field_training_sessions: { id: 's1', start_time: '08:00', end_time: '15:00' },
  },
  {
    status: 'present',
    session_id: 's2',
    field_training_sessions: { id: 's2', start_time: '08:00', end_time: '15:00' },
  },
  { status: 'absent', session_id: 's3' },
];

describe('field training evaluation template payload', () => {
  it('maps Arabic student name, university number, and specialty from the profile', () => {
    const payload = buildFieldTrainingEvaluationTemplatePayload({
      student: studentAr,
      application,
      opportunity,
      attendanceRows,
    });
    assert.equal(payload.student_name, 'راما بكر عبد الجليل الجلامده');
    assert.equal(payload.student_number, '202312345');
    assert.equal(payload.student_specialty, 'الأمن السيبراني');
    assert.equal(missingRequiredIdentityFields(payload).length, 0);
  });

  it('maps an English student name without inventing a new naming convention', () => {
    const payload = buildFieldTrainingEvaluationTemplatePayload({
      student: studentEn,
      application,
      opportunity,
      attendanceRows,
    });
    assert.equal(payload.student_name, 'Ahmad Khaled');
    assert.equal(payload.student_specialty, 'هندسة البرمجيات');
  });

  it('maps semester and academic year from the stored opportunity start date', () => {
    const period = academicPeriod(opportunity.start_date);
    assert.equal(period.semester, 'الصيفي');
    assert.equal(period.academicYear, '2025/2026');
    const payload = buildFieldTrainingEvaluationTemplatePayload({ student: studentAr, application, opportunity });
    assert.equal(payload.semester, 'الصيفي');
    assert.equal(payload.academic_year, '2025/2026');
    assert.equal(payload.training_start_date, '23/07/2026');
    assert.equal(payload.training_end_date, '05/09/2026');
  });

  it('maps attendance days, absence, hours, and percentage from Field Training records', () => {
    const hours = summarizeAttendance(attendanceRows, application);
    assert.equal(hours.attendedDays, 2);
    assert.equal(hours.absenceDays, 1);
    assert.equal(hours.actualHours, 14);
    assert.equal(hours.actualDailyHours, 7);
    assert.equal(hours.attendancePercentage, 100);
    const payload = buildFieldTrainingEvaluationTemplatePayload({
      student: studentAr,
      application,
      opportunity,
      attendanceRows,
    });
    assert.equal(payload.training_days, 2);
    assert.equal(payload.actual_training_hours, 14);
    assert.equal(payload.actual_daily_hours, 7);
    assert.equal(payload.absence_days, 1);
    assert.equal(payload.attendance_percentage, 100);
  });

  it('does not divide daily hours by zero when nobody attended', () => {
    const payload = buildFieldTrainingEvaluationTemplatePayload({
      student: studentAr,
      application: { completed_training_hours: 10, attendance_percentage: 0 },
      opportunity,
      attendanceRows: [],
    });
    assert.equal(payload.training_days, 0);
    assert.equal(payload.actual_daily_hours, '');
  });

  it('never substitutes the internal user id as a university number', () => {
    const payload = buildFieldTrainingEvaluationTemplatePayload({
      student: { id: 'uuid-1', full_name: 'Sara', university_student_number: 'uuid-1' },
      application,
      opportunity,
    });
    assert.equal(payload.student_number, '');
    assert.deepEqual(missingRequiredIdentityFields(payload), ['student_number', 'student_specialty']);
  });

  it('blocks official generation when required identity fields are missing', () => {
    const payload = buildFieldTrainingEvaluationTemplatePayload({
      student: { full_name: '', university_student_number: null },
      application,
      opportunity: {},
    });
    assert.deepEqual(missingRequiredIdentityFields(payload), [
      'student_name',
      'student_number',
      'student_specialty',
      'training_start_date',
      'training_end_date',
    ]);
    assert.equal(DATA_INCOMPLETE_CODE, 'FIELD_TRAINING_EVALUATION_DATA_INCOMPLETE');
  });

  it('uses the same mapper for preview and generation', () => {
    const generated = buildFieldTrainingEvaluationTemplatePayload({
      student: studentAr,
      application,
      opportunity,
      instructor: { full_name: 'مشرف' },
      attendanceRows,
      specialtyLabel: 'الأمن السيبراني',
    });
    const preview = publicPreviewPayload(generated);
    assert.equal(preview.student_name, generated.student_name);
    assert.equal(preview.student_number, generated.student_number);
    assert.equal(preview.student_specialty, generated.student_specialty);
    assert.equal(preview.semester, generated.semester);
    const serviceSrc = readFileSync(
      path.join(__dirname, '../src/modules/fieldTraining/fieldTrainingEvaluation.service.js'),
      'utf8'
    );
    assert.match(serviceSrc, /function buildFillFields\(ctx, evaluation\) \{\s*return buildFieldTrainingEvaluationTemplatePayload/s);
    assert.match(serviceSrc, /const payload = buildFillFields\(ctx/);
    assert.match(serviceSrc, /previewApplicationPayload/);
  });

  it('builds the filename from the mapped student name and university number', () => {
    const payload = buildFieldTrainingEvaluationTemplatePayload({
      student: studentAr,
      application,
      opportunity,
      attendanceRows,
    });
    const filename = buildEvaluationPdfFilename({
      studentName: payload.student_name,
      universityNumber: payload.student_number,
    });
    assert.equal(filename, 'راما_بكر_عبد_الجليل_الجلامده_202312345_FieldTrainingEvaluation.pdf');
    assert.equal(filename.includes(studentAr.id), false);
  });
});

describe('Mutah label-form table replacement', () => {
  it('matches فترة التدريب after Arabic yeh normalization', () => {
    const match = matchLabelKey('فترة التدريب: إلى:');
    assert.equal(match?.key, 'period');
  });

  it('fills student identity and training dates inside table cells', () => {
    const xml = `<?xml version="1.0"?><w:document>
      <w:tbl>
        <w:tr>
          <w:tc><w:p><w:r><w:t>اسم الطالب:</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>الرقم:</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>التخصص:</w:t></w:r></w:p></w:tc>
        </w:tr>
        <w:tr>
          <w:tc><w:p><w:r><w:t>الفصل الدراسي: الصيفي</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>السنة الدراسية: 2025-2026</w:t></w:r></w:p></w:tc>
        </w:tr>
        <w:tr>
          <w:tc><w:p><w:r><w:t>فترة التدريب:</w:t></w:r><w:r><w:t> إلى:</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
      <w:tbl>
        <w:tr>
          <w:tc><w:p><w:r><w:t>مجال التقييم</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>ممتاز</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
    </w:document>`;
    const payload = buildPlaceholderMap(
      buildFieldTrainingEvaluationTemplatePayload({
        student: studentAr,
        application,
        opportunity,
        attendanceRows,
      })
    );
    const filled = fillUniversityLabelForm(xml, payload);
    assert.match(filled, /اسم الطالب: راما بكر عبد الجليل الجلامده/);
    assert.match(filled, /الرقم: 202312345/);
    assert.match(filled, /التخصص: الأمن السيبراني/);
    assert.match(filled, /الفصل الدراسي: الصيفي/);
    assert.match(filled, /السنة الدراسية: 2025\/2026/);
    assert.match(filled, /فترة التدريب: 23\/07\/2026 إلى: 05\/09\/2026/);
  });
});
