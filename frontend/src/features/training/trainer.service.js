import { apiClient } from '../../services/apiClient.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { endpoints } from '../../services/endpoints.js';

const base = endpoints.training;

export async function getTrainerDashboard() {
  const res = await apiClient.get(`${base}/trainer/dashboard`);
  return unwrapApiData(res);
}

export async function listTrainerCourses() {
  const res = await apiClient.get(`${base}/trainer/courses`);
  return unwrapApiData(res);
}

export async function getTrainerCourse(programId) {
  const res = await apiClient.get(`${base}/trainer/courses/${programId}`);
  return unwrapApiData(res);
}

export async function createInstitutionTrainer(organizationId, body) {
  const res = await apiClient.post(`${base}/organizations/${organizationId}/trainers`, body);
  return unwrapApiData(res);
}

export async function listTrainerAssignments(organizationId) {
  const res = await apiClient.get(`${base}/organizations/${organizationId}/trainer-assignments`);
  return unwrapApiData(res);
}

export async function assignTrainerToCourse(organizationId, body) {
  const res = await apiClient.post(
    `${base}/organizations/${organizationId}/trainer-assignments`,
    body
  );
  return unwrapApiData(res);
}

export async function revokeTrainerAssignment(organizationId, assignmentId) {
  const res = await apiClient.post(
    `${base}/organizations/${organizationId}/trainer-assignments/${assignmentId}/revoke`
  );
  return unwrapApiData(res);
}
