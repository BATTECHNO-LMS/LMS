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
  fetchOpportunityEligibility,
} from '../fieldTraining.service.js';
import { fieldTrainingKeys } from './fieldTrainingQueryKeys.js';
import { STALE, keepPreviousListData } from '../../../lib/queryDefaults.js';

export function useAdminFieldTrainingList(params = {}, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.adminList(params),
    queryFn: () => fetchAdminFieldTrainingList(params),
    staleTime: STALE.fieldTraining,
    placeholderData: keepPreviousListData,
    ...options,
  });
}

export function useAdminFieldTrainingStats(params = {}, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.adminStats(params),
    queryFn: () => fetchAdminFieldTrainingStats(params),
    staleTime: STALE.fieldTraining,
    ...options,
  });
}

export function useAdminFieldTraining(id, options = {}) {
  return useQuery({
    queryKey: fieldTrainingKeys.adminDetail(id),
    queryFn: () => fetchAdminFieldTraining(id),
    enabled: Boolean(id),
    staleTime: STALE.fieldTraining,
    ...options,
  });
}

export function useOpportunityApplications(opportunityId, params = {}, options = {}) {
  const scope = options.scope ?? 'admin';
  return useQuery({
    queryKey: fieldTrainingKeys.adminApplications(opportunityId, params),
    queryFn: () =>
      fetchOpportunityApplications(opportunityId, params, { asInstructor: scope === 'instructor' }),
    enabled: Boolean(opportunityId),
    staleTime: STALE.fieldTraining,
    placeholderData: keepPreviousListData,
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
  const scope = options.scope ?? 'admin';
  return useQuery({
    queryKey: fieldTrainingKeys.tasks(opportunityId, scope),
    queryFn: () => fetchOpportunityTasks(opportunityId, {
      asAdmin: scope === 'admin',
      asInstructor: scope === 'instructor',
    }),
    enabled: Boolean(opportunityId),
    ...options,
  });
}

export function useOpportunityTaskMutations(opportunityId, scope = 'admin') {
  const qc = useQueryClient();
  const asInstructor = scope === 'instructor';
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.tasks(opportunityId, scope) });
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.submissions(opportunityId, scope) });
  };
  return {
    create: useMutation({
      mutationFn: (body) => createOpportunityTask(opportunityId, body, { asInstructor }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ taskId, body }) => updateOpportunityTask(taskId, body, { asInstructor }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (taskId) => deleteOpportunityTask(taskId, { asInstructor }),
      onSuccess: invalidate,
    }),
  };
}

export function useOpportunitySubmissions(opportunityId, options = {}) {
  const scope = options.scope ?? 'admin';
  return useQuery({
    queryKey: fieldTrainingKeys.submissions(opportunityId, scope),
    queryFn: () => fetchOpportunitySubmissions(opportunityId, { asInstructor: scope === 'instructor' }),
    enabled: Boolean(opportunityId),
    ...options,
  });
}

export function useOpportunitySessions(opportunityId, options = {}) {
  const scope = options.scope ?? 'admin';
  return useQuery({
    queryKey: fieldTrainingKeys.sessions(opportunityId, scope),
    queryFn: () =>
      fetchOpportunitySessions(opportunityId, {
        asAdmin: scope === 'admin',
        asInstructor: scope === 'instructor',
      }),
    enabled: Boolean(opportunityId),
    ...options,
  });
}

export function useOpportunityAssessments(opportunityId, options = {}) {
  const scope = options.scope ?? 'admin';
  return useQuery({
    queryKey: fieldTrainingKeys.assessments(opportunityId, scope),
    queryFn: () => fetchOpportunityAssessments(opportunityId, { asInstructor: scope === 'instructor' }),
    enabled: Boolean(opportunityId),
    ...options,
  });
}

export function useSessionAttendance(sessionId, options = {}) {
  const scope = options.scope ?? 'admin';
  return useQuery({
    queryKey: fieldTrainingKeys.sessionAttendance(sessionId),
    queryFn: () => fetchSessionAttendance(sessionId, { asInstructor: scope === 'instructor' }),
    enabled: Boolean(sessionId),
    ...options,
  });
}

export function useApplicationProgress(applicationId, options = {}) {
  const scope = options.scope ?? 'admin';
  return useQuery({
    queryKey: fieldTrainingKeys.applicationProgress(applicationId),
    queryFn: () => fetchApplicationProgress(applicationId, { asInstructor: scope === 'instructor' }),
    enabled: Boolean(applicationId),
    ...options,
  });
}

export function useOpportunityEligibility(opportunityId, options = {}) {
  const scope = options.scope ?? 'admin';
  return useQuery({
    queryKey: fieldTrainingKeys.eligibility(opportunityId, scope),
    queryFn: () =>
      fetchOpportunityEligibility(opportunityId, { asInstructor: scope === 'instructor' }),
    enabled: Boolean(opportunityId) && (options.enabled ?? true),
    ...options,
  });
}
