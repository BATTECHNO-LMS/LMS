import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { unwrapApiData } from '../../services/apiHelpers.js';

/**
 * @param {{ status?: string, search?: string }} [params]
 */
export async function fetchTracksList(params = {}) {
  const res = await apiClient.get(endpoints.tracks, { params });
  const data = unwrapApiData(res);
  if (!data || typeof data !== 'object' || !Array.isArray(data.tracks)) {
    throw new Error('Invalid tracks list response');
  }
  return data;
}

/**
 * @param {string} id
 */
export async function fetchTrackById(id) {
  const res = await apiClient.get(`${endpoints.tracks}/${id}`);
  return unwrapApiData(res);
}

/**
 * @param {Record<string, unknown>} body
 */
export async function createTrack(body) {
  const res = await apiClient.post(endpoints.tracks, body);
  return unwrapApiData(res);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export async function updateTrack(id, body) {
  const res = await apiClient.put(`${endpoints.tracks}/${id}`, body);
  return unwrapApiData(res);
}
