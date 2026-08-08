import { apiClient } from '../../services/apiClient.js';
import { unwrapApiData } from '../../services/apiHelpers.js';
import { endpoints } from '../../services/endpoints.js';

const help = endpoints.help;
const student = endpoints.studentHelp;
const admin = endpoints.adminHelp;
const guides = endpoints.adminUserGuides;
const onboarding = endpoints.onboarding;

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

export async function fetchActiveOnboarding(params = {}) {
  const res = await apiClient.get(`${onboarding}/active`, {
    params: {
      ...(params.guide_key || params.guideKey
        ? { guide_key: params.guide_key || params.guideKey }
        : {}),
    },
  });
  return unwrapApiData(res);
}

export async function fetchOnboardingByKey(guideKey) {
  const res = await apiClient.get(`${onboarding}/${guideKey}`);
  return unwrapApiData(res);
}

export async function progressOnboardingByKey(guideKey, body) {
  const res = await apiClient.patch(`${onboarding}/${guideKey}/progress`, body);
  return unwrapApiData(res);
}

export async function completeOnboardingByKey(guideKey) {
  const res = await apiClient.post(`${onboarding}/${guideKey}/complete`);
  return unwrapApiData(res);
}

export async function dismissOnboardingByKey(guideKey) {
  const res = await apiClient.post(`${onboarding}/${guideKey}/dismiss`);
  return unwrapApiData(res);
}

export async function restartOnboardingByKey(guideKey) {
  const res = await apiClient.post(`${onboarding}/${guideKey}/restart`);
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
  const res = await apiClient.get(`${help}/contextual-help`, {
    params: {
      ...(route ? { route } : {}),
      ...(key ? { key } : {}),
    },
  });
  return unwrapApiData(res);
}

/** No dedicated start route for keyed guides — progress at 0 starts the guide. */
export async function startOnboardingByKey(guideKey) {
  return progressOnboardingByKey(guideKey, { last_step: 0 });
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

export async function createAdminHelpCategory(body) {
  const res = await apiClient.post(`${admin}/categories`, body);
  return unwrapApiData(res);
}

export async function updateAdminHelpCategory(id, body) {
  const res = await apiClient.patch(`${admin}/categories/${id}`, body);
  return unwrapApiData(res);
}

export async function deleteAdminHelpCategory(id) {
  const res = await apiClient.delete(`${admin}/categories/${id}`);
  return unwrapApiData(res);
}

export async function fetchAdminHelpArticles({ categoryId } = {}) {
  const res = await apiClient.get(`${admin}/articles`, {
    params: {
      ...(categoryId ? { category_id: categoryId } : {}),
    },
  });
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

export async function archiveAdminHelpArticle(id) {
  const res = await apiClient.post(`${admin}/articles/${id}/archive`);
  return unwrapApiData(res);
}

export async function deleteAdminHelpArticle(id) {
  const res = await apiClient.delete(`${admin}/articles/${id}`);
  return unwrapApiData(res);
}

export async function fetchAdminHelpArticleVersions(id) {
  const res = await apiClient.get(`${admin}/articles/${id}/versions`);
  return unwrapApiData(res);
}

export async function restoreAdminHelpArticleVersion(id, version) {
  const res = await apiClient.post(`${admin}/articles/${id}/versions/${version}/restore`);
  return unwrapApiData(res);
}

export async function reorderAdminHelpArticles(items) {
  const res = await apiClient.post(`${admin}/articles/reorder`, { items });
  return unwrapApiData(res);
}

export async function fetchAdminUserGuides() {
  const res = await apiClient.get(guides);
  return unwrapApiData(res);
}

export async function fetchAdminUserGuide(id) {
  const res = await apiClient.get(`${guides}/${id}`);
  return unwrapApiData(res);
}

export async function createAdminUserGuide(body) {
  const res = await apiClient.post(guides, body);
  return unwrapApiData(res);
}

export async function updateAdminUserGuide(id, body) {
  const res = await apiClient.patch(`${guides}/${id}`, body);
  return unwrapApiData(res);
}

export async function publishAdminUserGuide(id, body = {}) {
  const res = await apiClient.post(`${guides}/${id}/publish`, body);
  return unwrapApiData(res);
}

export async function previewAdminUserGuide(id) {
  const res = await apiClient.post(`${guides}/${id}/preview`);
  return unwrapApiData(res);
}

export async function archiveAdminUserGuide(id) {
  const res = await apiClient.post(`${guides}/${id}/archive`);
  return unwrapApiData(res);
}

export async function reorderAdminUserGuideSteps(id, items) {
  const res = await apiClient.post(`${guides}/${id}/reorder`, { items });
  return unwrapApiData(res);
}

export async function createAdminUserGuideStep(id, body) {
  const res = await apiClient.post(`${guides}/${id}/steps`, body);
  return unwrapApiData(res);
}

export async function updateAdminUserGuideStep(id, stepId, body) {
  const res = await apiClient.patch(`${guides}/${id}/steps/${stepId}`, body);
  return unwrapApiData(res);
}

export async function deleteAdminUserGuideStep(id, stepId) {
  const res = await apiClient.delete(`${guides}/${id}/steps/${stepId}`);
  return unwrapApiData(res);
}
