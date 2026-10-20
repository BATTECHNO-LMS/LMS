import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { uploadFileToStorage } from '../uploads/uploadFileToStorage.js';
import {
  openRemoteDownloadUrl,
  saveFieldTrainingSubmissionBlob,
  parseFilename,
  rethrowBlobApiError,
  assertBlobDownloadSuccess,
} from './fieldTrainingDownload.js';

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

export async function fetchOpportunityOverviewSummary(opportunityId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/overview-summary`);
  return unwrapApiData(res);
}

export async function fetchOpportunityCommandCenter(
  opportunityId,
  params = {},
  { asInstructor = false } = {}
) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/command-center`, { params });
  return unwrapApiData(res);
}

export async function fetchApplicationProgressSnapshot(applicationId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/applications/${applicationId}/progress-snapshot`);
  return unwrapApiData(res);
}

export async function fetchOpportunityApplications(opportunityId, params = {}, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/applications`, { params });
  return unwrapApiData(res);
}

export async function exportOpportunityStudentsExcel(opportunityId, params = {}, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  try {
    const res = await apiClient.get(`${base}/${opportunityId}/applications/export/excel`, {
      params,
      responseType: 'blob',
      timeout: 120_000,
    });
    const filename = parseFilename(
      res.headers['content-disposition'],
      'طلاب_التدريب_الميداني.xlsx'
    );
    saveFieldTrainingSubmissionBlob({ blob: res.data, filename });
  } catch (err) {
    await rethrowBlobApiError(err);
  }
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
  const res = await apiClient.post(
    `${student}/tasks/${taskId}/submit`,
    {
      fileId: fileIds[0] || fileId || undefined,
      fileIds: fileIds.length ? fileIds : undefined,
      analysis_file_id: analysis_file_id || fileIds[0] || undefined,
      ...restMeta,
    },
    { timeout: 120000 }
  );
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

export async function fetchOpportunityRecordedLectures(opportunityId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/recorded-lectures`);
  return unwrapApiData(res);
}

export async function previewYoutubeRecordedLecture(opportunityId, url, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/${opportunityId}/recorded-lectures/youtube/preview`, { url });
  return unwrapApiData(res);
}

export async function importYoutubeRecordedLecture(opportunityId, url, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/${opportunityId}/recorded-lectures/youtube/import`, { url });
  return unwrapApiData(res);
}

export async function previewYoutubeRecordedLecturePlaylist(
  opportunityId,
  url,
  { asInstructor = false } = {}
) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/${opportunityId}/recorded-lectures/youtube/playlist/preview`, {
    url,
  });
  return unwrapApiData(res);
}

export async function importYoutubeRecordedLecturePlaylist(
  opportunityId,
  body,
  { asInstructor = false } = {}
) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(
    `${base}/${opportunityId}/recorded-lectures/youtube/playlist/import`,
    body
  );
  return unwrapApiData(res);
}

export async function updateRecordedLecture(lectureId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.patch(`${base}/recorded-lectures/${lectureId}`, body);
  return unwrapApiData(res);
}

export async function fetchRecordedLectureStudentProgress(
  lectureId,
  params = {},
  { asInstructor = false } = {}
) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/recorded-lectures/${lectureId}/students`, { params });
  return unwrapApiData(res);
}

export async function publishRecordedLecture(lectureId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/recorded-lectures/${lectureId}/publish`);
  return unwrapApiData(res);
}

export async function hideRecordedLecture(lectureId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/recorded-lectures/${lectureId}/hide`);
  return unwrapApiData(res);
}

export async function changeRecordedLectureStatus(lectureId, status, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.patch(`${base}/recorded-lectures/${lectureId}/status`, { status });
  return unwrapApiData(res);
}

export async function reorderOpportunityRecordedLectures(
  opportunityId,
  lectureIds,
  { asInstructor = false } = {}
) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.patch(`${base}/${opportunityId}/recorded-lectures/reorder`, {
    lecture_ids: lectureIds,
  });
  return unwrapApiData(res);
}

export async function previewRecordedLecturePlaylistSync(
  opportunityId,
  playlistId,
  { asInstructor = false } = {}
) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/${opportunityId}/recorded-lectures/youtube/playlist/sync/preview`, {
    playlist_id: playlistId,
  });
  return unwrapApiData(res);
}

export async function applyRecordedLecturePlaylistSync(
  opportunityId,
  body,
  { asInstructor = false } = {}
) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(
    `${base}/${opportunityId}/recorded-lectures/youtube/playlist/sync`,
    body
  );
  return unwrapApiData(res);
}

export async function fetchStudentRecordedLectures(opportunityId) {
  const res = await apiClient.get(`${student}/${opportunityId}/recorded-lectures`);
  return unwrapApiData(res);
}

export async function fetchStudentRecordedLecture(opportunityId, lectureId) {
  const res = await apiClient.get(`${student}/${opportunityId}/recorded-lectures/${lectureId}`);
  return unwrapApiData(res);
}

export async function startStudentRecordedLectureWatchSession(opportunityId, lectureId, body = {}) {
  const res = await apiClient.post(
    `${student}/${opportunityId}/recorded-lectures/${lectureId}/watch-session`,
    body
  );
  return unwrapApiData(res);
}

export async function sendStudentRecordedLectureHeartbeat(opportunityId, lectureId, body) {
  const res = await apiClient.post(
    `${student}/${opportunityId}/recorded-lectures/${lectureId}/heartbeat`,
    body
  );
  return unwrapApiData(res);
}

export async function sendStudentRecordedLecturePlayerEvent(opportunityId, lectureId, body) {
  const res = await apiClient.post(
    `${student}/${opportunityId}/recorded-lectures/${lectureId}/player-event`,
    body
  );
  return unwrapApiData(res);
}

export function recordedLectureHeartbeatUrl(opportunityId, lectureId) {
  return `${student}/${opportunityId}/recorded-lectures/${lectureId}/heartbeat`;
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

export async function confirmQrAttendance(body) {
  const res = await apiClient.post(`${student}/attendance/qr/confirm`, body);
  return unwrapApiData(res);
}

export async function fetchLiveQrAttendance(sessionId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/sessions/${sessionId}/attendance-qr/live`);
  return unwrapApiData(res);
}

export async function fetchInterventionKpis(opportunityId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/interventions/kpis`);
  return unwrapApiData(res);
}

export async function fetchInterventionCases(opportunityId, params = {}, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/interventions`, { params });
  return unwrapApiData(res);
}

export async function openInterventionCase(opportunityId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/${opportunityId}/interventions`, body);
  return unwrapApiData(res);
}

export async function fetchInterventionCase(caseId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/interventions/${caseId}`);
  return unwrapApiData(res);
}

export async function addInterventionFollowUp(caseId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/interventions/${caseId}/follow-up`, body);
  return unwrapApiData(res);
}

export async function assignInterventionCase(caseId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/interventions/${caseId}/assign`, body);
  return unwrapApiData(res);
}

export async function resolveInterventionCase(caseId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/interventions/${caseId}/resolve`, body);
  return unwrapApiData(res);
}

export async function reopenInterventionCase(caseId, body = {}, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/interventions/${caseId}/reopen`, body);
  return unwrapApiData(res);
}

export async function fetchExternalSupervisors(opportunityId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/external-supervisors`);
  return unwrapApiData(res);
}

export async function assignExternalSupervisor(opportunityId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/${opportunityId}/external-supervisors`, body);
  return unwrapApiData(res);
}

export async function revokeExternalSupervisor(assignmentId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/external-supervisors/${assignmentId}/revoke`);
  return unwrapApiData(res);
}

export async function fetchExternalSupervisorDashboard() {
  const res = await apiClient.get('/external/field-training/dashboard');
  return unwrapApiData(res);
}

export async function fetchExternalSupervisorStudent(applicationId) {
  const res = await apiClient.get(`/external/field-training/students/${applicationId}`);
  return unwrapApiData(res);
}

export async function confirmExternalHours(applicationId, body) {
  const res = await apiClient.post(`/external/field-training/students/${applicationId}/hours/confirm`, body);
  return unwrapApiData(res);
}

export async function submitExternalEvaluation(applicationId, body) {
  const res = await apiClient.post(`/external/field-training/students/${applicationId}/evaluation`, body);
  return unwrapApiData(res);
}

export async function reviewExternalLogbook(entryId, body) {
  const res = await apiClient.post(`/external/field-training/logbook/${entryId}/review`, body);
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

export async function saveStudentAssessmentProgress(opportunityId, type, answers) {
  const res = await apiClient.post(`${student}/${opportunityId}/assessments/${type}/save`, { answers });
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

export async function fetchComprehensiveStudentReport(
  opportunityId,
  applicationId,
  { asInstructor = false, params = {} } = {}
) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(
    `${base}/${opportunityId}/applications/${applicationId}/comprehensive-report`,
    { params }
  );
  return unwrapApiData(res);
}

export async function downloadComprehensiveStudentReportPdf(
  opportunityId,
  applicationId,
  { asInstructor = false, params = {} } = {}
) {
  const base = manageApiBase({ asInstructor });
  try {
    const res = await apiClient.get(
      `${base}/${opportunityId}/applications/${applicationId}/comprehensive-report/pdf`,
      { params, responseType: 'blob' }
    );
    const filename = parseFilename(
      res.headers['content-disposition'],
      `comprehensive-student-report-${applicationId}.pdf`
    );
    saveFieldTrainingSubmissionBlob({ blob: res.data, filename });
    return { blob: res.data, filename };
  } catch (err) {
    await rethrowBlobApiError(err);
  }
}

export async function previewBulkStudentReports(opportunityId, body = {}, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/${opportunityId}/reports/students/bulk-export/preview`, body);
  return unwrapApiData(res);
}

export async function startBulkStudentReports(opportunityId, body = {}, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/${opportunityId}/reports/students/bulk-export`, body, {
    timeout: 120000,
  });
  return unwrapApiData(res);
}

export async function fetchBulkStudentReportsJob(opportunityId, jobId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/reports/students/bulk-export/jobs/${jobId}`);
  return unwrapApiData(res);
}

export async function downloadBulkStudentReportsZip(opportunityId, jobId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  try {
    const res = await apiClient.get(
      `${base}/${opportunityId}/reports/students/bulk-export/jobs/${jobId}/download`,
      {
        responseType: 'blob',
        timeout: 300000,
        headers: {
          Accept: 'application/zip, application/octet-stream, */*',
        },
      }
    );
    await assertBlobDownloadSuccess(res);
    const filename = parseFilename(
      res.headers['content-disposition'],
      'eprojecto-field-training-student-reports.zip'
    );
    const zipBlob =
      res.data instanceof Blob
        ? res.data.type && res.data.type !== 'application/json'
          ? res.data
          : new Blob([res.data], { type: 'application/zip' })
        : new Blob([res.data], { type: 'application/zip' });
    saveFieldTrainingSubmissionBlob({ blob: zipBlob, filename });
    return {
      filename,
      included: Number(res.headers['x-zip-included'] || 0),
      failed: Number(res.headers['x-zip-failed'] || 0),
      matching: Number(res.headers['x-zip-matching'] || 0),
    };
  } catch (err) {
    await rethrowBlobApiError(err);
  }
}

export async function fetchOpportunityReportValidation(opportunityId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/reports/validation`);
  return unwrapApiData(res);
}

export async function fetchOpportunityFinalReport(opportunityId, { asInstructor = false, params = {} } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/reports/final`, { params });
  return unwrapApiData(res);
}

export async function fetchOpportunityComprehensiveReport(
  opportunityId,
  { asInstructor = false, params = {} } = {}
) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/reports/comprehensive`, { params });
  return unwrapApiData(res);
}

async function downloadOpportunityReportBlob(opportunityId, pathSuffix, fallbackName, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  try {
    const res = await apiClient.get(`${base}/${opportunityId}${pathSuffix}`, { responseType: 'blob' });
    const filename = parseFilename(res.headers['content-disposition'], fallbackName);
    saveFieldTrainingSubmissionBlob({ blob: res.data, filename });
    return { blob: res.data, filename };
  } catch (err) {
    await rethrowBlobApiError(err);
  }
}

export async function downloadOpportunityFinalReportPdf(opportunityId, opts = {}) {
  return downloadOpportunityReportBlob(
    opportunityId,
    '/reports/final/pdf',
    'Tafila_Field_Training_Final_Report_2025_2026.pdf',
    opts
  );
}

export async function downloadOpportunityComprehensiveReportPdf(opportunityId, opts = {}) {
  return downloadOpportunityReportBlob(
    opportunityId,
    '/reports/comprehensive/pdf',
    'Tafila_Field_Training_Comprehensive_Report_2025_2026.pdf',
    opts
  );
}

export async function downloadOpportunityOfficialExcel(opportunityId, opts = {}) {
  return downloadOpportunityReportBlob(
    opportunityId,
    '/reports/export/excel',
    'Tafila_Field_Training_Students_2025_2026.xlsx',
    opts
  );
}

export async function issueCompletionLetter(applicationId) {
  const res = await apiClient.post(`${admin}/applications/${applicationId}/issue-completion-letter`);
  return unwrapApiData(res);
}

export async function fetchCompletionLetters(opportunityId, params = {}) {
  const res = await apiClient.get(`${admin}/${opportunityId}/completion-letters`, { params });
  return unwrapApiData(res);
}

export async function previewBulkCompletionLetters(opportunityId, body = {}) {
  const res = await apiClient.post(`${admin}/${opportunityId}/completion-letters/preview-bulk-issue`, body);
  return unwrapApiData(res);
}

export async function startBulkCompletionLetters(opportunityId, body = {}) {
  const res = await apiClient.post(`${admin}/${opportunityId}/completion-letters/bulk-issue`, body, {
    timeout: 120000,
  });
  return unwrapApiData(res);
}

export async function fetchBulkCompletionLetterJob(opportunityId, jobId) {
  const res = await apiClient.get(`${admin}/${opportunityId}/completion-letters/jobs/${jobId}`);
  return unwrapApiData(res);
}

export async function retryBulkCompletionLetters(opportunityId, jobId) {
  const res = await apiClient.post(`${admin}/${opportunityId}/completion-letters/jobs/${jobId}/retry`);
  return unwrapApiData(res);
}

export async function downloadAllCompletionLetters(opportunityId) {
  try {
    const res = await apiClient.get(`${admin}/${opportunityId}/completion-letters/zip`, {
      responseType: 'blob',
      timeout: 180000,
    });
    const filename = parseFilename(res.headers['content-disposition'], 'completion-letters.zip');
    saveFieldTrainingSubmissionBlob({ blob: res.data, filename });
    return {
      filename,
      unissued: Number(res.headers['x-zip-unissued'] || 0),
      failed: Number(res.headers['x-zip-failed'] || 0),
      included: Number(res.headers['x-zip-included'] || 0),
      missing: Number(res.headers['x-zip-missing'] || 0),
    };
  } catch (err) {
    await rethrowBlobApiError(err);
  }
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

export async function updateAcademicSupervisorName(applicationId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.patch(`${base}/applications/${applicationId}/academic-supervisor`, body);
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

export async function fetchStudentLogbook(opportunityId, params = {}) {
  const res = await apiClient.get(`${student}/${opportunityId}/logbook`, { params });
  return unwrapApiData(res);
}

export async function createStudentLogbookEntry(opportunityId, body) {
  const res = await apiClient.post(`${student}/${opportunityId}/logbook`, body);
  return unwrapApiData(res);
}

export async function updateStudentLogbookEntry(entryId, body) {
  const res = await apiClient.patch(`${student}/logbook/${entryId}`, body);
  return unwrapApiData(res);
}

export async function submitStudentLogbookEntry(entryId) {
  const res = await apiClient.post(`${student}/logbook/${entryId}/submit`);
  return unwrapApiData(res);
}

export async function deleteStudentLogbookEntry(entryId) {
  const res = await apiClient.delete(`${student}/logbook/${entryId}`);
  return unwrapApiData(res);
}

export async function uploadStudentLogbookAttachment(entryId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post(`${student}/logbook/${entryId}/attachments`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return unwrapApiData(res);
}

export async function fetchStudentPortfolio(opportunityId) {
  const res = await apiClient.get(`${student}/${opportunityId}/portfolio`);
  return unwrapApiData(res);
}

export async function downloadStudentPortfolioPdf(opportunityId) {
  const res = await apiClient.get(`${student}/${opportunityId}/portfolio/pdf`, {
    responseType: 'blob',
    timeout: 120_000,
  });
  const blob = res.data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ملف-إنجاز-التدريب.pdf';
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchStaffLogbook(opportunityId, params = {}, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/${opportunityId}/logbook`, { params });
  return unwrapApiData(res);
}

export async function approveStaffLogbookEntry(entryId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/logbook/${entryId}/approve`);
  return unwrapApiData(res);
}

export async function requestStaffLogbookRevision(entryId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/logbook/${entryId}/request-revision`, body);
  return unwrapApiData(res);
}

export async function fetchApplicationPortfolio(applicationId, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.get(`${base}/applications/${applicationId}/portfolio`);
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
  try {
    const res = await apiClient.get(`${student}/completion-letters/${applicationId}/download`, {
      responseType: 'blob',
    });
    const filename = parseFilename(
      res.headers['content-disposition'],
      `completion-letter-${applicationId}.pdf`
    );
    return { blob: res.data, filename };
  } catch (err) {
    await rethrowBlobApiError(err);
  }
}

export async function previewCompletionLetter(applicationId) {
  try {
    const res = await apiClient.get(`${student}/completion-letters/${applicationId}/preview`, {
      responseType: 'blob',
    });
    const filename = parseFilename(
      res.headers['content-disposition'],
      `completion-letter-${applicationId}.pdf`
    );
    const url = URL.createObjectURL(res.data);
    const opened = typeof window !== 'undefined' ? window.open(url, '_blank', 'noopener,noreferrer') : null;
    if (!opened) {
      saveFieldTrainingSubmissionBlob({ blob: res.data, filename });
    }
    if (typeof window !== 'undefined') {
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
    return { blob: res.data, filename };
  } catch (err) {
    await rethrowBlobApiError(err);
  }
}

function letterManageBase({ asInstructor = false, asAcademic = false } = {}) {
  if (asAcademic) return academic;
  if (asInstructor) return instructor;
  return admin;
}

export async function previewAdminCompletionLetter(applicationId, opts = {}) {
  const base = letterManageBase(opts);
  try {
    const res = await apiClient.get(`${base}/applications/${applicationId}/completion-letter/preview`, {
      responseType: 'blob',
    });
    const filename = parseFilename(
      res.headers['content-disposition'],
      `completion-letter-${applicationId}.pdf`
    );
    const url = URL.createObjectURL(res.data);
    const opened = typeof window !== 'undefined' ? window.open(url, '_blank', 'noopener,noreferrer') : null;
    if (!opened) {
      saveFieldTrainingSubmissionBlob({ blob: res.data, filename });
    }
    if (typeof window !== 'undefined') {
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }
    return { blob: res.data, filename };
  } catch (err) {
    await rethrowBlobApiError(err);
  }
}

export async function downloadAdminCompletionLetter(applicationId, opts = {}) {
  const base = letterManageBase(opts);
  try {
    const res = await apiClient.get(`${base}/applications/${applicationId}/completion-letter/download`, {
      responseType: 'blob',
    });
    const filename = parseFilename(
      res.headers['content-disposition'],
      `completion-letter-${applicationId}.pdf`
    );
    saveFieldTrainingSubmissionBlob({ blob: res.data, filename });
    return { blob: res.data, filename };
  } catch (err) {
    await rethrowBlobApiError(err);
  }
}

export async function gradeAssessmentAttempt(attemptId, body, { asInstructor = false } = {}) {
  const base = manageApiBase({ asInstructor });
  const res = await apiClient.post(`${base}/assessment-attempts/${attemptId}/grade`, body);
  return unwrapApiData(res);
}
