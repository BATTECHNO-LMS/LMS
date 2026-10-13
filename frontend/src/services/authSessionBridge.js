/** @type {null | ((code?: string) => void)} */
let onUnauthorized = null;

export function setOnUnauthorized(handler) {
  onUnauthorized = typeof handler === 'function' ? handler : null;
}

/** @param {string} [code] backend auth error code (e.g. SESSION_IDLE_TIMEOUT) */
export function triggerUnauthorized(code) {
  if (onUnauthorized) onUnauthorized(code);
}
