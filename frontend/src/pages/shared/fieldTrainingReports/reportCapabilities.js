import { ROLES } from '../../../constants/roles.js';

export function usesAcademicReportApi(mode) {
  return mode === 'academic' || mode === 'reviewer';
}

export function getReportPaths(basePath, mode = 'admin') {
  if (mode === 'academic') {
    return {
      hub: '/academic/field-training/reports',
      university: '/academic/field-training/reports/university',
      students: '/academic/field-training/students',
      opportunities: '/academic/field-training/opportunities',
      student: '/academic/field-training/reports/student',
      opportunityDetail: (id) => `/academic/field-training/opportunities/${id}`,
      evaluations: '/academic/field-training/reports/evaluations',
    };
  }
  if (mode === 'reviewer') {
    return {
      hub: basePath,
      university: `${basePath}/university`,
      students: `${basePath}/students`,
      opportunities: '/academic/field-training/opportunities',
      student: `${basePath}/student`,
      opportunityDetail: (id) => `/academic/field-training/opportunities/${id}`,
      evaluations: `${basePath}/evaluations`,
    };
  }
  return {
    hub: basePath,
    university: `${basePath}/university`,
    students: `${basePath}/students`,
    opportunities: `${basePath}/university`,
    student: `${basePath}/student`,
    opportunityDetail: () => `${basePath}/university`,
    evaluations: `${basePath}/evaluations`,
    templates: '/admin/field-training/evaluation-templates',
  };
}

export function resolveReportRoleContext(user, mode, serverCapabilities) {
  if (serverCapabilities?.roleContext) return serverCapabilities.roleContext;
  if (user?.isGlobal || user?.role === ROLES.SUPER_ADMIN) return 'super_admin';
  if (mode === 'reviewer' || user?.role === ROLES.REVIEWER) return 'reviewer';
  return 'admin';
}

export function mergeReportCapabilities(serverCapabilities, user, mode) {
  const roleContext = resolveReportRoleContext(user, mode, serverCapabilities);
  const defaults = {
    canViewUniversityReport: true,
    canViewStudentReport: true,
    canExportPdf: true,
    canExportExcel: true,
    canPrint: true,
    canGenerate: roleContext !== 'reviewer',
    canRegenerate: roleContext !== 'reviewer',
    canViewHistory: true,
    canDelete: false,
    canSelectUniversity: roleContext === 'super_admin',
    includeRawExcel: roleContext !== 'reviewer',
    readOnly: roleContext === 'reviewer',
    roleContext,
  };
  return { ...defaults, ...(serverCapabilities || {}), roleContext: serverCapabilities?.roleContext || roleContext };
}
