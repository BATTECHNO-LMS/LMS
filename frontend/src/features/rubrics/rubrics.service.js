import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

export async function fetchRubricsList(params = {}) {
  const res = await apiClient.get(endpoints.rubrics, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.rubrics)) {
    throw new Error('Invalid rubrics list response');
  }
  return data;
}

export async function fetchRubricById(id) {
  const res = await apiClient.get(`${endpoints.rubrics}/${id}`);
  return unwrapApiData(res);
}

export async function createRubric(body) {
  const res = await apiClient.post(endpoints.rubrics, body);
  return unwrapApiData(res);
}

export async function updateRubric(id, body) {
  const res = await apiClient.put(`${endpoints.rubrics}/${id}`, body);
  return unwrapApiData(res);
}

export async function createRubricCriterion(rubricId, body) {
  const res = await apiClient.post(`${endpoints.rubrics}/${rubricId}/criteria`, body);
  return unwrapApiData(res);
}

export async function updateRubricCriterion(criterionId, body) {
  const res = await apiClient.put(`${endpoints.rubricCriteria}/${criterionId}`, body);
  return unwrapApiData(res);
}

export async function deleteRubricCriterion(criterionId) {
  const res = await apiClient.delete(`${endpoints.rubricCriteria}/${criterionId}`);
  return unwrapApiData(res);
}
