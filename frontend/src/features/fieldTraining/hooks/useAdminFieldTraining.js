import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  archiveAdminFieldTraining,
  createAdminFieldTraining,
  fetchAdminFieldTraining,
  fetchAdminFieldTrainingList,
  fetchAdminFieldTrainingStats,
  fetchOpportunityApplications,
  publishAdminFieldTraining,
  reviewFieldTrainingApplication,
  updateAdminFieldTraining,
  fetchOpportunityTasks,
  createOpportunityTask,
  updateOpportunityTask,
  deleteOpportunityTask,
  fetchOpportunitySubmissions,
  fetchOpportunitySessions,
  fetchOpportunityAssessments,
  fetchSessionAttendance,
  fetchApplicationProgress,
} from '../fieldTraining.service.js';
import { fieldTrainingKeys } from './fieldTrainingQueryKeys.js';

export function useAdminFieldTrainingList(params = {}, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.adminList(params),
    queryFn: () => fetchAdminFieldTrainingList(params),
    staleTime: 30_000,
    ...options,
  });
}

export function useAdminFieldTrainingStats(params = {}, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.adminStats(params),
    queryFn: () => fetchAdminFieldTrainingStats(params),
    staleTime: 30_000,
    ...options,
  });
}

export function useAdminFieldTraining(id, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.adminDetail(id),
    queryFn: () => fetchAdminFieldTraining(id),
    enabled: Boolean(id),
    ...options,
  });
}

export function useOpportunityApplications(opportunityId, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.adminApplications(opportunityId),
    queryFn: () => fetchOpportunityApplications(opportunityId),
    enabled: Boolean(opportunityId),
    ...options,
  });
}

export function useCreateFieldTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAdminFieldTraining,
    onSuccess: () => qc.invalidateQueries({ queryKey: fieldTrainingKeys.all }),
  });
}

export function useUpdateFieldTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateAdminFieldTraining(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: fieldTrainingKeys.all }),
  });
}

export function usePublishFieldTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: publishAdminFieldTraining,
    onSuccess: () => qc.invalidateQueries({ queryKey: fieldTrainingKeys.all }),
  });
}

export function useArchiveFieldTraining() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: archiveAdminFieldTraining,
    onSuccess: () => qc.invalidateQueries({ queryKey: fieldTrainingKeys.all }),
  });
}

export function useReviewApplication(opportunityId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ applicationId, body }) => reviewFieldTrainingApplication(applicationId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(opportunityId) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminList() });
    },
  });
}

export function useOpportunityTasks(opportunityId, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.tasks(opportunityId, 'admin'),
    queryFn: () => fetchOpportunityTasks(opportunityId, { asAdmin: true }),
    enabled: Boolean(opportunityId),
    ...options,
  });
}

export function useOpportunityTaskMutations(opportunityId) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.tasks(opportunityId, 'admin') });
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.submissions(opportunityId) });
  };
  return {
    create: useMutation({
      mutationFn: (body) => createOpportunityTask(opportunityId, body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ taskId, body }) => updateOpportunityTask(taskId, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (taskId) => deleteOpportunityTask(taskId),
      onSuccess: invalidate,
    }),
  };
}

export function useOpportunitySubmissions(opportunityId, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.submissions(opportunityId),
    queryFn: () => fetchOpportunitySubmissions(opportunityId),
    enabled: Boolean(opportunityId),
    ...options,
  });
}

export function useOpportunitySessions(opportunityId, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.sessions(opportunityId),
    queryFn: () => fetchOpportunitySessions(opportunityId),
    enabled: Boolean(opportunityId),
    ...options,
  });
}

export function useOpportunityAssessments(opportunityId, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.assessments(opportunityId),
    queryFn: () => fetchOpportunityAssessments(opportunityId),
    enabled: Boolean(opportunityId),
    ...options,
  });
}

export function useSessionAttendance(sessionId, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.sessionAttendance(sessionId),
    queryFn: () => fetchSessionAttendance(sessionId),
    enabled: Boolean(sessionId),
    ...options,
  });
}

export function useApplicationProgress(applicationId, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.applicationProgress(applicationId),
    queryFn: () => fetchApplicationProgress(applicationId),
    enabled: Boolean(applicationId),
    ...options,
  });
}
