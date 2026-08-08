const test = require('node:test');
const assert = require('node:assert');
const {
  resolveGradingMode,
  syncRequiresAiFlag,
  initialReviewStatusForGradingMode,
  requiresAiSelfEvaluation,
  isNoGrading,
} = require('../src/modules/fieldTraining/fieldTraining.gradingMode');
const {
  isAllowedSubmissionFile,
  isArchiveFile,
  validateSubmissionFilesList,
  isBlockedExtension,
  MAX_FILES_PER_SUBMISSION,
} = require('../src/modules/fieldTraining/fieldTraining.submissionFileRules');
const {
  getAiSupportedFileTypesConfig,
  isAiSupportedFile,
  extractTextFromBuffer,
} = require('../src/modules/fieldTraining/fieldTraining.contentExtract');

test('grading_mode is independent from is_final_task', () => {
  assert.strictEqual(resolveGradingMode({ grading_mode: 'AI', is_final_task: true }), 'AI');
  assert.strictEqual(resolveGradingMode({ grading_mode: 'MANUAL', is_final_task: true }), 'MANUAL');
  assert.strictEqual(resolveGradingMode({ grading_mode: 'NONE', is_final_task: false }), 'NONE');
  assert.strictEqual(resolveGradingMode({ requires_ai_self_evaluation: true }), 'AI');
  assert.strictEqual(resolveGradingMode({ requires_ai_self_evaluation: false }), 'MANUAL');
  assert.strictEqual(syncRequiresAiFlag('AI'), true);
  assert.strictEqual(syncRequiresAiFlag('MANUAL'), false);
  assert.strictEqual(syncRequiresAiFlag('NONE'), false);
  assert.strictEqual(initialReviewStatusForGradingMode('NONE'), 'approved');
  assert.strictEqual(initialReviewStatusForGradingMode('MANUAL'), 'submitted');
  assert.strictEqual(initialReviewStatusForGradingMode('AI'), 'pending');
  assert.strictEqual(requiresAiSelfEvaluation({ grading_mode: 'AI' }), true);
  assert.strictEqual(isNoGrading({ grading_mode: 'NONE' }), true);
});

test('submission uploads accept archives and block executables', () => {
  assert.strictEqual(isBlockedExtension('payload.exe'), true);
  assert.strictEqual(isArchiveFile('project.zip', 'application/zip'), true);
  assert.strictEqual(isArchiveFile('project.rar', 'application/octet-stream'), true);
  assert.strictEqual(isArchiveFile('project.7z', ''), true);

  const zipOk = isAllowedSubmissionFile({
    fileName: 'solution.zip',
    mimeType: 'application/zip',
    size: 1024,
  });
  assert.strictEqual(zipOk.valid, true);
  assert.strictEqual(zipOk.isArchive, true);

  const rarOk = isAllowedSubmissionFile({
    fileName: 'solution.rar',
    mimeType: 'application/octet-stream',
    size: 2048,
  });
  assert.strictEqual(rarOk.valid, true);

  const sevenOk = isAllowedSubmissionFile({
    fileName: 'solution.7z',
    mimeType: 'application/x-7z-compressed',
    size: 2048,
  });
  assert.strictEqual(sevenOk.valid, true);

  const codeOk = isAllowedSubmissionFile({
    fileName: 'app.js',
    mimeType: 'application/javascript',
    size: 100,
  });
  assert.strictEqual(codeOk.valid, true);

  const blocked = isAllowedSubmissionFile({
    fileName: 'virus.exe',
    mimeType: 'application/octet-stream',
    size: 100,
  });
  assert.strictEqual(blocked.valid, false);

  const many = validateSubmissionFilesList(
    Array.from({ length: MAX_FILES_PER_SUBMISSION + 1 }, (_, i) => ({
      fileName: `f${i}.txt`,
      mimeType: 'text/plain',
      size: 10,
    }))
  );
  assert.strictEqual(many.valid, false);
});

test('AI supported file types match extractable extensions', async () => {
  const cfg = getAiSupportedFileTypesConfig();
  assert.ok(cfg.extensions.includes('.pdf'));
  assert.ok(cfg.extensions.includes('.docx'));
  assert.ok(cfg.extensions.includes('.js'));
  assert.ok(cfg.extensions.includes('.py'));
  assert.ok(!cfg.extensions.includes('.zip'));
  assert.ok(cfg.notes);

  assert.strictEqual(isAiSupportedFile({ fileName: 'a.pdf', mimeType: 'application/pdf' }), true);
  assert.strictEqual(isAiSupportedFile({ fileName: 'a.zip', mimeType: 'application/zip' }), false);

  const archive = await extractTextFromBuffer({
    buffer: Buffer.from('PK'),
    mimeType: 'application/zip',
    fileName: 'a.zip',
  });
  assert.strictEqual(archive.status, 'unsupported');
  assert.ok(/مضغوط|تحليل/i.test(archive.error || ''));

  const txt = await extractTextFromBuffer({
    buffer: Buffer.from('hello world from student'),
    mimeType: 'text/plain',
    fileName: 'notes.txt',
  });
  assert.strictEqual(txt.status, 'ok');
  assert.ok(txt.text.includes('hello'));
});
