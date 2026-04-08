import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';
import { AUTH_MOCK_SCENARIOS } from '../../constants/authMockScenarios.js';
import { getTenantById, TENANT_SCOPE_ALL } from '../../constants/tenants.js';

/**
 * Auth API — mock fallback until backend is wired.
 * @param {{ email: string, password: string, role: string, scenarioKey?: string }} credentials
 */
export async function login(credentials) {
  const { email, password, role, scenarioKey } = credentials;

  return apiClient.post(endpoints.auth.login, { email, password, role }).catch(() => {
    return mockLoginResponse({ email, role, scenarioKey });
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

function pickScenario(role, scenarioKey) {
  if (scenarioKey) {
    const byKey = AUTH_MOCK_SCENARIOS.find((s) => s.key === scenarioKey);
    if (byKey) return byKey;
  }
  return AUTH_MOCK_SCENARIOS.find((s) => s.role === role) ?? AUTH_MOCK_SCENARIOS[0];
}

function mockLoginResponse({ email, role, scenarioKey }) {
  const scenario = pickScenario(role, scenarioKey);
  const resolvedRole = scenario.role;
  const isGlobal = scenario.isGlobal;
  let tenantId = scenario.tenantId;
  if (isGlobal) {
    tenantId = TENANT_SCOPE_ALL;
  }
  const tenant = tenantId && tenantId !== TENANT_SCOPE_ALL ? getTenantById(tenantId) : null;

  const id = `mock-${scenario.key}`;
  const token = `mock-token-${id}`;
  const user = {
    id,
    email: email || `user@${resolvedRole}.local`,
    name: MOCK_NAMES[resolvedRole] || resolvedRole,
    role: resolvedRole,
    roles: [resolvedRole],
    isGlobal,
    tenantId,
    tenantCode: tenant?.code ?? null,
    tenantNameAr: tenant?.nameAr ?? null,
    tenantNameEn: tenant?.nameEn ?? null,
  };
  return { data: { token, user } };
}

export async function logout() {
  return apiClient.post(endpoints.auth.logout).catch(() => ({ data: {} }));
}

export async function fetchCurrentUser() {
  return apiClient.get(endpoints.auth.me).catch(() => ({ data: null }));
}
