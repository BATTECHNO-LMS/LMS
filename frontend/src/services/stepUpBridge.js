/**
 * Bridge between the API client and the step-up modal (mounted by StepUpProvider).
 * Concurrent STEP_UP_REQUIRED responses share one prompt.
 */

let handler = null;
let pending = null;

/** @param {((details: object) => Promise<boolean>) | null} fn resolves true once verified */
export function setStepUpHandler(fn) {
  handler = typeof fn === 'function' ? fn : null;
}

export function hasStepUpHandler() {
  return Boolean(handler);
}

/** @returns {Promise<boolean>} */
export function requestStepUp(details = {}) {
  if (!handler) return Promise.resolve(false);
  if (!pending) {
    pending = Promise.resolve()
      .then(() => handler(details))
      .catch(() => false)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
