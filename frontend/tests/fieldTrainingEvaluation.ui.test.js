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

const tabSource = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../src/pages/admin/fieldTraining/components/manage/ManageEvaluationTemplateTab.jsx'
  ),
  'utf8'
);

describe('field training evaluation UI', () => {
  it('uses Arabic badges for PASSED/FAILED/NOT_ELIGIBLE', () => {
    assert.equal(FINAL_STATUS_LABELS.PASSED.ar, 'ناجح');
    assert.equal(FINAL_STATUS_LABELS.FAILED.ar, 'راسب');
    assert.equal(FINAL_STATUS_LABELS.NOT_ELIGIBLE.ar, 'غير مؤهل');
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
});
