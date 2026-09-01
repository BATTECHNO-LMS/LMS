/**
 * Field training official evaluation UI helpers.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getReportPaths } from '../src/pages/shared/fieldTrainingReports/reportCapabilities.js';
import { FINAL_STATUS_LABELS } from '../src/features/fieldTrainingEvaluation/evaluationLabels.js';
import {
  selectTemplateValidation,
  templateValidationGroups,
} from '../src/features/fieldTrainingEvaluation/selectTemplateValidation.js';
import { translateEvaluationFieldLabel } from '../src/features/fieldTrainingEvaluation/evaluationFieldLabels.js';

const tabSource = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/pages/admin/fieldTraining/components/manage/ManageEvaluationTemplateTab.jsx'
  ),
  'utf8'
);
const dropzoneSource = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/features/fieldTrainingEvaluation/components/DocxTemplateDropzone.jsx'
  ),
  'utf8'
);
const templatesPageSource = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/pages/admin/fieldTraining/AdminFieldTrainingEvaluationTemplatesPage.jsx'
  ),
  'utf8'
);

describe('field training evaluation UI', () => {
  it('uses Arabic badges for PASSED/FAILED/NOT_ELIGIBLE', () => {
    assert.equal(FINAL_STATUS_LABELS.PASSED.ar, 'ناجح');
    assert.equal(FINAL_STATUS_LABELS.FAILED.ar, 'راسب');
    assert.equal(FINAL_STATUS_LABELS.NOT_ELIGIBLE.ar, 'غير مؤهل');
  });

  it('shows task progress in the official evaluation reports student table', () => {
    const reportsPage = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages/shared/fieldTrainingReports/FieldTrainingEvaluationReportsPage.jsx'),
      'utf8'
    );
    const ar = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/i18n/locales/ar/fieldTrainingEvaluation.json'),
      'utf8'
    );
    assert.match(reportsPage, /TaskProgressBadge progress=\{row\.task_progress\}/);
    assert.match(ar, /"taskProgress": "تقدم المهمات"/);
  });

  it('exposes evaluation report routes for admin, academic, and reviewer', () => {
    assert.equal(
      getReportPaths('/admin/field-training/reports', 'admin').evaluations,
      '/admin/field-training/reports/evaluations'
    );
    assert.equal(
      getReportPaths('/reviewer/field-training/reports', 'reviewer').evaluations,
      '/reviewer/field-training/reports/evaluations'
    );
    assert.match(getReportPaths('', 'academic').evaluations, /evaluations/);
  });

  it('shows which university default template is currently active', () => {
    assert.match(templatesPageSource, /currentDefault/);
    assert.match(templatesPageSource, /activeDefault/);
    assert.match(templatesPageSource, /ft-eval-active-default/);
  });
});

describe('evaluation template tab validation source', () => {
  it('renders student data preview fields from the shared payload keys', () => {
    assert.match(tabSource, /studentDataPreview/);
    assert.match(tabSource, /previewEvaluationApplicationPayload/);
    assert.match(tabSource, /student_name/);
    assert.match(tabSource, /student_number/);
    assert.match(tabSource, /student_specialty/);
    assert.match(tabSource, /FIELD_TRAINING_EVALUATION_DATA_INCOMPLETE/);
  });

  it('declares lastValidation state before reading it', () => {
    const declared = tabSource.indexOf('const [lastValidation, setLastValidation] = useState(null)');
    const used = tabSource.indexOf('selectTemplateValidation({ lastValidation');
    assert.ok(declared >= 0, 'lastValidation useState is required');
    assert.ok(used > declared, 'lastValidation must be declared before use');
  });

  it('renders with no previous validation (null / absent)', () => {
    assert.equal(selectTemplateValidation({}), null);
    assert.equal(selectTemplateValidation({ lastValidation: null, resolvedTemplate: null }), null);
    assert.equal(selectTemplateValidation({ lastValidation: null, resolvedTemplate: {} }), null);
    assert.equal(
      selectTemplateValidation({ lastValidation: null, resolvedTemplate: { validation: null } }),
      null
    );
    assert.deepEqual(templateValidationGroups(null), []);
    assert.deepEqual(templateValidationGroups(undefined), []);
    assert.deepEqual(templateValidationGroups({ valid: true }), []);
  });

  it('prefers the latest upload validation payload over the loaded template', () => {
    const lastValidation = {
      valid: false,
      groups: [{ id: 'student_name', label: 'Student Name', found: false, missing: ['student_name'] }],
    };
    const resolvedTemplate = {
      validation: { valid: true, groups: [{ id: 'student_name', label: 'Student Name', found: true, missing: [] }] },
    };
    assert.equal(selectTemplateValidation({ lastValidation, resolvedTemplate }), lastValidation);
    assert.equal(templateValidationGroups(lastValidation).length, 1);
  });

  it('falls back to GET resolvedTemplate.validation from the API', () => {
    const resolvedTemplate = {
      validationStatus: 'valid',
      validation: {
        valid: true,
        groups: [{ id: 'student_name', label: 'Student Name', found: true, missing: [] }],
      },
    };
    const selected = selectTemplateValidation({ lastValidation: null, resolvedTemplate });
    assert.equal(selected, resolvedTemplate.validation);
    assert.equal(templateValidationGroups(selected)[0].found, true);
  });

  it('hides the native file chooser and keeps generate-missing in the incomplete section', () => {
    assert.match(dropzoneSource, /className="file-dropzone__input"/);
    assert.match(dropzoneSource, /accept="\.docx/);
    assert.doesNotMatch(tabSource, /<input[^>]*type="file"/);
    const incompleteAt = tabSource.indexOf("t('manage.incompleteCard')");
    const generateInIncomplete = tabSource.indexOf("t('manage.generateReady')", incompleteAt);
    const uploadAt = tabSource.indexOf("t('manage.uploadPrimary')");
    assert.ok(incompleteAt > 0, 'incomplete reports card is required');
    assert.ok(generateInIncomplete > incompleteAt, 'generate ready must live with the reports workflow');
    assert.ok(uploadAt > 0 && uploadAt < incompleteAt, 'upload remains with template actions');
    assert.match(tabSource, /readinessTitle/);
    assert.match(tabSource, /downloadAll/);
    assert.match(tabSource, /previewWithStudent/);
    assert.match(tabSource, /previewMode === 'not_generated'/);
    assert.match(tabSource, /previewRequiresGeneration/);
    assert.match(tabSource, /templateFidelityStatus/);
    assert.match(tabSource, /sourceTemplateFileId|originalFileId/);
    assert.doesNotMatch(tabSource, /dangerouslySetInnerHTML/);
    assert.doesNotMatch(tabSource, /previewHtml/);
    assert.match(tabSource, /canManage = apiScope === 'admin' \|\| apiScope === 'instructor'/);
  });
});

describe('evaluation field labels', () => {
  it('translates missing report fields to Arabic instead of raw keys', () => {
    assert.equal(translateEvaluationFieldLabel('Student Name', 'ar'), 'اسم الطالب');
    assert.equal(translateEvaluationFieldLabel('Student Number', 'ar'), 'الرقم الجامعي');
    assert.equal(translateEvaluationFieldLabel('Training Dates', 'ar'), 'فترة التدريب');
    assert.equal(translateEvaluationFieldLabel('Evaluation Grid', 'ar'), 'بنود التقييم');
    assert.equal(translateEvaluationFieldLabel('Professional Total', 'ar'), 'مجموع التقييم المهني');
    assert.equal(translateEvaluationFieldLabel('General Comments', 'ar'), 'الملاحظات العامة');
    assert.equal(translateEvaluationFieldLabel('organization_name', 'ar'), 'اسم جهة التدريب');
    assert.equal(translateEvaluationFieldLabel('responsible_person_name', 'ar'), 'اسم المسؤول (المشرف الأكاديمي)');
    assert.equal(translateEvaluationFieldLabel('TRAINING_HOURS_MISSING', 'ar'), 'الساعات التدريبية المكتملة');
    assert.equal(translateEvaluationFieldLabel('ABSENCE_DATA_MISSING', 'ar'), 'بيانات الغياب');
  });
});
