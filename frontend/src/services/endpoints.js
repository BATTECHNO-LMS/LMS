/**
 * Central REST path map — swap prefix when backend is wired.
 */
const API = '/api';

export const endpoints = {
  auth: {
    login: `${API}/auth/login`,
    logout: `${API}/auth/logout`,
    refresh: `${API}/auth/refresh`,
    me: `${API}/auth/me`,
  },
  users: `${API}/users`,
  universities: `${API}/universities`,
  tracks: `${API}/tracks`,
  microCredentials: `${API}/micro-credentials`,
  cohorts: `${API}/cohorts`,
  sessions: `${API}/sessions`,
  attendance: `${API}/attendance`,
  assessments: `${API}/assessments`,
  rubrics: `${API}/rubrics`,
  submissions: `${API}/submissions`,
  grades: `${API}/grades`,
  evidence: `${API}/evidence`,
  qa: `${API}/qa`,
  risks: `${API}/risks`,
  integrity: `${API}/integrity`,
  recognition: `${API}/recognition`,
  certificates: `${API}/certificates`,
  reports: `${API}/reports`,
};
