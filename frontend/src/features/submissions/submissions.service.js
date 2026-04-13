import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

export async function fetchSubmissionsList(params = {}) {
  const res = await apiClient.get(endpoints.submissions, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.submissions)) {
    throw new Error('Invalid submissions list response');
  }
  return data;
}

export async function fetchSubmissionById(id) {
  const res = await apiClient.get(`${endpoints.submissions}/${id}`);
  return unwrapApiData(res);
}
