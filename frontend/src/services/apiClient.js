import axios from 'axios';
import { storageKeys, getStorageItem } from '../utils/storage.js';
import { triggerUnauthorized } from './authSessionBridge.js';
import { requestStepUp } from './stepUpBridge.js';
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

/** Error code from JSON or (for blob downloads) a JSON body delivered as a Blob. */
async function readErrorCode(data) {
  if (data && typeof data === 'object' && typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      return JSON.parse(await data.text())?.code;
    } catch {
      return undefined;
    }
  }
  return data?.code;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const authHeader = readConfigHeader(error.config?.headers, 'Authorization');
    const status = error.response?.status;
    const code = await readErrorCode(error.response?.data);
    if (shouldLogoutForResponse({ status, code, hadAuth: Boolean(authHeader) })) {
      triggerUnauthorized(code);
    }
    // Sensitive operation needs a fresh MFA proof: verify in the modal, then retry once.
    if (status === 403 && code === 'STEP_UP_REQUIRED' && error.config && !error.config.__stepUpRetried) {
      const verified = await requestStepUp(error.response?.data?.details || {});
      if (verified) return apiClient({ ...error.config, __stepUpRetried: true });
    }
    return Promise.reject(error);
  }
);
