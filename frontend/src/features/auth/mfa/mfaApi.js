import { apiClient } from '../../../services/apiClient.js';
import { endpoints } from '../../../services/endpoints.js';
import { unwrapApiData } from '../../../services/apiHelpers.js';

const mfa = endpoints.auth.mfa;

async function post(url, body) {
  return unwrapApiData(await apiClient.post(url, body));
}

// ── pre-session (challenge token, no JWT yet) ──
export const verifyLoginChallenge = ({ challengeToken, code, recoveryCode }) =>
  post(mfa.challengeVerify, recoveryCode ? { challengeToken, recoveryCode } : { challengeToken, code });
export const cancelLoginChallenge = (challengeToken) => post(mfa.challengeCancel, { challengeToken });
export const startChallengeEnrollment = (challengeToken) => post(mfa.enrollStart, { challengeToken });
export const verifyChallengeEnrollment = ({ challengeToken, code }) => post(mfa.enrollVerify, { challengeToken, code });
export const completeChallengeEnrollment = (challengeToken) =>
  post(mfa.enrollComplete, { challengeToken, acknowledged: true });

// ── authenticated ──
export async function fetchMfaStatus() {
  return unwrapApiData(await apiClient.get(mfa.status));
}
export const startSelfEnrollment = (password) => post(mfa.setupStart, { password });
export const verifySelfEnrollment = (code) => post(mfa.setupVerify, { code });
export const regenerateRecoveryCodes = ({ password, code }) => post(mfa.regenerateRecoveryCodes, { password, code });
export const disableMfa = ({ password, code }) => post(mfa.disable, { password, code });
export const stepUp = (code) => post(mfa.stepUp, { code });

export async function fetchOwnSessions() {
  return unwrapApiData(await apiClient.get(endpoints.auth.sessions));
}
export const endOwnSession = (id) => post(endpoints.auth.endSession(id), {});
export const endOtherSessions = () => post(endpoints.auth.endOtherSessions, {});

// ── administrative ──
export async function fetchUserMfaStatus(userId) {
  return unwrapApiData(await apiClient.get(`${endpoints.users}/${encodeURIComponent(userId)}/mfa`));
}
export const resetUserMfa = (userId, reason) =>
  post(`${endpoints.users}/${encodeURIComponent(userId)}/mfa/reset`, { reason });
