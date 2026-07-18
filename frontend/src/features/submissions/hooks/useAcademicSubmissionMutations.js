import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAcademicSubmission,
  fetchSubmissionById,
  updateAcademicSubmission,
} from '../submissions.service.js';
import { submissionsKeys } from './useSubmissions.js';
import { assessmentsKeys } from '../../assessments/hooks/useAssessments.js';
import { gradesKeys } from '../../grades/hooks/useGrades.js';

/** Backend ACADEMIC-SUBMISSION-001 — do not treat other 409s as this. */
export function isAcademicSubmissionExistsConflict(err) {
  return err?.response?.data?.code === 'ACADEMIC_SUBMISSION_EXISTS';
}

function invalidateAcademicSubmissionQueries(qc, submissionId) {
  qc.invalidateQueries({ queryKey: submissionsKeys.all });
  if (submissionId) {
    qc.invalidateQueries({ queryKey: [...submissionsKeys.all, 'detail', submissionId] });
  }
  qc.invalidateQueries({ queryKey: assessmentsKeys.all });
  qc.invalidateQueries({ queryKey: gradesKeys.all });
}

export function useSubmission(id, options = {}) {
  return useQuery({
    queryKey: [...submissionsKeys.all, 'detail', id],
    queryFn: () => fetchSubmissionById(id),
    enabled: Boolean(id),
    ...options,
  });
}

export function useCreateAcademicSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, body }) => createAcademicSubmission(assessmentId, body),
    onSuccess: () => {
      invalidateAcademicSubmissionQueries(qc);
    },
    onError: (err) => {
      if (isAcademicSubmissionExistsConflict(err)) {
        invalidateAcademicSubmissionQueries(qc);
      }
    },
  });
}

export function useUpdateAcademicSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, body }) => updateAcademicSubmission(submissionId, body),
    onSuccess: (_data, vars) => {
      invalidateAcademicSubmissionQueries(qc, vars?.submissionId);
    },
  });
}
