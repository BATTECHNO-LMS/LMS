import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';

/**
 * Auth API — mock fallback until backend is wired.
 * @param {{ email: string, password: string, role: string }} credentials
 */
export async function login(credentials) {
  const { email, password, role } = credentials;

  return apiClient.post(endpoints.auth.login, { email, password, role }).catch(() => {
    return mockLoginResponse({ email, role });
  });
}

const MOCK_NAMES = {
  super_admin: 'مسؤول النظام',
  program_admin: 'مسؤول البرامج',
  academic_admin: 'مسؤول أكاديمي',
  qa_officer: 'مسؤول الجودة',
  instructor: 'مدرّس',
  student: 'طالب',
  university_reviewer: 'مراجع جامعي',
};

function mockLoginResponse({ email, role }) {
  const id = `mock-${role}`;
  const token = `mock-token-${id}`;
  const user = {
    id,
    email: email || `user@${role}.local`,
    name: MOCK_NAMES[role] || role,
    role,
  };
  return { data: { token, user } };
}

export async function logout() {
  return apiClient.post(endpoints.auth.logout).catch(() => ({ data: {} }));
}

export async function fetchCurrentUser() {
  return apiClient.get(endpoints.auth.me).catch(() => ({ data: null }));
}
