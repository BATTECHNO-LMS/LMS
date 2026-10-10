/**
 * Course task submission: universal multi-file upload rules, accept matching and UI wiring.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_TASK_SUBMISSION_LIMITS,
  displayFileName,
  fileFingerprint,
  formatFileSize,
  getFileKind,
  precheckTaskFile,
  resolveTaskSubmissionLimits,
} from '../src/features/training/taskSubmissionLimits.js';
import { matchesAcceptList, validateFileForUpload } from '../src/features/uploads/uploadRules.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel) => readFileSync(path.join(root, rel), 'utf8');
const fakeFile = (name, size = 10, type = '') => ({ name, size, type, lastModified: 1 });

describe('file name bidi display', () => {
  it('keeps "2026.pdf" together after a number with a left-to-right mark', () => {
    assert.equal(displayFileName('تقرير الفصل الأول 2026.pdf'), 'تقرير الفصل الأول 2026\u200E.pdf');
    assert.equal(displayFileName('مشروع-Final-React-v2.zip'), 'مشروع-Final-React-v2\u200E.zip');
  });

  it('leaves names ending in letters and names without an extension untouched', () => {
    assert.equal(displayFileName('report_2026_FINAL.docx'), 'report_2026_FINAL.docx');
    assert.equal(displayFileName('تقرير.pdf'), 'تقرير.pdf');
    assert.equal(displayFileName('README'), 'README');
    assert.equal(displayFileName(''), '');
  });
});

describe('task submission limits', () => {
  it('mirrors backend defaults and prefers server values', () => {
    assert.deepEqual(resolveTaskSubmissionLimits(null), { ...DEFAULT_TASK_SUBMISSION_LIMITS });
    assert.equal(resolveTaskSubmissionLimits({ maxFiles: 4 }).maxFiles, 4);
    assert.equal(DEFAULT_TASK_SUBMISSION_LIMITS.maxFileBytes, 100 * 1024 * 1024);
  });

  it('accepts any non-executable file, including archives and unknown types', () => {
    const limits = resolveTaskSubmissionLimits();
    for (const name of ['a.pdf', 'b.docx', 'c.xlsx', 'd.pptx', 'e.png', 'f.mp4', 'g.mp3', 'h.zip', 'i.rar', 'j.7z', 'k.tar.gz', 'l.py', 'm.fig', 'n.psd', 'README']) {
      assert.equal(precheckTaskFile(fakeFile(name), limits).valid, true, name);
    }
  });

  it('rejects executables, empty and oversized files with codes', () => {
    const limits = resolveTaskSubmissionLimits();
    assert.equal(precheckTaskFile(fakeFile('setup.exe'), limits).code, 'FILE_TYPE_BLOCKED');
    assert.equal(precheckTaskFile(fakeFile('report.pdf.bat'), limits).code, 'FILE_TYPE_BLOCKED');
    assert.equal(precheckTaskFile(fakeFile('x.pdf', 0), limits).code, 'FILE_EMPTY');
    assert.equal(precheckTaskFile(fakeFile('x.mp4', limits.maxFileBytes + 1), limits).code, 'FILE_TOO_LARGE');
  });

  it('classifies file kinds for icons', () => {
    assert.equal(getFileKind('a.PDF'), 'pdf');
    assert.equal(getFileKind('a.rar'), 'archive');
    assert.equal(getFileKind('a.xlsx'), 'sheet');
    assert.equal(getFileKind('a.pptx'), 'slides');
    assert.equal(getFileKind('a.fig'), 'design');
    assert.equal(getFileKind('noext', 'video/mp4'), 'video');
    assert.equal(getFileKind('weird.xyz'), 'other');
  });

  it('formats sizes and fingerprints duplicates', () => {
    assert.equal(formatFileSize(512), '512 B');
    assert.equal(formatFileSize(2048), '2 KB');
    assert.equal(formatFileSize(1.5 * 1024 * 1024), '1.5 MB');
    assert.equal(fileFingerprint(fakeFile('a.pdf', 5)), fileFingerprint(fakeFile('a.pdf', 5)));
    assert.notEqual(fileFingerprint(fakeFile('a.pdf', 5)), fileFingerprint(fakeFile('a.pdf', 6)));
  });
});

describe('shared accept matching (root cause of rejected DOCX/PNG)', () => {
  const accept = ['application/pdf', '.doc', '.docx', '.ppt', '.pptx', 'image/*', '.zip'];

  it('matches extensions and MIME wildcards', () => {
    assert.equal(matchesAcceptList(fakeFile('cv.docx', 1, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), accept), true);
    assert.equal(matchesAcceptList(fakeFile('shot.png', 1, 'image/png'), accept), true);
    assert.equal(matchesAcceptList(fakeFile('a.pdf', 1, 'application/pdf'), accept), true);
    assert.equal(matchesAcceptList(fakeFile('a.mp4', 1, 'video/mp4'), accept), false);
  });

  it('validateFileForUpload no longer rejects DOCX/PNG for such accept lists', () => {
    assert.equal(validateFileForUpload(fakeFile('cv.docx', 1, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), { accept }).valid, true);
    assert.equal(validateFileForUpload(fakeFile('shot.png', 1, 'image/png'), { accept }).valid, true);
    assert.equal(validateFileForUpload(fakeFile('a.rar', 1, ''), { accept }).valid, true);
  });
});

describe('task submission UI wiring', () => {
  const form = readSrc('../src/features/training/components/taskSubmission/AssignmentSubmissionForm.jsx');
  const list = readSrc('../src/features/training/components/taskSubmission/SubmissionFileList.jsx');
  const review = readSrc('../src/features/training/components/taskSubmission/TaskSubmissionsReviewPanel.jsx');
  const service = readSrc('../src/features/training/taskSubmissions.service.js');
  const trainee = readSrc('../src/pages/trainee/TraineeCourseDetailPage.jsx');
  const taskCard = readSrc('../src/features/training/components/taskSubmission/TraineeTaskCard.jsx');
  const styles = readSrc('../src/assets/styles/components/_task-submission.scss');
  const manager = readSrc('../src/features/training/components/CourseTasksManager.jsx');

  it('uses a multi-file input without a restrictive accept list', () => {
    assert.match(form, /type="file"/);
    assert.match(form, /\bmultiple\b/);
    assert.doesNotMatch(form, /accept=/);
  });

  it('shows real progress, remove, retry, drafts restore and an explicit confirmation step', () => {
    assert.match(form, /role="progressbar"/);
    assert.match(form, /aria-valuenow=\{item\.progress\}/);
    assert.match(form, /removeItem/);
    assert.match(form, /retryItem/);
    assert.match(form, /listTaskSubmissionDrafts/);
    assert.match(form, /step === 'edit'/);
    assert.match(form, /تأكيد التسليم/);
    assert.match(form, /dir="rtl"/);
    assert.match(form, /onDrop=/);
  });

  it('blocks submit while uploading or with failed files', () => {
    assert.match(form, /disabled=\{disabled \|\| submitting \|\| busyUploading\}/);
    assert.match(form, /failedCount/);
  });

  it('uploads via XHR with progress and submits file ids atomically', () => {
    assert.match(service, /xhr\.upload\.onprogress/);
    assert.match(service, /\/submission-files/);
    assert.match(service, /file_ids/);
    assert.match(service, /Authorization/);
  });

  it('downloads through authenticated blob requests, never raw URLs', () => {
    assert.match(service, /responseType: 'blob'/);
    assert.match(service, /assertBlobDownloadSuccess/);
    assert.match(service, /\/task-submissions\/\$\{submissionId\}\/files\/\$\{fileId\}\/download/);
    assert.doesNotMatch(list, /window\.open/);
    assert.doesNotMatch(list, /href=/);
  });

  it('trainee page uses the new form and file list; legacy single uploader removed', () => {
    assert.match(trainee, /TraineeTaskCard/);
    assert.match(taskCard, /AssignmentSubmissionForm/);
    assert.match(taskCard, /SubmissionFileList/);
    assert.doesNotMatch(trainee, /relatedEntityType="training_task"/);
    assert.doesNotMatch(trainee, /accept="application\/pdf,\.doc/);
  });

  it('trainee task list does not render inside the single-row .simple-list layout', () => {
    assert.match(trainee, /className="assign-list"/);
    assert.match(taskCard, /assign-card__layout/);
    assert.match(taskCard, /assign-summary/);
  });

  it('responsive styles fix overflow structurally instead of hiding it', () => {
    assert.doesNotMatch(styles, /overflow-x:\s*hidden/);
    assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) minmax\(15rem, 18rem\)/);
    assert.match(styles, /container-type: inline-size/);
    assert.match(styles, /@container \(max-width: 30rem\)/);
    assert.doesNotMatch(styles, /^\s*(min-)?width:\s*\d{3,}px/m);
  });

  it('instructor/admin task manager exposes the submissions review with file downloads', () => {
    assert.match(manager, /TaskSubmissionsReviewPanel/);
    assert.match(manager, /import \{ getApiErrorMessage \}/);
    assert.match(review, /SubmissionFileList/);
    assert.match(review, /listTaskSubmissionsForReview/);
    assert.match(review, /gradeTaskSubmission/);
  });
});
