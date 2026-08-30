import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { saveFieldTrainingSubmissionBlob } from '../fieldTraining/fieldTrainingDownload.js';

function apiBase(scope = 'admin') {
  if (scope === 'reviewer' || scope === 'academic') return endpoints.academicFieldTraining;
  if (scope === 'instructor') return endpoints.instructorFieldTraining;
  if (scope === 'student') return endpoints.studentFieldTraining;
  return endpoints.adminFieldTraining;
}

function parseFilename(contentDisposition, fallback) {
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition || '');
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1]);
    } catch {
      /* keep fallback */
    }
  }
  const match = /filename="([^"]+)"/i.exec(contentDisposition || '');
  return match?.[1] ?? fallback;
}

async function rethrowBlobApiError(err) {
  const data = err?.response?.data;
  if (data && typeof data.text === 'function') {
    try {
      err.response.data = JSON.parse(await data.text());
    } catch {
      /* keep blob */
    }
  }
  throw err;
}

function saveBlobResponse(res, fallback) {
  const filename = parseFilename(res.headers?.['content-disposition'], fallback);
  saveFieldTrainingSubmissionBlob({ blob: res.data, filename });
  return {
    filename,
    selected: res.headers?.['x-zip-selected'] || res.headers?.['x-eval-selected'],
    included: res.headers?.['x-zip-included'],
    missing: res.headers?.['x-zip-missing'],
    failed: res.headers?.['x-zip-failed'],
  };
}

export async function fetchEvaluationTemplates(params = {}, scope = 'admin') {
  const res = await apiClient.get(`${apiBase(scope)}/evaluation-templates`, { params });
  return unwrapApiData(res);
}

export async function uploadEvaluationTemplate(formData, scope = 'admin', opportunityId, options = {}) {
  const path = opportunityId
    ? `${apiBase(scope)}/${opportunityId}/evaluation-template`
    : `${apiBase(scope)}/evaluation-templates`;
  const res = await apiClient.post(path, formData, { timeout: 120000, ...options });
  return unwrapApiData(res);
}

export async function setDefaultEvaluationTemplate(templateId, scope = 'admin') {
  const res = await apiClient.post(`${apiBase(scope)}/evaluation-templates/${templateId}/default`);
  return unwrapApiData(res);
}

export async function previewEvaluationTemplate(templateId, scope = 'admin') {
  const res = await apiClient.get(`${apiBase(scope)}/evaluation-templates/${templateId}/preview`);
  return unwrapApiData(res);
}

export async function previewEvaluationApplicationPayload(applicationId, scope = 'admin') {
  const res = await apiClient.get(`${apiBase(scope)}/applications/${applicationId}/evaluation-report/preview`);
  return unwrapApiData(res);
}

export async function downloadEvaluationTemplate(templateId, scope = 'admin') {
  try {
    const res = await apiClient.get(`${apiBase(scope)}/evaluation-templates/${templateId}/download`, {
      responseType: 'blob',
    });
    return saveBlobResponse(res, 'evaluation-template.docx');
  } catch (err) {
    await rethrowBlobApiError(err);
  }
}

export async function fetchOpportunityEvaluationTemplate(opportunityId, scope = 'admin') {
  const res = await apiClient.get(`${apiBase(scope)}/${opportunityId}/evaluation-template`);
  return unwrapApiData(res);
}

export async function assignOpportunityEvaluationTemplate(opportunityId, templateId, scope = 'admin') {
  const res = await apiClient.post(`${apiBase(scope)}/${opportunityId}/evaluation-template/assign`, {
    template_id: templateId,
  });
  return unwrapApiData(res);
}

export async function useUniversityDefaultEvaluationTemplate(opportunityId, scope = 'admin') {
  const res = await apiClient.post(`${apiBase(scope)}/${opportunityId}/evaluation-template/use-default`);
  return unwrapApiData(res);
}

export async function fetchEvaluationPolicy(params = {}, scope = 'admin') {
  const res = await apiClient.get(`${apiBase(scope)}/evaluation-policies`, { params });
  return unwrapApiData(res);
}

export async function saveEvaluationPolicy(body, scope = 'admin') {
  const res = await apiClient.put(`${apiBase(scope)}/evaluation-policies`, body);
  return unwrapApiData(res);
}

export async function fetchEvaluationReports(params = {}, scope = 'admin') {
  const res = await apiClient.get(`${apiBase(scope)}/evaluation-reports`, { params });
  return unwrapApiData(res);
}

export async function generateEvaluationReports(applicationIds, { regenerate, regenerationReason } = {}, scope = 'admin') {
  const res = await apiClient.post(`${apiBase(scope)}/evaluation-reports/generate`, {
    application_ids: applicationIds,
    regenerate,
    regeneration_reason: regenerationReason,
  });
  return unwrapApiData(res);
}

export async function generateOpportunityEvaluationReports(opportunityId, scope = 'admin') {
  const res = await apiClient.post(
    `${apiBase(scope)}/${opportunityId}/evaluation-reports/generate`,
    {},
    { timeout: 900000 }
  );
  return unwrapApiData(res);
}

export async function downloadEvaluationReportPdf(evaluationId, scope = 'admin') {
  try {
    const res = await apiClient.get(`${apiBase(scope)}/evaluation-reports/${evaluationId}/download`, {
      responseType: 'blob',
    });
    return saveBlobResponse(res, 'FieldTrainingEvaluation.pdf');
  } catch (err) {
    await rethrowBlobApiError(err);
  }
}

export async function downloadEvaluationReportsZip(body, scope = 'admin') {
  try {
    const res = await apiClient.post(`${apiBase(scope)}/evaluation-reports/zip`, body, {
      responseType: 'blob',
    });
    return saveBlobResponse(res, 'Field_Training_Reports.zip');
  } catch (err) {
    await rethrowBlobApiError(err);
  }
}

export async function saveSupervisorRating(applicationId, body, scope = 'admin') {
  const res = await apiClient.post(`${apiBase(scope)}/applications/${applicationId}/supervisor-ratings`, body);
  return unwrapApiData(res);
}

export async function fetchSupervisorRatings(applicationId, scope = 'admin') {
  const res = await apiClient.get(`${apiBase(scope)}/applications/${applicationId}/supervisor-ratings`);
  return unwrapApiData(res);
}

export async function fetchAcademicSupervisors(opportunityId, scope = 'admin') {
  const res = await apiClient.get(`${apiBase(scope)}/${opportunityId}/academic-supervisors`);
  return unwrapApiData(res);
}

export async function downloadSupervisorAssignmentTemplate(opportunityId, scope = 'admin') {
  try {
    const res = await apiClient.get(`${apiBase(scope)}/${opportunityId}/supervisor-assignments/template`, {
      responseType: 'blob',
    });
    return saveBlobResponse(res, 'supervisor-template.xlsx');
  } catch (err) {
    await rethrowBlobApiError(err);
  }
}

export async function previewSupervisorAssignments(opportunityId, file, scope = 'admin') {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiClient.post(`${apiBase(scope)}/${opportunityId}/supervisor-assignments/preview`, fd, {
    timeout: 120000,
  });
  return unwrapApiData(res);
}

export async function resolveSupervisorAssignments(opportunityId, body, scope = 'admin') {
  const res = await apiClient.post(`${apiBase(scope)}/${opportunityId}/supervisor-assignments/resolve`, body);
  return unwrapApiData(res);
}

export async function applySupervisorAssignments(opportunityId, body, scope = 'admin') {
  const res = await apiClient.post(`${apiBase(scope)}/${opportunityId}/supervisor-assignments/apply`, body);
  return unwrapApiData(res);
}

export async function fetchSupervisorGroups(params, scope = 'admin') {
  const res = await apiClient.get(`${apiBase(scope)}/evaluation-reports/supervisor-groups`, { params });
  return unwrapApiData(res);
}

export async function downloadSupervisorReportsZip(body, scope = 'admin') {
  try {
    const res = await apiClient.post(`${apiBase(scope)}/evaluation-reports/supervisor-zip`, body, {
      responseType: 'blob',
      timeout: 180000,
    });
    const meta = {
      selected: Number(res.headers?.['x-zip-selected'] || 0),
      included: Number(res.headers?.['x-zip-included'] || 0),
      missing: Number(res.headers?.['x-zip-missing'] || 0),
      failed: Number(res.headers?.['x-zip-failed'] || 0),
      skipped: Number(res.headers?.['x-zip-skipped'] || 0),
    };
    saveBlobResponse(res, 'supervisor-reports.zip');
    return meta;
  } catch (err) {
    await rethrowBlobApiError(err);
  }
}

export { FINAL_STATUS_LABELS } from './evaluationLabels.js';
