import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

export async function fetchGradesList(params = {}) {
  const res = await apiClient.get(endpoints.grades, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.grades)) {
    throw new Error('Invalid grades list response');
  }
  return data;
}

/** Alias for student-scoped grades list (same endpoint; role filters on server). */
export async function fetchMyGrades(params = {}) {
  return fetchGradesList(params);
}

export async function fetchGradeById(id) {
  const res = await apiClient.get(`${endpoints.grades}/${id}`);
  return unwrapApiData(res);
}

/** POST /api/v1/assessments/:assessmentId/grades */
export async function createAcademicGrade(assessmentId, body) {
  const res = await apiClient.post(`${endpoints.assessments}/${assessmentId}/grades`, body);
  return unwrapApiData(res);
}

/** PUT /api/v1/grades/:id */
export async function updateAcademicGrade(gradeId, body) {
  const res = await apiClient.put(`${endpoints.grades}/${gradeId}`, body);
  return unwrapApiData(res);
}

/** PATCH /api/v1/grades/:id/finalize */
export async function finalizeAcademicGrade(gradeId) {
  const res = await apiClient.patch(`${endpoints.grades}/${gradeId}/finalize`);
  return unwrapApiData(res);
}
