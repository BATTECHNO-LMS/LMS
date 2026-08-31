import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8');
}

const completionTab = readSrc('../src/pages/admin/fieldTraining/components/manage/ManageLinkTab.jsx');
const assignment = readSrc('../src/pages/admin/fieldTraining/components/manage/SupervisorAssignmentSection.jsx');
const evalTab = readSrc('../src/pages/admin/fieldTraining/components/manage/ManageEvaluationTemplateTab.jsx');
const dropzone = readSrc('../src/features/fieldTrainingEvaluation/components/ExcelAssignmentDropzone.jsx');
const arFt = readSrc('../src/i18n/locales/ar/fieldTraining.json');
const arEval = readSrc('../src/i18n/locales/ar/fieldTrainingEvaluation.json');
const service = readSrc('../src/features/fieldTraining/fieldTraining.service.js');
const evalService = readSrc('../src/features/fieldTrainingEvaluation/fieldTrainingEvaluation.service.js');

describe('bulk completion letters UI', () => {
  it('exposes إصدار الكل and تنزيل الكل as primary toolbar actions', () => {
    assert.match(arFt, /"issueAll": "إصدار الكل"/);
    assert.match(arFt, /"downloadAll": "تنزيل الكل"/);
    assert.match(arFt, /"issuing": "جاري إصدار كتب الإنهاء..."/);
    assert.match(completionTab, /completionLetter.issueAll/);
    assert.match(completionTab, /completionLetter.downloadAll/);
    assert.match(completionTab, /ft-completion-toolbar/);
  });

  it('shows counters, search, filters, confirmation, and live progress', () => {
    assert.match(completionTab, /eligibleCount/);
    assert.match(completionTab, /issuedCount/);
    assert.match(completionTab, /pendingCount/);
    assert.match(completionTab, /errorCount/);
    assert.match(completionTab, /searchPlaceholder/);
    assert.match(completionTab, /filterIssuance/);
    assert.match(completionTab, /filterSupervisor/);
    assert.match(completionTab, /ConfirmationModal/);
    assert.match(completionTab, /ft-completion-progress/);
    assert.match(completionTab, /previewBulkCompletionLetters/);
    assert.match(completionTab, /completionLetter.zipPreparing/);
    assert.match(completionTab, /completionLetter.issueSummary/);
    assert.match(service, /completion-letters\/bulk-issue/);
    assert.match(service, /completion-letters\/zip/);
    assert.match(service, /previewAdminCompletionLetter/);
    assert.match(service, /completion-letter\/preview/);
    assert.match(evalService, /evaluation-reports\/supervisor-groups/);
    assert.match(evalService, /evaluation-reports\/supervisor-zip/);
  });
});

describe('supervisor excel assignment UI', () => {
  it('keeps the Excel uploader as a separate card from the DOCX template', () => {
    assert.match(evalTab, /SupervisorAssignmentSection/);
    assert.match(evalTab, /DocxTemplateDropzone/);
    assert.match(arEval, /"title": "توزيع الطلاب على المشرفين الأكاديميين"/);
    assert.match(assignment, /assignment.title/);
    assert.match(assignment, /ExcelAssignmentDropzone/);
    assert.match(dropzone, /\.xlsx/);
    assert.match(evalService, /supervisor-assignments\/preview/);
    assert.match(evalService, /supervisor-assignments\/apply/);
  });
});
