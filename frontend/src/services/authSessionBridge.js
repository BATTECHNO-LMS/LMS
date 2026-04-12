/** @type {null | (() => void)} */
let onUnauthorized = null;

export function setOnUnauthorized(handler) {
  onUnauthorized = typeof handler === 'function' ? handler : null;
}

export function triggerUnauthorized() {
  if (onUnauthorized) onUnauthorized();
}
