import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { uploadFileToStorage } from '../uploads/uploadFileToStorage.js';
import { openRemoteDownloadUrl } from './fieldTrainingDownload.js';

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
  const record = await uploadFileToStorage(file, {
    folder: 'training',
    visibility: 'private',
    accept: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
    ],
    relatedEntityType: 'field_training_task',
    relatedEntityId: taskId,
  });
  const res = await apiClient.post(`${student}/tasks/${taskId}/submit`, { fileId: record.id });
  return unwrapApiData(res);
}

export async function submitFieldTrainingTaskWithMeta(taskId, file, meta = {}) {
  const record = await uploadFileToStorage(file, {
    folder: 'training',
    visibility: 'private',
    accept: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
    ],
    relatedEntityType: 'field_training_task',
    relatedEntityId: taskId,
  });
  const res = await apiClient.post(`${student}/tasks/${taskId}/submit`, {
    fileId: record.id,
    ...meta,
  });
  return unwrapApiData(res);
}

function parseDownloadFilename(disposition, fallback) {
  const match = /filename="?([^"]+)"?/i.exec(disposition || '');
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

/**
 * Download a field training submission.
 * R2 files: fetches a presigned URL from the API, then opens it in a new tab.
 * Local files: streams via authenticated request and returns a blob for saving.
 * @returns {Promise<{ blob: Blob; filename: string } | null>}
 */
export async function downloadFieldTrainingSubmission(submissionId, { asAdmin = false } = {}) {
  const base = asAdmin ? admin : student;
  const metaRes = await apiClient.get(`${base}/submissions/${submissionId}/download-url`);
  const meta = unwrapApiData(metaRes);

  if (meta?.url) {
    openRemoteDownloadUrl(meta.url);
    return null;
  }

  const res = await apiClient.get(`${base}/submissions/${submissionId}/download`, {
    responseType: 'blob',
  });
  const filename = parseDownloadFilename(
    res.headers['content-disposition'],
    `field-training-submission-${submissionId}`
  );
  return { blob: res.data, filename };
}

export async function fetchFieldTrainingInstructors() {
  const res = await apiClient.get(`${admin}/instructors`);
  return unwrapApiData(res);
}

export async function startFieldTraining(opportunityId) {
  const res = await apiClient.post(`${admin}/${opportunityId}/start-training`);
  return unwrapApiData(res);
}

export async function fetchOpportunitySessions(opportunityId, { asAdmin = true } = {}) {
  const base = asAdmin ? admin : student;
  const res = await apiClient.get(`${base}/${opportunityId}/sessions`);
  return unwrapApiData(res);
}

export async function createOpportunitySession(opportunityId, body) {
  const res = await apiClient.post(`${admin}/${opportunityId}/sessions`, body);
  return unwrapApiData(res);
}

export async function updateOpportunitySession(sessionId, body) {
  const res = await apiClient.patch(`${admin}/sessions/${sessionId}`, body);
  return unwrapApiData(res);
}

export async function deleteOpportunitySession(sessionId) {
  const res = await apiClient.delete(`${admin}/sessions/${sessionId}`);
  return unwrapApiData(res);
}

export async function saveSessionAttendance(sessionId, records) {
  const res = await apiClient.post(`${admin}/sessions/${sessionId}/attendance`, { records });
  return unwrapApiData(res);
}

export async function fetchSessionParticipants(sessionId) {
  const res = await apiClient.get(`${admin}/sessions/${sessionId}/participants`);
  return unwrapApiData(res);
}

export async function saveOpportunityAssessment(opportunityId, type, body) {
  const res = await apiClient.put(`${admin}/${opportunityId}/assessments/${type}`, body);
  return unwrapApiData(res);
}

export async function publishOpportunityAssessment(opportunityId, type) {
  const res = await apiClient.post(`${admin}/${opportunityId}/assessments/${type}/publish`);
  return unwrapApiData(res);
}

export async function fetchStudentAssessment(opportunityId, type) {
  const res = await apiClient.get(`${student}/${opportunityId}/assessments/${type}`);
  return unwrapApiData(res);
}

export async function submitStudentAssessment(opportunityId, type, answers) {
  const res = await apiClient.post(`${student}/${opportunityId}/assessments/${type}/submit`, { answers });
  return unwrapApiData(res);
}

export async function runTaskAiSelfEvaluate(taskId, studentInput) {
  const res = await apiClient.post(`${student}/tasks/${taskId}/ai-self-evaluate`, { studentInput });
  return unwrapApiData(res);
}

export async function expelFieldTrainingParticipant(applicationId, body) {
  const res = await apiClient.post(`${admin}/applications/${applicationId}/expel`, body);
  return unwrapApiData(res);
}

export async function issueCompletionLetter(applicationId) {
  const res = await apiClient.post(`${admin}/applications/${applicationId}/issue-completion-letter`);
  return unwrapApiData(res);
}

export async function fetchApplicationProgress(applicationId) {
  const res = await apiClient.get(`${admin}/applications/${applicationId}/progress`);
  return unwrapApiData(res);
}

export async function fetchStudentTrainingProgress(opportunityId) {
  const res = await apiClient.get(`${student}/${opportunityId}/progress`);
  return unwrapApiData(res);
}

export async function fetchSessionAttendance(sessionId) {
  const res = await apiClient.get(`${admin}/sessions/${sessionId}/attendance`);
  return unwrapApiData(res);
}

export async function fetchOpportunityAssessments(opportunityId) {
  const res = await apiClient.get(`${admin}/${opportunityId}/assessments`);
  return unwrapApiData(res);
}

export async function createOpportunityAssessment(opportunityId, body) {
  const res = await apiClient.post(`${admin}/${opportunityId}/assessments`, body);
  return unwrapApiData(res);
}

export async function updateAssessment(assessmentId, body) {
  const res = await apiClient.patch(`${admin}/assessments/${assessmentId}`, body);
  return unwrapApiData(res);
}

export async function publishAssessmentById(assessmentId) {
  const res = await apiClient.post(`${admin}/assessments/${assessmentId}/publish`);
  return unwrapApiData(res);
}

export async function fetchStudentAssessments(opportunityId) {
  const res = await apiClient.get(`${student}/${opportunityId}/assessments`);
  return unwrapApiData(res);
}

export async function submitAssessmentById(assessmentId, answers) {
  const res = await apiClient.post(`${student}/assessments/${assessmentId}/submit`, { answers });
  return unwrapApiData(res);
}

export async function reviewFieldTrainingSubmission(submissionId, body) {
  const res = await apiClient.patch(`${admin}/submissions/${submissionId}/review`, body);
  return unwrapApiData(res);
}

export async function downloadCompletionLetter(applicationId) {
  const res = await apiClient.get(`${student}/completion-letters/${applicationId}/download`, {
    responseType: 'blob',
  });
  const filename = parseDownloadFilename(
    res.headers['content-disposition'],
    `completion-letter-${applicationId}.pdf`
  );
  return { blob: res.data, filename };
}
