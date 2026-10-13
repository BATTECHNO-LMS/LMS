import axios from 'axios';
import { storageKeys, getStorageItem } from '../utils/storage.js';
import { triggerUnauthorized } from './authSessionBridge.js';
import { shouldLogoutForResponse } from '../features/auth/session/sessionPolicy.js';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

function readConfigHeader(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') {
    return headers.get(name) || headers.get(String(name).toLowerCase()) || undefined;
  }
  return headers[name] || headers[String(name).toLowerCase()];
}

function setConfigHeader(headers, name, value) {
  if (!headers) return;
  if (typeof headers.set === 'function') {
    headers.set(name, value);
    return;
  }
  headers[name] = value;
}

apiClient.interceptors.request.use((config) => {
  const token = getStorageItem(storageKeys.authToken);
  if (token && typeof token === 'string') {
    setConfigHeader(config.headers, 'Authorization', `Bearer ${token}`);
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
    const authHeader = readConfigHeader(error.config?.headers, 'Authorization');
    const status = error.response?.status;
    const code = error.response?.data?.code;
    if (shouldLogoutForResponse({ status, code, hadAuth: Boolean(authHeader) })) {
      triggerUnauthorized(code);
    }
    return Promise.reject(error);
  }
);
