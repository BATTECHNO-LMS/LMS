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

export async function openAttendanceWindow(sessionId, body = {}) {
  const res = await apiClient.post(`${base}/sessions/${sessionId}/attendance-window`, body);
  return unwrapApiData(res);
}

export async function listSessionAttendance(sessionId) {
  const res = await apiClient.get(`${base}/sessions/${sessionId}/attendance`);
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

export async function getTraineeProgramDetail(programId) {
  const res = await apiClient.get(`${base}/trainee/programs/${programId}`);
  return unwrapApiData(res);
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
