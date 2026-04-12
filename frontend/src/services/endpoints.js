/**
 * Central REST path map — aligned with backend (`/api/auth/*`, `/api/v1/*`).
 */
const API_ROOT = '/api';
const API_V1 = `${API_ROOT}/v1`;

export const endpoints = {
  auth: {
    login: `${API_ROOT}/auth/login`,
    logout: `${API_ROOT}/auth/logout`,
    register: `${API_ROOT}/auth/register`,
    registerUniversities: `${API_ROOT}/auth/register/universities`,
    refresh: `${API_ROOT}/auth/refresh`,
    me: `${API_ROOT}/auth/me`,
  },
  users: `${API_V1}/users`,
  universities: `${API_V1}/universities`,
  tracks: `${API_V1}/tracks`,
  microCredentials: `${API_V1}/micro-credentials`,
  cohorts: `${API_V1}/cohorts`,
  sessions: `${API_V1}/sessions`,
  attendance: `${API_V1}/attendance`,
  assessments: `${API_V1}/assessments`,
  rubrics: `${API_V1}/rubrics`,
  submissions: `${API_V1}/submissions`,
  grades: `${API_V1}/grades`,
  evidence: `${API_V1}/evidence`,
  qa: `${API_V1}/qa`,
  risks: `${API_V1}/risks`,
  integrity: `${API_V1}/integrity`,
  recognition: `${API_V1}/recognition`,
  certificates: `${API_V1}/certificates`,
  reports: `${API_V1}/reports`,
};
