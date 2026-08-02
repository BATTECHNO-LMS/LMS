import { apiClient } from '../../services/apiClient.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { endpoints } from '../../services/endpoints.js';

function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

export async function listPublicInstitutions() {
  const res = await apiClient.get(endpoints.organizationsPublicInstitutions);
  return asList(unwrapApiData(res));
}

export async function listPublicInstitutionBranches(organizationId) {
  const res = await apiClient.get(
    `${endpoints.organizations}/public/institutions/${organizationId}/branches`
  );
  return asList(unwrapApiData(res));
}

export async function listOrganizations(params = {}) {
  const res = await apiClient.get(endpoints.organizations, { params });
  return asList(unwrapApiData(res));
}

export async function createInstitution(body) {
  const res = await apiClient.post(`${endpoints.organizations}/institutions`, body);
  return unwrapApiData(res);
}

export async function updateInstitution(id, body) {
  const res = await apiClient.put(`${endpoints.organizations}/institutions/${id}`, body);
  return unwrapApiData(res);
}

export async function listBranches(organizationId) {
  const res = await apiClient.get(`${endpoints.organizations}/${organizationId}/branches`);
  return asList(unwrapApiData(res));
}

export async function createBranch(organizationId, body) {
  const res = await apiClient.post(`${endpoints.organizations}/${organizationId}/branches`, body);
  return unwrapApiData(res);
}

export async function updateBranch(organizationId, branchId, body) {
  const res = await apiClient.patch(
    `${endpoints.organizations}/${organizationId}/branches/${branchId}`,
    body
  );
  return unwrapApiData(res);
}

export async function listDepartments(organizationId, branchId) {
  const res = await apiClient.get(`${endpoints.organizations}/${organizationId}/departments`, {
    params: branchId ? { branchId } : undefined,
  });
  return asList(unwrapApiData(res));
}

export async function createDepartment(organizationId, body) {
  const res = await apiClient.post(`${endpoints.organizations}/${organizationId}/departments`, body);
  return unwrapApiData(res);
}

export async function listMembers(organizationId, params = {}) {
  const res = await apiClient.get(`${endpoints.organizations}/${organizationId}/members`, { params });
  return asList(unwrapApiData(res));
}

export async function verifyMemberEmail(organizationId, body) {
  const res = await apiClient.post(
    `${endpoints.organizations}/${organizationId}/members/verify-email`,
    body
  );
  return unwrapApiData(res);
}

export async function changeMemberActivation(organizationId, body) {
  const res = await apiClient.post(
    `${endpoints.organizations}/${organizationId}/members/activation`,
    body
  );
  return unwrapApiData(res);
}

export async function getOrgDashboard(organizationId) {
  const res = await apiClient.get(`${endpoints.organizations}/${organizationId}/dashboard`);
  return unwrapApiData(res);
}

export async function registerInstitutionUser(body) {
  const res = await apiClient.post(endpoints.auth.institutionRegister, body);
  return unwrapApiData(res);
}
