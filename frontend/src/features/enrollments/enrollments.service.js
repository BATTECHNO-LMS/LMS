import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {string} cohortId
 */
export async function fetchEnrollmentsByCohort(cohortId) {
  const res = await apiClient.get(`${endpoints.cohorts}/${cohortId}/enrollments`);
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.enrollments)) {
    throw new Error('Invalid enrollments response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchEnrollmentById(id) {
  const res = await apiClient.get(`${endpoints.enrollments}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {string} cohortId
 * @param {{ student_id: string }} body
 */
export async function createEnrollment(cohortId, body) {
  const res = await apiClient.post(`${endpoints.cohorts}/${cohortId}/enrollments`, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function patchEnrollmentStatus(id, body) {
  const res = await apiClient.patch(`${endpoints.enrollments}/${id}/status`, body);
  return unwrapApiData(res);
}

/** Current student's enrollments (GET /enrollments/me). */
export async function fetchMyEnrollments() {
  const res = await apiClient.get(`${endpoints.enrollments}/me`);
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.enrollments)) {
    throw new Error('Invalid enrollments response');
  }
  return data;
}

/**
 * Self-service enrollment request (POST /student/enrollment-requests).
 * @param {{ cohort_id: string }} body
 */
export async function postEnrollmentRequest(body) {
  const res = await apiClient.post(`${endpoints.student}/enrollment-requests`, body);
  return unwrapApiData(res);
}

/** Pending enrollment requests for admins/reviewers (GET /enrollments/pending). */
export async function fetchPendingEnrollments() {
  const res = await apiClient.get(`${endpoints.enrollments}/pending`);
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.enrollments)) {
    throw new Error('Invalid enrollments response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function approveEnrollmentRequest(id) {
  const res = await apiClient.patch(`${endpoints.enrollments}/${id}/approve`);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {{ rejection_reason?: string }} [body]
 */
export async function rejectEnrollmentRequest(id, body = {}) {
  const res = await apiClient.patch(`${endpoints.enrollments}/${id}/reject`, body);
  return unwrapApiData(res);
}

/** Student semester schedule (GET /student/semester-schedule). */
export async function fetchSemesterSchedule() {
  const res = await apiClient.get(`${endpoints.student}/semester-schedule`);
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.schedule)) {
    throw new Error('Invalid semester schedule response');
  }
  return {
    schedule: data.schedule,
    field_trainings: Array.isArray(data.field_trainings) ? data.field_trainings : [],
  };
}
