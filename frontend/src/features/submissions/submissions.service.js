import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

export async function fetchSubmissionsList(params = {}) {
  const res = await apiClient.get(endpoints.submissions, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.submissions)) {
    throw new Error('Invalid submissions list response');
  }
  return data;
}

export async function fetchSubmissionById(id) {
  const res = await apiClient.get(`${endpoints.submissions}/${id}`);
  return unwrapApiData(res);
}

/** POST /api/v1/assessments/:assessmentId/submissions */
export async function createAcademicSubmission(assessmentId, body) {
  const res = await apiClient.post(`${endpoints.assessments}/${assessmentId}/submissions`, body);
  return unwrapApiData(res);
}

/** PUT /api/v1/submissions/:id */
export async function updateAcademicSubmission(submissionId, body) {
  const res = await apiClient.put(`${endpoints.submissions}/${submissionId}`, body);
  return unwrapApiData(res);
}
