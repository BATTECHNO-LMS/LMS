/**
 * Field training required-task progress UI wiring.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { taskProgressVariant } from '../src/features/fieldTraining/fieldTrainingUi.js';

const root = path.dirname(fileURLToPath(import.meta.url));

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('field training task progress UI', () => {
  it('maps backend statuses to green, amber, and neutral badges', () => {
    assert.equal(taskProgressVariant('completed'), 'success');
    assert.equal(taskProgressVariant('in_progress'), 'warning');
    assert.equal(taskProgressVariant('not_started'), 'muted');
    assert.equal(taskProgressVariant('no_required_tasks'), 'muted');
  });

  it('keeps the Arabic status labels in i18n', () => {
    const ar = readSrc('../src/i18n/locales/ar/fieldTraining.json');
    assert.match(ar, /"not_started": "لم يبدأ المهمات"/);
    assert.match(ar, /"in_progress": "قيد إنجاز المهمات"/);
    assert.match(ar, /"completed": "أكمل المهمات"/);
    assert.match(ar, /"no_required_tasks": "لا توجد مهمات مطلوبة"/);
    assert.match(readSrc('../src/i18n/locales/ar/fieldTrainingReports.json'), /"taskProgress": "تقدم المهمات"/);
  });

  it('renders backend task_progress in student tables, dashboards, and reports', () => {
    const badge = readSrc('../src/features/fieldTraining/TaskProgressBadge.jsx');
    assert.match(badge, /progress\.display/);
    assert.match(badge, /Never compute counts on the client/);

    assert.match(
      readSrc('../src/pages/admin/fieldTraining/components/manage/StudentApplicationCard.jsx'),
      /TaskProgressBadge progress=\{app\.task_progress\}/
    );
    assert.match(
      readSrc('../src/pages/shared/fieldTrainingReports/FieldTrainingApplicationsReportPage.jsx'),
      /TaskProgressBadge progress=\{row\.task_progress\}/
    );
    assert.match(
      readSrc('../src/pages/shared/fieldTrainingReports/FieldTrainingEvaluationReportsPage.jsx'),
      /TaskProgressBadge progress=\{row\.task_progress\}/
    );
    assert.match(
      readSrc('../src/pages/student/StudentFieldTrainingPage.jsx'),
      /TaskProgressBadge progress=\{o\.my_task_progress\}/
    );
    assert.match(
      readSrc('../src/components/student/StudentTrainingCard.jsx'),
      /application\.task_progress \|\| progress\?\.task_progress/
    );
    assert.match(
      readSrc('../src/pages/admin/fieldTraining/components/manage/ManageTasksTab.jsx'),
      /is_required: form\.isRequired/
    );
  });
});
