import { apiClient } from '../../services/apiClient.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { endpoints } from '../../services/endpoints.js';

const help = endpoints.help;
const student = endpoints.studentHelp;
const admin = endpoints.adminHelp;

export async function fetchFieldTrainingOnboarding() {
  const res = await apiClient.get(`${student}/onboarding/field-training`);
  return unwrapApiData(res);
}

export async function startFieldTrainingOnboarding() {
  const res = await apiClient.post(`${student}/onboarding/field-training/start`);
  return unwrapApiData(res);
}

export async function progressFieldTrainingOnboarding(body) {
  const res = await apiClient.patch(`${student}/onboarding/field-training/progress`, body);
  return unwrapApiData(res);
}

export async function completeFieldTrainingOnboarding() {
  const res = await apiClient.post(`${student}/onboarding/field-training/complete`);
  return unwrapApiData(res);
}

export async function dismissFieldTrainingOnboarding() {
  const res = await apiClient.post(`${student}/onboarding/field-training/dismiss`);
  return unwrapApiData(res);
}

export async function restartFieldTrainingOnboarding() {
  const res = await apiClient.post(`${student}/onboarding/field-training/restart`);
  return unwrapApiData(res);
}

export async function fetchHelpCategories() {
  const res = await apiClient.get(`${help}/categories`);
  return unwrapApiData(res);
}

export async function fetchHelpArticles({ category, faq } = {}) {
  const res = await apiClient.get(`${help}/articles`, {
    params: {
      ...(category ? { category } : {}),
      ...(faq ? { faq: '1' } : {}),
    },
  });
  return unwrapApiData(res);
}

export async function fetchHelpArticle(slug) {
  const res = await apiClient.get(`${help}/articles/${slug}`);
  return unwrapApiData(res);
}

export async function recordHelpArticleView(id) {
  const res = await apiClient.post(`${help}/articles/${id}/view`);
  return unwrapApiData(res);
}

export async function searchHelp(q) {
  const res = await apiClient.get(`${help}/search`, { params: { q } });
  return unwrapApiData(res);
}

export async function fetchContextualHelp({ route, key } = {}) {
  const res = await apiClient.get(`${student}/contextual-help`, {
    params: {
      ...(route ? { route } : {}),
      ...(key ? { key } : {}),
    },
  });
  return unwrapApiData(res);
}

export async function createSupportTicket(body) {
  const res = await apiClient.post(`${student}/support-tickets`, body);
  return unwrapApiData(res);
}

export async function fetchMySupportTickets() {
  const res = await apiClient.get(`${student}/support-tickets`);
  return unwrapApiData(res);
}

export async function fetchAdminHelpAnalytics() {
  const res = await apiClient.get(`${admin}/analytics`);
  return unwrapApiData(res);
}

export async function fetchAdminHelpCategories() {
  const res = await apiClient.get(`${admin}/categories`);
  return unwrapApiData(res);
}

export async function fetchAdminHelpArticles() {
  const res = await apiClient.get(`${admin}/articles`);
  return unwrapApiData(res);
}

export async function createAdminHelpArticle(body) {
  const res = await apiClient.post(`${admin}/articles`, body);
  return unwrapApiData(res);
}

export async function updateAdminHelpArticle(id, body) {
  const res = await apiClient.patch(`${admin}/articles/${id}`, body);
  return unwrapApiData(res);
}

export async function publishAdminHelpArticle(id, publish = true) {
  const res = await apiClient.post(`${admin}/articles/${id}/publish`, { publish });
  return unwrapApiData(res);
}
