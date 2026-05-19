import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applyToFieldTraining,
  cancelFieldTrainingApplication,
  fetchMyFieldTrainingApplications,
  fetchStudentFieldTraining,
  fetchStudentFieldTrainingList,
  fetchOpportunityTasks,
  submitFieldTrainingTask,
} from '../fieldTraining.service.js';
import { fieldTrainingKeys } from './fieldTrainingQueryKeys.js';

export function useStudentFieldTrainingList(params = {}, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.studentList(params),
    queryFn: () => fetchStudentFieldTrainingList(params),
    ...options,
  });
}

export function useStudentFieldTraining(id, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.studentDetail(id),
    queryFn: () => fetchStudentFieldTraining(id),
    enabled: Boolean(id),
    ...options,
  });
}

export function useMyFieldTrainingApplications(options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.myApplications(),
    queryFn: fetchMyFieldTrainingApplications,
    ...options,
  });
}

export function useApplyFieldTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => applyToFieldTraining(id, body),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentList() });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentDetail(id) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.myApplications() });
    },
  });
}

export function useCancelFieldTrainingApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelFieldTrainingApplication,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.all });
    },
  });
}

export function useStudentOpportunityTasks(opportunityId, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.tasks(opportunityId, 'student'),
    queryFn: () => fetchOpportunityTasks(opportunityId, { asAdmin: false }),
    enabled: Boolean(opportunityId),
    ...options,
  });
}

export function useSubmitFieldTrainingTask(opportunityId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, file }) => submitFieldTrainingTask(taskId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.tasks(opportunityId, 'student') });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentDetail(opportunityId) });
    },
  });
}
