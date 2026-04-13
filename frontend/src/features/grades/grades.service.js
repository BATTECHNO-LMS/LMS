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
