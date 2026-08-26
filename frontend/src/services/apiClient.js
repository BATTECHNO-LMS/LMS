import axios from 'axios';
import { storageKeys, getStorageItem } from '../utils/storage.js';
import { triggerUnauthorized } from './authSessionBridge.js';

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
  // Let the browser set multipart boundary. A preset Content-Type (including
  // the axios default application/json) makes multer reject the file with 400.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Content-Type', undefined);
    } else if (config.headers) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadAuth = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && hadAuth) {
      triggerUnauthorized();
    }
    return Promise.reject(error);
  }
);
