import axios from 'axios';
import { storageKeys, getStorageItem } from '../utils/storage.js';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = getStorageItem(storageKeys.authToken);
  if (token && typeof token === 'string') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Hook for global logout / refresh when backend exists
    }
    return Promise.reject(error);
  }
);
