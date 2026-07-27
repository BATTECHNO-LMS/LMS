import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { uploadFileToStorage } from '../uploads/uploadFileToStorage.js';
import { openRemoteDownloadUrl, saveFieldTrainingSubmissionBlob } from './fieldTrainingDownload.js';

const admin = endpoints.adminFieldTraining;
const student = endpoints.studentFieldTraining;
const instructor = endpoints.instructorFieldTraining;
const academic = endpoints.academicFieldTraining;

function manageApiBase({ asInstructor = false } = {}) {
  return asInstructor ? instructor : admin;
}

export async function fetchFieldTrainingEligibilityCatalog() {
  const res = await apiClient.get(`${admin}/eligibility-catalog`);
  return unwrapApiData(res);
}

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

export async function fetchOpportunityApplications(opportunityId, params = {}, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/applications`, { params });
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

export async function fetchOpportunityTasks(opportunityId, { asAdmin = false, asInstructor = false } = {}) {
  const base = asInstructor ? instructor : asAdmin ? admin : student;
  const res = await apiClient.get(`${base}/${opportunityId}/tasks`);
  return unwrapApiData(res);
}

export async function createOpportunityTask(opportunityId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/${opportunityId}/tasks`, body);
  return unwrapApiData(res);
}

export async function updateOpportunityTask(taskId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.patch(`${base}/tasks/${taskId}`, body);
  return unwrapApiData(res);
}

export async function deleteOpportunityTask(taskId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.delete(`${base}/tasks/${taskId}`);
  return unwrapApiData(res);
}

export async function fetchOpportunitySubmissions(opportunityId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/submissions`);
  return unwrapApiData(res);
}

export async function fetchInstructorFieldTrainingList(params = {}) {
  const res = await apiClient.get(instructor, { params });
  return unwrapApiData(res);
}

export async function fetchInstructorFieldTraining(id) {
  const res = await apiClient.get(`${instructor}/${id}`);
  return unwrapApiData(res);
}

export async function submitFieldTrainingTask(taskId, file, meta = {}) {
  const files = Array.isArray(file) ? file.filter(Boolean) : file ? [file] : [];
  const fileIds = [...(meta.fileIds || [])];
  for (const f of files) {
    const record = await uploadFileToStorage(f, {
      folder: 'training',
      visibility: 'private',
      accept: meta.accept || undefined,
      maxBytes: meta.maxBytes || 100 * 1024 * 1024,
      relatedEntityType: 'field_training_task',
      relatedEntityId: taskId,
      onProgress: meta.onProgress,
    });
    fileIds.push(record.id);
  }
  const { onProgress, accept, maxBytes, ...restMeta } = meta;
  const res = await apiClient.post(`${student}/tasks/${taskId}/submit`, {
    fileId: fileIds[0] || undefined,
    fileIds: fileIds.length ? fileIds : undefined,
    ...restMeta,
  });
  return unwrapApiData(res);
}

export async function fetchAiSupportedSubmissionFileTypes() {
  const res = await apiClient.get(`${student}/submissions/ai-supported-file-types`);
  return unwrapApiData(res);
}

export async function runTaskAiSelfEvaluate(taskId, payload) {
  const body =
    typeof payload === 'string'
      ? { studentDescription: payload }
      : {
          studentDescription: payload.studentDescription,
          uploadedFileId: payload.uploadedFileId || null,
          uploadedFileIds: payload.uploadedFileIds || undefined,
          projectUrl: payload.projectUrl || null,
        };
  const res = await apiClient.post(`${student}/tasks/${taskId}/ai-self-evaluate`, body);
  return unwrapApiData(res);
}

export async function submitFieldTrainingTaskWithMeta(taskId, file, meta = {}) {
  let fileIds = [...(meta.fileIds || [])];
  if (meta.fileId) fileIds.push(meta.fileId);
  if (meta.analysis_file_id) fileIds.push(meta.analysis_file_id);
  const files = Array.isArray(file) ? file.filter(Boolean) : file ? [file] : [];
  for (const f of files) {
    const record = await uploadFileToStorage(f, {
      folder: 'training',
      visibility: 'private',
      accept: meta.accept || undefined,
      maxBytes: meta.maxBytes || 100 * 1024 * 1024,
      relatedEntityType: 'field_training_task',
      relatedEntityId: taskId,
      onProgress: meta.onProgress,
    });
    fileIds.push(record.id);
  }
  fileIds = [...new Set(fileIds.filter(Boolean))];
  const { onProgress, accept, maxBytes, fileId, analysis_file_id, ...restMeta } = meta;
  const res = await apiClient.post(`${student}/tasks/${taskId}/submit`, {
    fileId: fileIds[0] || fileId || undefined,
    fileIds: fileIds.length ? fileIds : undefined,
    analysis_file_id: analysis_file_id || fileIds[0] || undefined,
    ...restMeta,
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
export async function downloadFieldTrainingSubmission(
  submissionId,
  { asAdmin = false, asInstructor = false } = {}
) {
  const base = asInstructor ? instructor : asAdmin ? admin : student;
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

export async function downloadTaskInstructionFile(
  taskId,
  { asAdmin = false, asInstructor = false, asAcademic = false } = {}
) {
  const base = asAcademic ? academic : asInstructor ? instructor : asAdmin ? admin : student;
  const metaRes = await apiClient.get(`${base}/tasks/${taskId}/instruction-file/download-url`);
  const meta = unwrapApiData(metaRes);

  if (meta?.url) {
    openRemoteDownloadUrl(meta.url);
    return null;
  }

  const res = await apiClient.get(`${base}/tasks/${taskId}/instruction-file/download`, {
    responseType: 'blob',
  });
  const filename = parseDownloadFilename(
    res.headers['content-disposition'],
    meta?.file_name || `task-instruction-${taskId}`
  );
  return { blob: res.data, filename };
}

export async function reviewFieldTrainingSubmission(submissionId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.patch(`${base}/submissions/${submissionId}/review`, body);
  return unwrapApiData(res);
}

export async function fetchFieldTrainingInstructors() {
  const res = await apiClient.get(`${admin}/instructors`);
  return unwrapApiData(res);
}

export async function startFieldTraining(opportunityId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/${opportunityId}/start-training`);
  return unwrapApiData(res);
}

export async function fetchOpportunitySessions(opportunityId, { asAdmin = true, asInstructor = false } = {}) {
  const base = asInstructor ? instructor : asAdmin ? admin : student;
  const res = await apiClient.get(`${base}/${opportunityId}/sessions`);
  return unwrapApiData(res);
}

export async function createOpportunitySession(opportunityId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/${opportunityId}/sessions`, body);
  return unwrapApiData(res);
}

export async function updateOpportunitySession(sessionId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.patch(`${base}/sessions/${sessionId}`, body);
  return unwrapApiData(res);
}

export async function deleteOpportunitySession(sessionId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.delete(`${base}/sessions/${sessionId}`);
  return unwrapApiData(res);
}

export async function saveSessionAttendance(sessionId, records, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/sessions/${sessionId}/attendance`, { records });
  return unwrapApiData(res);
}

export async function openAttendanceWindow(sessionId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/sessions/${sessionId}/attendance-window/open`, body);
  return unwrapApiData(res);
}

export async function fetchAttendanceWindow(sessionId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/sessions/${sessionId}/attendance-window`);
  return unwrapApiData(res);
}

export async function closeAttendanceWindow(sessionId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/sessions/${sessionId}/attendance-window/close`);
  return unwrapApiData(res);
}

export async function finalizeAttendanceAbsences(sessionId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/sessions/${sessionId}/attendance/finalize-absences`);
  return unwrapApiData(res);
}

export async function markAllPresent(
  sessionId,
  body,
  { asInstructor = false } = {}
) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/sessions/${sessionId}/attendance/mark-all-present`, body);
  return unwrapApiData(res);
}

export async function patchStudentAttendance(
  sessionId,
  studentId,
  body,
  { asInstructor = false } = {}
) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.patch(`${base}/sessions/${sessionId}/attendance/${studentId}`, body);
  return unwrapApiData(res);
}

export async function fetchActiveAttendanceWindows() {
  const res = await apiClient.get(`${student}/attendance-window/active`);
  return unwrapApiData(res);
}

export async function confirmAttendanceWindow(body) {
  const res = await apiClient.post(`${student}/attendance-window/confirm`, body);
  return unwrapApiData(res);
}

export async function fetchSessionParticipants(sessionId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/sessions/${sessionId}/participants`);
  return unwrapApiData(res);
}

export async function saveOpportunityAssessment(opportunityId, type, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.put(`${base}/${opportunityId}/assessments/${type}`, body);
  return unwrapApiData(res);
}

export async function publishOpportunityAssessment(opportunityId, type, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/${opportunityId}/assessments/${type}/publish`);
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

export async function expelFieldTrainingParticipant(applicationId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/applications/${applicationId}/expel`, body);
  return unwrapApiData(res);
}

export async function requestFieldTrainingExpulsion(applicationId, body, { asInstructor = true } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/applications/${applicationId}/request-expulsion`, body);
  return unwrapApiData(res);
}

export async function fetchOpportunityEligibility(opportunityId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/eligibility`);
  return unwrapApiData(res);
}

export async function issueCompletionLetter(applicationId) {
  const res = await apiClient.post(`${admin}/applications/${applicationId}/issue-completion-letter`);
  return unwrapApiData(res);
}

export async function fetchApplicationProgress(applicationId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/applications/${applicationId}/progress`);
  return unwrapApiData(res);
}

export async function fetchApplicationHours(applicationId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/applications/${applicationId}/hours`);
  return unwrapApiData(res);
}

/** Replace total completed hours (Model A aggregate). */
export async function updateApplicationHours(applicationId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.patch(`${base}/applications/${applicationId}/hours`, body);
  return unwrapApiData(res);
}

export async function recalculateApplicationEligibility(applicationId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/applications/${applicationId}/recalculate-eligibility`);
  return unwrapApiData(res);
}

export async function fetchStudentTrainingProgress(opportunityId) {
  const res = await apiClient.get(`${student}/${opportunityId}/progress`);
  return unwrapApiData(res);
}

export async function fetchSessionAttendance(sessionId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/sessions/${sessionId}/attendance`);
  return unwrapApiData(res);
}

export async function fetchOpportunityAssessments(opportunityId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/assessments`);
  return unwrapApiData(res);
}

export async function createOpportunityAssessment(opportunityId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/${opportunityId}/assessments`, body);
  return unwrapApiData(res);
}

export async function updateAssessment(assessmentId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.patch(`${base}/assessments/${assessmentId}`, body);
  return unwrapApiData(res);
}

export async function publishAssessmentById(assessmentId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/assessments/${assessmentId}/publish`);
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

export async function downloadAdminCompletionLetter(applicationId, { asInstructor = false } = {}) {
  const base = asInstructor ? instructor : admin;
  const res = await apiClient.get(`${base}/applications/${applicationId}/completion-letter/download`, {
    responseType: 'blob',
  });
  const filename = parseDownloadFilename(
    res.headers['content-disposition'],
    `completion-letter-${applicationId}.pdf`
  );
  const blob = res.data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return { blob, filename };
}

export async function gradeAssessmentAttempt(attemptId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/assessment-attempts/${attemptId}/grade`, body);
  return unwrapApiData(res);
}
