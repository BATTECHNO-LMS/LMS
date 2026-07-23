import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { saveFieldTrainingSubmissionBlob } from '../fieldTraining/fieldTrainingDownload.js';

const LEGACY_BASE = `${endpoints.reports}/field-training`;
const ADMIN_BASE = `${endpoints.adminFieldTraining}/reports`;
const ACADEMIC_BASE = `${endpoints.academicFieldTraining}`;

function normalizeParams(params = {}) {
  return {
    university_id: params.university_id || undefined,
    university_specialty_id: params.university_specialty_id || undefined,
    opportunity_id: params.opportunity_id || undefined,
    status: params.status || undefined,
    training_status: params.training_status || undefined,
    eligibility_status: params.eligibility_status || undefined,
    search: params.search || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
  };
}

function apiBase(mode = 'admin') {
  if (mode === 'academic') return ACADEMIC_BASE;
  if (mode === 'legacy') return LEGACY_BASE;
  return ADMIN_BASE;
}

function parseFilename(contentDisposition, fallback) {
  const match = /filename="([^"]+)"/i.exec(contentDisposition || '');
  return match?.[1] ?? fallback;
}

export async function fetchFieldTrainingDashboard(params = {}, mode = 'admin') {
  const base = apiBase(mode);
  const path = mode === 'academic' ? `${base}/dashboard` : `${base}`;
  const res = await apiClient.get(path, { params: normalizeParams(params) });
  return unwrapApiData(res);
}

export async function fetchFieldTrainingGlobalReport(params = {}) {
  const res = await apiClient.get(`${ADMIN_BASE}/global`, { params: normalizeParams(params) });
  return unwrapApiData(res);
}

export async function fetchFieldTrainingUniversityReport(params = {}, mode = 'admin') {
  const base = apiBase(mode);
  const path = mode === 'academic' ? `${base}/reports/university` : `${base}/university`;
  const res = await apiClient.get(path, { params: normalizeParams(params) });
  return unwrapApiData(res);
}

export async function fetchFieldTrainingApplicationsReport(params = {}, mode = 'admin') {
  const base = apiBase(mode);
  const path = `${base}/students`;
  const res = await apiClient.get(path, { params: normalizeParams(params) });
  return unwrapApiData(res);
}

export async function fetchFieldTrainingOpportunities(params = {}, mode = 'academic') {
  const base = apiBase(mode);
  const path = mode === 'academic' ? `${base}/opportunities` : `${base}/opportunities`;
  const res = await apiClient.get(path, { params: normalizeParams(params) });
  return unwrapApiData(res);
}

export async function fetchFieldTrainingOpportunityDetail(opportunityId, params = {}, mode = 'academic') {
  const base = apiBase(mode);
  const res = await apiClient.get(`${base}/opportunities/${opportunityId}`, {
    params: normalizeParams(params),
  });
  return unwrapApiData(res);
}

export async function fetchFieldTrainingStudentReport(applicationId, mode = 'admin') {
  const base = apiBase(mode);
  const path =
    mode === 'academic'
      ? `${base}/reports/students/${applicationId}`
      : `${base}/students/${applicationId}`;
  const res = await apiClient.get(path);
  return unwrapApiData(res);
}

export async function fetchFieldTrainingAnalytics(params = {}) {
  const res = await apiClient.get(`${endpoints.analytics}/field-training`, {
    params: normalizeParams(params),
  });
  return unwrapApiData(res);
}

export async function exportFieldTrainingGlobalReport(format = 'pdf', params = {}) {
  const suffix = format === 'pdf' ? 'pdf' : 'excel';
  const res = await apiClient.get(`${ADMIN_BASE}/global/export/${suffix}`, {
    params: normalizeParams(params),
    responseType: 'blob',
  });
  const filename = parseFilename(
    res.headers['content-disposition'],
    `field-training-global-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`
  );
  saveFieldTrainingSubmissionBlob({ blob: res.data, filename });
}

export async function exportFieldTrainingUniversityReport(format = 'pdf', params = {}, mode = 'admin') {
  const base = apiBase(mode);
  const suffix = format === 'pdf' ? 'pdf' : 'excel';
  const path =
    mode === 'academic'
      ? `${base}/reports/university/export/${suffix}`
      : `${base}/university/export/${suffix}`;
  const res = await apiClient.get(path, {
    params: normalizeParams(params),
    responseType: 'blob',
  });
  const filename = parseFilename(
    res.headers['content-disposition'],
    `field-training-university-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`
  );
  saveFieldTrainingSubmissionBlob({ blob: res.data, filename });
}

export async function exportFieldTrainingStudentReport(applicationId, format = 'pdf', mode = 'admin') {
  const base = apiBase(mode);
  const suffix = format === 'pdf' ? 'pdf' : 'excel';
  const path =
    mode === 'academic'
      ? `${base}/reports/students/${applicationId}/export/${suffix}`
      : `${base}/students/${applicationId}/export/${suffix}`;
  const res = await apiClient.get(path, {
    params: { format: format === 'pdf' ? 'pdf' : 'xlsx' },
    responseType: 'blob',
  });
  const filename = parseFilename(
    res.headers['content-disposition'],
    `field-training-student-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`
  );
  saveFieldTrainingSubmissionBlob({ blob: res.data, filename });
}
