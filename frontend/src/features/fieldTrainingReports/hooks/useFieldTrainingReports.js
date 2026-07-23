import { useQuery } from '@tanstack/react-query';
import {
  fetchFieldTrainingApplicationsReport,
  fetchFieldTrainingDashboard,
  fetchFieldTrainingGlobalReport,
  fetchFieldTrainingOpportunities,
  fetchFieldTrainingOpportunityDetail,
  fetchFieldTrainingStudentReport,
  fetchFieldTrainingUniversityReport,
  fetchFieldTrainingAnalytics,
} from '../fieldTrainingReports.service.js';
import { STALE, keepPreviousListData } from '../../../lib/queryDefaults.js';

export const fieldTrainingReportKeys = {
  all: ['fieldTrainingReports'],
  dashboard: (params, mode) => [...fieldTrainingReportKeys.all, 'dashboard', mode, params],
  global: (params) => [...fieldTrainingReportKeys.all, 'global', params],
  university: (params, mode) => [...fieldTrainingReportKeys.all, 'university', mode, params],
  applications: (params, mode) => [...fieldTrainingReportKeys.all, 'applications', mode, params],
  opportunities: (params, mode) => [...fieldTrainingReportKeys.all, 'opportunities', mode, params],
  opportunity: (opportunityId, params, mode) => [
    ...fieldTrainingReportKeys.all,
    'opportunity',
    mode,
    opportunityId,
    params,
  ],
  student: (applicationId, mode) => [...fieldTrainingReportKeys.all, 'student', mode, applicationId],
  analytics: (params) => [...fieldTrainingReportKeys.all, 'analytics', params],
};

export function useFieldTrainingDashboard(params, options = {}) {
  const { mode = 'admin', ...queryOptions } = options;
  return useQuery({
    queryKey: fieldTrainingReportKeys.dashboard(params, mode),
    queryFn: () => fetchFieldTrainingDashboard(params, mode),
    staleTime: STALE.dashboard,
    ...queryOptions,
  });
}

export function useFieldTrainingGlobalReport(params, options = {}) {
  return useQuery({
    queryKey: fieldTrainingReportKeys.global(params),
    queryFn: () => fetchFieldTrainingGlobalReport(params),
    staleTime: STALE.dashboard,
    placeholderData: keepPreviousListData,
    ...options,
  });
}

export function useFieldTrainingUniversityReport(params, options = {}) {
  const { mode = 'admin', ...queryOptions } = options;
  return useQuery({
    queryKey: fieldTrainingReportKeys.university(params, mode),
    queryFn: () => fetchFieldTrainingUniversityReport(params, mode),
    staleTime: STALE.dashboard,
    placeholderData: keepPreviousListData,
    ...queryOptions,
  });
}

export function useFieldTrainingApplicationsReport(params, options = {}) {
  const { mode = 'admin', ...queryOptions } = options;
  return useQuery({
    queryKey: fieldTrainingReportKeys.applications(params, mode),
    queryFn: () => fetchFieldTrainingApplicationsReport(params, mode),
    staleTime: STALE.dashboard,
    placeholderData: keepPreviousListData,
    ...queryOptions,
  });
}

export function useFieldTrainingOpportunities(params, options = {}) {
  const { mode = 'academic', ...queryOptions } = options;
  return useQuery({
    queryKey: fieldTrainingReportKeys.opportunities(params, mode),
    queryFn: () => fetchFieldTrainingOpportunities(params, mode),
    staleTime: STALE.dashboard,
    placeholderData: keepPreviousListData,
    ...queryOptions,
  });
}

export function useFieldTrainingOpportunityDetail(opportunityId, params = {}, options = {}) {
  const { mode = 'academic', ...queryOptions } = options;
  return useQuery({
    queryKey: fieldTrainingReportKeys.opportunity(opportunityId, params, mode),
    queryFn: () => fetchFieldTrainingOpportunityDetail(opportunityId, params, mode),
    enabled: Boolean(opportunityId),
    staleTime: STALE.detail,
    ...queryOptions,
  });
}

export function useFieldTrainingStudentReport(applicationId, options = {}) {
  const { mode = 'admin', ...queryOptions } = options;
  return useQuery({
    queryKey: fieldTrainingReportKeys.student(applicationId, mode),
    queryFn: () => fetchFieldTrainingStudentReport(applicationId, mode),
    enabled: Boolean(applicationId),
    staleTime: STALE.detail,
    ...queryOptions,
  });
}

export function useFieldTrainingAnalytics(params, options = {}) {
  return useQuery({
    queryKey: fieldTrainingReportKeys.analytics(params),
    queryFn: () => fetchFieldTrainingAnalytics(params),
    staleTime: STALE.dashboard,
    ...options,
  });
}
