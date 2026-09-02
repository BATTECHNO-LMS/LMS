import { apiClient } from '../../services/apiClient.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { endpoints } from '../../services/endpoints.js';

const base = endpoints.training;

function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

export async function listPrograms(organizationId) {
  const res = await apiClient.get(`${base}/organizations/${organizationId}/programs`);
  return asList(unwrapApiData(res));
}

/** Super admin / institution admin: TRAINING_COURSE list (scoped in Backend). */
export async function listTrainingCourses(params = {}) {
  const res = await apiClient.get(`${base}/courses`, { params });
  return asList(unwrapApiData(res));
}

export async function createProgram(organizationId, body) {
  const res = await apiClient.post(`${base}/organizations/${organizationId}/programs`, body);
  return unwrapApiData(res);
}

export async function getProgram(programId) {
  const res = await apiClient.get(`${base}/programs/${programId}`);
  return unwrapApiData(res);
}

export async function updateProgram(programId, body) {
  const res = await apiClient.patch(`${base}/programs/${programId}`, body);
  return unwrapApiData(res);
}

export async function publishProgram(programId) {
  const res = await apiClient.post(`${base}/programs/${programId}/publish`);
  return unwrapApiData(res);
}

export async function listCohorts(programId) {
  const res = await apiClient.get(`${base}/programs/${programId}/cohorts`);
  return asList(unwrapApiData(res));
}

export async function createCohort(programId, body) {
  const res = await apiClient.post(`${base}/programs/${programId}/cohorts`, body);
  return unwrapApiData(res);
}

export async function listEnrollments(cohortId) {
  const res = await apiClient.get(`${base}/cohorts/${cohortId}/enrollments`);
  return asList(unwrapApiData(res));
}

export async function enrollUser(cohortId, body) {
  const res = await apiClient.post(`${base}/cohorts/${cohortId}/enrollments`, body);
  return unwrapApiData(res);
}

export async function listCohortSessions(cohortId) {
  const res = await apiClient.get(`${base}/cohorts/${cohortId}/sessions`);
  return asList(unwrapApiData(res));
}

export async function createSession(cohortId, body) {
  const res = await apiClient.post(`${base}/cohorts/${cohortId}/sessions`, body);
  return unwrapApiData(res);
}

export async function updateSession(sessionId, body) {
  const res = await apiClient.patch(`${base}/sessions/${sessionId}`, body);
  return unwrapApiData(res);
}

export async function openAttendanceWindow(sessionId, body = {}) {
  const res = await apiClient.post(`${base}/sessions/${sessionId}/attendance-window`, body);
  return unwrapApiData(res);
}

export async function listSessionAttendance(sessionId) {
  const res = await apiClient.get(`${base}/sessions/${sessionId}/attendance`);
  return unwrapApiData(res);
}

export async function setAttendanceStatus(sessionId, body) {
  const res = await apiClient.post(`${base}/sessions/${sessionId}/attendance/status`, body);
  return unwrapApiData(res);
}

export async function markAllPresent(sessionId, body = {}) {
  const res = await apiClient.post(`${base}/sessions/${sessionId}/attendance/mark-all-present`, body);
  return unwrapApiData(res);
}

export async function confirmAttendance(sessionId, code) {
  const res = await apiClient.post(`${base}/sessions/${sessionId}/attendance/confirm`, { code });
  return unwrapApiData(res);
}

export async function listProgramTasks(programId) {
  const res = await apiClient.get(`${base}/programs/${programId}/tasks`);
  return asList(unwrapApiData(res));
}

export async function createTask(programId, body) {
  const res = await apiClient.post(`${base}/programs/${programId}/tasks`, body);
  return unwrapApiData(res);
}

export async function submitTask(taskId, body) {
  const res = await apiClient.post(`${base}/tasks/${taskId}/submissions`, body);
  return unwrapApiData(res);
}

export async function getTaskInstructionFile(taskId) {
  const res = await apiClient.get(`${base}/tasks/${taskId}/instruction-file`);
  return unwrapApiData(res);
}

/**
 * Download task instruction via authenticated API (blob) so /uploads auth works.
 */
export async function downloadTaskInstructionFile(taskId) {
  const { withUploadAccessToken } = await import('../../utils/protectedUploadUrl.js');
  try {
    const res = await apiClient.get(`${base}/tasks/${taskId}/instruction-file/download`, {
      responseType: 'blob',
    });
    const contentType = String(res.headers['content-type'] || '');
    if (contentType.includes('application/json')) {
      // Auth/error JSON returned as blob
      const text = await res.data.text();
      let message = 'تعذر تحميل ملف التعليمات.';
      try {
        message = JSON.parse(text)?.message || message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    const disposition = res.headers['content-disposition'] || '';
    const match = /filename="([^"]+)"/i.exec(disposition);
    const filename = match?.[1] || `task-instructions-${taskId}`;
    const blobUrl = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    return { blob: res.data, filename };
  } catch (err) {
    const meta = await getTaskInstructionFile(taskId);
    if (meta?.url) {
      window.open(withUploadAccessToken(meta.url), '_blank', 'noopener,noreferrer');
      return null;
    }
    throw err;
  }
}

export async function gradeTask(submissionId, body) {
  const res = await apiClient.post(`${base}/submissions/${submissionId}/grade`, body);
  return unwrapApiData(res);
}

export async function listProgramAssessments(programId) {
  const res = await apiClient.get(`${base}/programs/${programId}/assessments`);
  return asList(unwrapApiData(res));
}

export async function getAssessment(assessmentId) {
  const res = await apiClient.get(`${base}/assessments/${assessmentId}`);
  return unwrapApiData(res);
}

export async function upsertAssessment(programId, kind, body) {
  const res = await apiClient.put(`${base}/programs/${programId}/assessments/${kind}`, body);
  return unwrapApiData(res);
}

export async function publishAssessment(assessmentId) {
  const res = await apiClient.post(`${base}/assessments/${assessmentId}/publish`);
  return unwrapApiData(res);
}

export async function listAssessmentResults(assessmentId) {
  const res = await apiClient.get(`${base}/assessments/${assessmentId}/results`);
  return asList(unwrapApiData(res));
}

export async function getPrePostComparison(programId) {
  const res = await apiClient.get(`${base}/programs/${programId}/pre-post-comparison`);
  return unwrapApiData(res);
}

export async function getTraineeAssessmentStatus(programId) {
  const res = await apiClient.get(`${base}/programs/${programId}/assessment-status`);
  return unwrapApiData(res);
}

export async function startAssessmentAttempt(assessmentId) {
  const res = await apiClient.post(`${base}/assessments/${assessmentId}/attempts/start`);
  return unwrapApiData(res);
}

/** Preferred: submit an in-progress attempt by attemptId */
export async function submitAssessmentAttemptById(attemptId, answers) {
  const res = await apiClient.post(`${base}/assessment-attempts/${attemptId}/submit`, { answers });
  return unwrapApiData(res);
}

export async function saveAssessmentAttemptAnswers(attemptId, answers) {
  const res = await apiClient.patch(`${base}/assessment-attempts/${attemptId}/answers`, { answers });
  return unwrapApiData(res);
}

export async function gradeAssessmentAttempt(attemptId, body) {
  const res = await apiClient.patch(`${base}/assessment-attempts/${attemptId}/grade`, body);
  return unwrapApiData(res);
}

/** Legacy one-shot submit (starts + submits) */
export async function submitAssessmentAttempt(assessmentId, answers) {
  const res = await apiClient.post(`${base}/assessments/${assessmentId}/attempts`, { answers });
  return unwrapApiData(res);
}

export async function listProgramMaterials(programId) {
  const res = await apiClient.get(`${base}/programs/${programId}/materials`);
  return asList(unwrapApiData(res));
}

export async function createProgramMaterial(programId, body) {
  const res = await apiClient.post(`${base}/programs/${programId}/materials`, body);
  return unwrapApiData(res);
}

export async function updateProgramMaterial(materialId, body) {
  const res = await apiClient.patch(`${base}/materials/${materialId}`, body);
  return unwrapApiData(res);
}

export async function deleteProgramMaterial(materialId) {
  const res = await apiClient.delete(`${base}/materials/${materialId}`);
  return unwrapApiData(res);
}

export async function getMaterialPlaybackUrl(materialId) {
  const res = await apiClient.get(`${base}/materials/${materialId}/playback-url`);
  return unwrapApiData(res);
}

export async function listRecordedLectures(programId) {
  const res = await apiClient.get(`${base}/programs/${programId}/recorded-lectures`);
  return asList(unwrapApiData(res));
}

export async function createRecordedLecture(programId, body) {
  const res = await apiClient.post(`${base}/programs/${programId}/recorded-lectures`, body);
  return unwrapApiData(res);
}

export async function updateRecordedLecture(lectureId, body) {
  const res = await apiClient.patch(`${base}/recorded-lectures/${lectureId}`, body);
  return unwrapApiData(res);
}

export async function publishRecordedLecture(lectureId, body = { publish: true }) {
  const res = await apiClient.post(`${base}/recorded-lectures/${lectureId}/publish`, body);
  return unwrapApiData(res);
}

export async function deleteRecordedLecture(lectureId) {
  const res = await apiClient.delete(`${base}/recorded-lectures/${lectureId}`);
  return unwrapApiData(res);
}

export async function listProgramTasksDetailed(programId) {
  const res = await apiClient.get(`${base}/programs/${programId}/tasks/detailed`);
  return asList(unwrapApiData(res));
}

export async function updateTask(taskId, body) {
  const res = await apiClient.patch(`${base}/tasks/${taskId}`, body);
  return unwrapApiData(res);
}

export async function getEnrollmentProgress(enrollmentId) {
  const res = await apiClient.get(`${base}/enrollments/${enrollmentId}/progress`);
  return unwrapApiData(res);
}

export async function recomputeProgress(enrollmentId) {
  const res = await apiClient.post(`${base}/enrollments/${enrollmentId}/progress/recompute`);
  return unwrapApiData(res);
}

export async function approveCompletion(enrollmentId) {
  const res = await apiClient.post(`${base}/enrollments/${enrollmentId}/complete`);
  return unwrapApiData(res);
}

export async function issueCertificate(enrollmentId) {
  const res = await apiClient.post(`${base}/enrollments/${enrollmentId}/certificate`);
  return unwrapApiData(res);
}

export async function getEnrollmentCertificate(enrollmentId) {
  const res = await apiClient.get(`${base}/enrollments/${enrollmentId}/certificate`);
  return unwrapApiData(res);
}

export async function verifyCertificate(code) {
  const res = await apiClient.get(`${base}/certificates/verify/${code}`);
  return unwrapApiData(res);
}

export async function listMyPrograms() {
  const res = await apiClient.get(`${base}/trainee/my-programs`);
  return asList(unwrapApiData(res));
}

const inflightTraineeProgramDetail = new Map();

export async function getTraineeProgramDetail(programId, { sections } = {}) {
  const key = `${String(programId || '')}::${sections || 'all'}`;
  const pending = inflightTraineeProgramDetail.get(key);
  if (pending) return pending;
  const request = apiClient
    .get(`${base}/trainee/programs/${programId}`, {
      params: sections ? { sections } : undefined,
    })
    .then((res) => unwrapApiData(res))
    .finally(() => {
      inflightTraineeProgramDetail.delete(key);
    });
  inflightTraineeProgramDetail.set(key, request);
  return request;
}

/** Institutional final evaluation (end-of-course reaction survey). */
export async function getProgramEvaluation(programId) {
  const res = await apiClient.get(`${base}/programs/${programId}/evaluation`);
  return unwrapApiData(res);
}

export async function getEnrollmentEvaluation(enrollmentId) {
  const res = await apiClient.get(`${base}/enrollments/${enrollmentId}/evaluation`);
  return unwrapApiData(res);
}

export async function saveEvaluationDraft(responseId, answers) {
  const res = await apiClient.patch(`${base}/evaluation-responses/${responseId}`, { answers });
  return unwrapApiData(res);
}

export async function submitEvaluation(responseId, answers) {
  const res = await apiClient.post(`${base}/evaluation-responses/${responseId}/submit`, { answers });
  return unwrapApiData(res);
}

/** Completion readiness, finalization, and reporting. */
export async function getCompletionReadiness(programId, { cohortId } = {}) {
  const res = await apiClient.get(`${base}/programs/${programId}/completion-readiness`, {
    params: cohortId ? { cohortId } : undefined,
  });
  return unwrapApiData(res);
}

export async function finalizeTraining(programId, body) {
  const res = await apiClient.post(`${base}/programs/${programId}/finalize`, body);
  return unwrapApiData(res);
}

export async function reopenTraining(programId, body) {
  const res = await apiClient.post(`${base}/programs/${programId}/reopen`, body);
  return unwrapApiData(res);
}

export async function getIndividualReport(enrollmentId) {
  const res = await apiClient.get(`${base}/enrollments/${enrollmentId}/individual-report`);
  return unwrapApiData(res);
}

export async function generateIndividualReport(enrollmentId) {
  const res = await apiClient.post(`${base}/enrollments/${enrollmentId}/individual-report/generate`);
  return unwrapApiData(res);
}

export async function getCourseReport(programId, { cohortId } = {}) {
  const res = await apiClient.get(`${base}/programs/${programId}/course-report`, {
    params: cohortId ? { cohortId } : undefined,
  });
  return unwrapApiData(res);
}

export async function generateCourseReport(programId, { cohortId } = {}) {
  const res = await apiClient.post(`${base}/programs/${programId}/course-report/generate`, null, {
    params: cohortId ? { cohortId } : undefined,
  });
  return unwrapApiData(res);
}

export async function getOrgReport(organizationId) {
  const res = await apiClient.get(`${endpoints.kpi}/organizations/${organizationId}/report`);
  return unwrapApiData(res);
}

export async function listKpiAlerts(organizationId) {
  const res = await apiClient.get(`${endpoints.kpi}/organizations/${organizationId}/alerts`);
  return asList(unwrapApiData(res));
}

/** Official branded reports */
export const OFFICIAL_REPORT_TYPES = [
  { type: 'COURSE', title: 'التقرير الشامل للدورة التدريبية' },
  { type: 'INDIVIDUAL', title: 'التقرير الفردي لنتائج المتدرب' },
  { type: 'COHORT', title: 'تقرير الدفعة التدريبية' },
  { type: 'TRAINER', title: 'تقرير أداء المدرب' },
  { type: 'EVALUATION', title: 'تقرير التقييم النهائي للدورة' },
  { type: 'ATTENDANCE', title: 'تقرير الحضور والساعات التدريبية' },
  { type: 'LEARNING_IMPACT', title: 'تقرير قياس أثر التعلّم' },
  { type: 'CERTIFICATES', title: 'تقرير الإكمال والشهادات' },
];

function parseFilename(contentDisposition, fallback) {
  if (!contentDisposition) return fallback;
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
  const raw = decodeURIComponent(match?.[1] || match?.[2] || '');
  return raw || fallback;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function listOfficialReports(programId, params = {}) {
  const res = await apiClient.get(`${base}/programs/${programId}/reports`, { params });
  return asList(unwrapApiData(res));
}

export async function getLatestOfficialReport(programId, params = {}) {
  const res = await apiClient.get(`${base}/programs/${programId}/reports/latest`, { params });
  return unwrapApiData(res);
}

export async function generateOfficialReport(programId, body) {
  const res = await apiClient.post(`${base}/programs/${programId}/reports/generate`, body);
  return unwrapApiData(res);
}

export async function getOfficialReport(reportId) {
  const res = await apiClient.get(`${base}/reports/${reportId}`);
  return unwrapApiData(res);
}

export async function getOfficialReportStatus(reportId) {
  const res = await apiClient.get(`${base}/reports/${reportId}/status`);
  return unwrapApiData(res);
}

export async function downloadOfficialReportPdf(reportId) {
  const res = await apiClient.get(`${base}/reports/${reportId}/pdf`, {
    responseType: 'blob',
    timeout: 120000,
  });
  const filename = parseFilename(res.headers['content-disposition'], `training-report-${reportId}.pdf`);
  saveBlob(res.data, filename);
}

export async function downloadOfficialReportExcel(reportId) {
  const res = await apiClient.get(`${base}/reports/${reportId}/excel`, {
    responseType: 'blob',
    timeout: 120000,
  });
  const filename = parseFilename(res.headers['content-disposition'], `training-report-${reportId}.xlsx`);
  saveBlob(res.data, filename);
}

export function openOfficialReportPrintable(reportId) {
  const root = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const token = (() => {
    try {
      return JSON.parse(localStorage.getItem('battechno_auth_token') || 'null');
    } catch {
      return localStorage.getItem('battechno_auth_token');
    }
  })();
  // Open HTML via authenticated fetch then blob URL so Authorization header is sent.
  return apiClient
    .get(`${base}/reports/${reportId}/html`, { responseType: 'text', transformResponse: [(d) => d] })
    .then((res) => {
      const blob = new Blob([res.data], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return true;
    })
    .catch(() => {
      if (root && token) {
        window.open(`${root}${base}/reports/${reportId}/html`, '_blank', 'noopener,noreferrer');
      }
      return false;
    });
}

export async function getEnrollmentOfficialReport(enrollmentId) {
  const res = await apiClient.get(`${base}/enrollments/${enrollmentId}/report`);
  return unwrapApiData(res);
}

export async function generateEnrollmentOfficialReport(enrollmentId) {
  const res = await apiClient.post(`${base}/enrollments/${enrollmentId}/report/generate`);
  return unwrapApiData(res);
}

export async function verifyOfficialReportPublic(verificationCode) {
  const res = await apiClient.get(`/api/v1/public/reports/${verificationCode}/verify`);
  return unwrapApiData(res);
}
