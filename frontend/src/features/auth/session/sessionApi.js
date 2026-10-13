import { apiClient } from '../../../services/apiClient.js';
import { endpoints } from '../../../services/endpoints.js';

/** Explicit human activity (throttled by the caller). Extends the idle window server-side. */
export function sendActivityPing() {
  return apiClient.post(endpoints.auth.sessionActivity, {}, { timeout: 15000 });
}

/** Tab-visible presence. Updates last_seen_at only; never extends the session. */
export function sendPresencePing() {
  return apiClient.post(endpoints.auth.sessionPresence, {}, { timeout: 15000 });
}

/**
 * End the current server session ("إنهاء الجلسة" or client idle timeout).
 * @param {'USER_LOGOUT'|'IDLE_TIMEOUT'} reason
 */
export function endCurrentSession(reason = 'USER_LOGOUT') {
  return apiClient.post(endpoints.auth.endCurrentSession, { reason }, { timeout: 10000 });
}
