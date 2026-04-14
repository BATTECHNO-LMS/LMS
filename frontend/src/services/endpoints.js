/**
 * Central REST path map — aligned with backend (`/api/auth/*`, versioned `/api/:version/*`).
 * Version defaults to `v1` (Express: `app.use('/api/' + API_VERSION, routes)`).
 */
const API_ROOT = '/api';
const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';
const API_V = `${API_ROOT}/${API_VERSION}`;

export const endpoints = {
  auth: {
    login: `${API_ROOT}/auth/login`,
    logout: `${API_ROOT}/auth/logout`,
    register: `${API_ROOT}/auth/register`,
    registerUniversities: `${API_ROOT}/auth/register/universities`,
    refresh: `${API_ROOT}/auth/refresh`,
    me: `${API_ROOT}/auth/me`,
  },
  users: `${API_V}/users`,
  universities: `${API_V}/universities`,
  tracks: `${API_V}/tracks`,
  microCredentials: `${API_V}/micro-credentials`,
  learningOutcomes: `${API_V}/learning-outcomes`,
  cohorts: `${API_V}/cohorts`,
  enrollments: `${API_V}/enrollments`,
  sessions: `${API_V}/sessions`,
  attendanceRecords: `${API_V}/attendance-records`,
  assessments: `${API_V}/assessments`,
  rubrics: `${API_V}/rubrics`,
  submissions: `${API_V}/submissions`,
  grades: `${API_V}/grades`,
  rubricCriteria: `${API_V}/rubric-criteria`,
  students: `${API_V}/students`,
  evidence: `${API_V}/evidence`,
  qaReviews: `${API_V}/qa-reviews`,
  correctiveActions: `${API_V}/corrective-actions`,
  riskCases: `${API_V}/risk-cases`,
  integrityCases: `${API_V}/integrity-cases`,
  recognitionRequests: `${API_V}/recognition-requests`,
  recognitionDocuments: `${API_V}/recognition-documents`,
  certificates: `${API_V}/certificates`,
  notifications: `${API_V}/notifications`,
  auditLogs: `${API_V}/audit-logs`,
  analytics: `${API_V}/analytics`,
  reports: `${API_V}/reports`,
};
