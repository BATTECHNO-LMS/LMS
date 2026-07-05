import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

const admin = endpoints.adminFieldTraining;
const student = endpoints.studentFieldTraining;

export async function fetchAdminFieldTrainingList(params = {}) {
  const res = await apiClient.get(admin, { params });
  return unwrapApiData(res);
}

export async function fetchAdminFieldTrainingStats(params = {}) {
  const res = await apiClient.get(`${admin}/stats`, { params });
  return unwrapApiData(res);
}

export async function fetchAdminFieldTraining(id) {
  const res = await apiClient.get(`${admin}/${id}`);
  return unwrapApiData(res);
}

export async function createAdminFieldTraining(body) {
  const res = await apiClient.post(admin, body);
  return unwrapApiData(res);
}

export async function updateAdminFieldTraining(id, body) {
  const res = await apiClient.patch(`${admin}/${id}`, body);
  return unwrapApiData(res);
}

export async function publishAdminFieldTraining(id) {
  const res = await apiClient.post(`${admin}/${id}/publish`);
  return unwrapApiData(res);
}

export async function archiveAdminFieldTraining(id) {
  const res = await apiClient.post(`${admin}/${id}/archive`);
  return unwrapApiData(res);
}

export async function fetchOpportunityApplications(opportunityId) {
  const res = await apiClient.get(`${admin}/${opportunityId}/applications`);
  return unwrapApiData(res);
}

export async function reviewFieldTrainingApplication(applicationId, body) {
  const res = await apiClient.patch(`${admin}/applications/${applicationId}/status`, body);
  return unwrapApiData(res);
}

export async function fetchStudentFieldTrainingList(params = {}) {
  const res = await apiClient.get(student, { params });
  return unwrapApiData(res);
}

export async function fetchStudentFieldTraining(id) {
  const res = await apiClient.get(`${student}/${id}`);
  return unwrapApiData(res);
}

export async function fetchMyFieldTrainingApplications() {
  const res = await apiClient.get(`${student}/my-applications`);
  return unwrapApiData(res);
}

export async function applyToFieldTraining(id, body) {
  const res = await apiClient.post(`${student}/${id}/apply`, body);
  return unwrapApiData(res);
}

export async function cancelFieldTrainingApplication(applicationId) {
  const res = await apiClient.patch(`${student}/applications/${applicationId}/cancel`);
  return unwrapApiData(res);
}

export async function fetchOpportunityTasks(opportunityId, { asAdmin = false } = {}) {
  const base = asAdmin ? admin : student;
  const res = await apiClient.get(`${base}/${opportunityId}/tasks`);
  return unwrapApiData(res);
}

export async function createOpportunityTask(opportunityId, body) {
  const res = await apiClient.post(`${admin}/${opportunityId}/tasks`, body);
  return unwrapApiData(res);
}

export async function updateOpportunityTask(taskId, body) {
  const res = await apiClient.patch(`${admin}/tasks/${taskId}`, body);
  return unwrapApiData(res);
}

export async function deleteOpportunityTask(taskId) {
  const res = await apiClient.delete(`${admin}/tasks/${taskId}`);
  return unwrapApiData(res);
}

export async function fetchOpportunitySubmissions(opportunityId) {
  const res = await apiClient.get(`${admin}/${opportunityId}/submissions`);
  return unwrapApiData(res);
}

export async function submitFieldTrainingTask(taskId, file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await apiClient.post(`${student}/tasks/${taskId}/submit`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrapApiData(res);
}

function parseDownloadFilename(disposition, fallback) {
  const match = /filename="?([^"]+)"?/i.exec(disposition || '');
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

export async function downloadFieldTrainingSubmission(submissionId, { asAdmin = false } = {}) {
  const base = asAdmin ? admin : student;
  const res = await apiClient.get(`${base}/submissions/${submissionId}/download`, {
    responseType: 'blob',
  });
  const filename = parseDownloadFilename(
    res.headers['content-disposition'],
    `field-training-submission-${submissionId}`
  );
  return { blob: res.data, filename };
}
