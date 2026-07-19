/**
 * ISS-002 frontend: academic submission/grading schemas, status map, service routes,
 * wired pages (source), and role visibility for grading vs submit.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createAcademicSubmissionSchema,
  updateAcademicSubmissionSchema,
  createAcademicGradeSchema,
  updateAcademicGradeSchema,
} from '../src/features/assessments/academicDeliverySchemas.js';
import {
  academicSubmissionStatusLabel,
  isAcademicSubmissionEditable,
} from '../src/features/assessments/academicStatusMap.js';
import { ROLES } from '../src/constants/roles.js';
import { UI_PERMISSION } from '../src/constants/permissions.js';
import { getUiPermissions } from '../src/utils/rolePermissions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', 'src');

function read(...parts) {
  return fs.readFileSync(path.join(srcRoot, ...parts), 'utf8');
}

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';

describe('ISS-002 academic delivery frontend', () => {
  it('submission schemas mirror Backend fields and reject empty content on create', () => {
    const ok = createAcademicSubmissionSchema.safeParse({
      submission_type: 'text_response',
      text_response: 'answer',
    });
    assert.equal(ok.success, true);

    const empty = createAcademicSubmissionSchema.safeParse({
      submission_type: 'text_response',
      text_response: '',
      file_url: '',
      repo_url: '',
    });
    assert.equal(empty.success, false);

    const urlOk = createAcademicSubmissionSchema.safeParse({
      submission_type: 'file',
      file_url: 'https://example.com/doc.pdf',
    });
    assert.equal(urlOk.success, true);

    assert.equal(updateAcademicSubmissionSchema.safeParse({}).success, false);
    assert.equal(
      updateAcademicSubmissionSchema.safeParse({ text_response: 'edit' }).success,
      true
    );
  });

  it('grade schemas enforce 0–100 score boundaries', () => {
    assert.equal(
      createAcademicGradeSchema.safeParse({ student_id: STUDENT_ID, score: 85 }).success,
      true
    );
    assert.equal(
      createAcademicGradeSchema.safeParse({ student_id: STUDENT_ID, score: 101 }).success,
      false
    );
    assert.equal(
      createAcademicGradeSchema.safeParse({ student_id: STUDENT_ID, score: -0.1 }).success,
      false
    );
    assert.equal(updateAcademicGradeSchema.safeParse({ score: 90 }).success, true);
    assert.equal(updateAcademicGradeSchema.safeParse({}).success, false);
  });

  it('academic status map labels known codes and fails safely on unknown', () => {
    assert.equal(academicSubmissionStatusLabel('submitted', 'en'), 'Submitted');
    assert.equal(academicSubmissionStatusLabel('late', 'en'), 'Late');
    assert.match(academicSubmissionStatusLabel('weird_new_state', 'en'), /Unknown status/);
    assert.match(academicSubmissionStatusLabel('weird_new_state', 'ar'), /حالة غير معروفة/);
  });

  it('editable helper locks finalized and graded submissions', () => {
    assert.equal(isAcademicSubmissionEditable(null), false);
    assert.equal(
      isAcademicSubmissionEditable({ status: 'submitted', current_grade: null }),
      true
    );
    assert.equal(
      isAcademicSubmissionEditable({ status: 'submitted', current_grade: { is_final: true } }),
      false
    );
    assert.equal(isAcademicSubmissionEditable({ status: 'graded' }), false);
    assert.equal(isAcademicSubmissionEditable({ status: 'returned' }), false);
  });

  it('students can submit but cannot grade; instructors can grade but cannot submit', () => {
    const student = getUiPermissions(ROLES.STUDENT);
    const instructor = getUiPermissions(ROLES.INSTRUCTOR);
    assert.equal(student[UI_PERMISSION.canSubmitAssessments], true);
    assert.equal(student[UI_PERMISSION.canGradeAssessments], false);
    assert.equal(instructor[UI_PERMISSION.canGradeAssessments], true);
    assert.equal(instructor[UI_PERMISSION.canSubmitAssessments], false);
  });

  it('API services call the exact Backend write routes', () => {
    const submissions = read('features', 'submissions', 'submissions.service.js');
    const grades = read('features', 'grades', 'grades.service.js');
    assert.match(submissions, /\$\{endpoints\.assessments\}\/\$\{assessmentId\}\/submissions/);
    assert.match(submissions, /\$\{endpoints\.submissions\}\/\$\{submissionId\}/);
    assert.match(grades, /\$\{endpoints\.assessments\}\/\$\{assessmentId\}\/grades/);
    assert.match(grades, /\$\{endpoints\.grades\}\/\$\{gradeId\}/);
    assert.match(grades, /\$\{endpoints\.grades\}\/\$\{gradeId\}\/finalize/);
    assert.equal(/FormData|multipart/i.test(submissions), false);
  });

  it('student submission page is a working form with URL fields (not binary upload)', () => {
    const page = read('pages', 'student', 'StudentAcademicSubmissionPage.jsx');
    assert.match(page, /useCreateAcademicSubmission/);
    assert.match(page, /useUpdateAcademicSubmission/);
    assert.match(page, /createAcademicSubmissionSchema/);
    assert.match(page, /file_url/);
    assert.match(page, /fileUrlHint/);
    assert.equal(/type=["']file["']|FileUploader|FileDropzone/.test(page), false);
    assert.match(page, /disabled=\{pending\}/);
    assert.match(page, /isAcademicSubmissionEditable/);
  });

  it('instructor grade page posts/puts/finalizes with confirmation', () => {
    const page = read('pages', 'instructor', 'InstructorAcademicGradePage.jsx');
    assert.match(page, /useCreateAcademicGrade/);
    assert.match(page, /useUpdateAcademicGrade/);
    assert.match(page, /useFinalizeAcademicGrade/);
    assert.match(page, /window\.confirm/);
    assert.match(page, /finalizeConfirm/);
    assert.match(page, /finalReadOnly/);
    assert.match(page, /createAcademicGradeSchema/);
  });

  it('list pages replace decorative buttons with routes to active forms', () => {
    const studentAssessments = read('pages', 'student', 'StudentAssessmentsPage.jsx');
    const instructorSubs = read('pages', 'instructor', 'InstructorSubmissionsPage.jsx');
    const instructorGrades = read('pages', 'instructor', 'InstructorGradesPage.jsx');
    assert.match(studentAssessments, /\/student\/assessments\/\$\{r\.id\}\/submit/);
    assert.match(instructorSubs, /\/instructor\/submissions\/\$\{r\.id\}\/grade/);
    assert.match(instructorGrades, /\/instructor\/grades\/\$\{r\.id\}\/edit/);
    assert.equal(
      /onClick=\{undefined\}|title=\{t\('student\.actions\.upload'\)\}[\s\S]*?<button(?![^>]*to=)/.test(
        studentAssessments
      ),
      false
    );
  });

  it('router registers student submit and instructor grade routes', () => {
    const router = read('app', 'router', 'index.jsx');
    assert.match(router, /assessments\/:assessmentId\/submit/);
    assert.match(router, /submissions\/:submissionId\/grade/);
    assert.match(router, /grades\/:gradeId\/edit/);
    assert.match(router, /StudentAcademicSubmissionPage/);
    assert.match(router, /InstructorAcademicGradePage/);
  });

  it('mutations invalidate academic query keys', () => {
    const subMut = read('features', 'submissions', 'hooks', 'useAcademicSubmissionMutations.js');
    const gradeMut = read('features', 'grades', 'hooks', 'useAcademicGradeMutations.js');
    assert.match(subMut, /invalidateQueries/);
    assert.match(subMut, /submissionsKeys/);
    assert.match(subMut, /assessmentsKeys/);
    assert.match(subMut, /ACADEMIC_SUBMISSION_EXISTS|isAcademicSubmissionExistsConflict/);
    assert.match(gradeMut, /gradesKeys/);
    assert.match(gradeMut, /submissionsKeys/);
    assert.match(gradeMut, /GRADE_FINALIZED|isGradeFinalizedConflict/);
  });

  it('student page handles ACADEMIC_SUBMISSION_EXISTS without auto-retry POST', () => {
    const page = read('pages', 'student', 'StudentAcademicSubmissionPage.jsx');
    assert.match(page, /isAcademicSubmissionExistsConflict/);
    assert.match(page, /alreadyExists/);
    assert.match(page, /disabled=\{pending\}/);
    assert.equal(/\bwhile\s*\(.*mutateAsync|\bfor\s*\(.*mutateAsync/.test(page), false);
  });

  it('exists-conflict helper does not treat generic 409 as submission-exists', () => {
    const mut = read('features', 'submissions', 'hooks', 'useAcademicSubmissionMutations.js');
    assert.match(mut, /code === 'ACADEMIC_SUBMISSION_EXISTS'/);
    assert.equal(/status === 409/.test(mut), false);
  });
});
