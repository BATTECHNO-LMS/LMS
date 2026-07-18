import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAcademicGrade,
  fetchGradeById,
  finalizeAcademicGrade,
  updateAcademicGrade,
} from '../grades.service.js';
import { gradesKeys } from './useGrades.js';
import { submissionsKeys } from '../../submissions/hooks/useSubmissions.js';
import { assessmentsKeys } from '../../assessments/hooks/useAssessments.js';

/** Backend ACADEMIC-GRADE-001 conflict — refresh server state; do not keep stale editable form. */
function isGradeFinalizedConflict(err) {
  return (
    err?.response?.status === 409 ||
    err?.response?.data?.code === 'GRADE_FINALIZED' ||
    err?.code === 'GRADE_FINALIZED'
  );
}

function invalidateAcademicGradeQueries(qc, gradeId) {
  qc.invalidateQueries({ queryKey: gradesKeys.all });
  if (gradeId) {
    qc.invalidateQueries({ queryKey: [...gradesKeys.all, 'detail', gradeId] });
  }
  qc.invalidateQueries({ queryKey: submissionsKeys.all });
  qc.invalidateQueries({ queryKey: assessmentsKeys.all });
}

export function useGrade(id, options = {}) {
  return useQuery({
    queryKey: [...gradesKeys.all, 'detail', id],
    queryFn: () => fetchGradeById(id),
    enabled: Boolean(id),
    ...options,
  });
}

export function useCreateAcademicGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, body }) => createAcademicGrade(assessmentId, body),
    onSuccess: () => {
      invalidateAcademicGradeQueries(qc);
    },
    onError: (err) => {
      if (isGradeFinalizedConflict(err)) invalidateAcademicGradeQueries(qc);
    },
  });
}

export function useUpdateAcademicGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ gradeId, body }) => updateAcademicGrade(gradeId, body),
    onSuccess: (_data, vars) => {
      invalidateAcademicGradeQueries(qc, vars?.gradeId);
    },
    onError: (err, vars) => {
      if (isGradeFinalizedConflict(err)) invalidateAcademicGradeQueries(qc, vars?.gradeId);
    },
  });
}

export function useFinalizeAcademicGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gradeId) => finalizeAcademicGrade(gradeId),
    onSuccess: (_data, gradeId) => {
      invalidateAcademicGradeQueries(qc, gradeId);
    },
  });
}
