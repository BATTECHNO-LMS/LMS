class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status
   * @param {string} message
   * @param {unknown} [details]
   * @param {string} [code] Stable machine-readable code for clients
   */
  constructor(statusCode, message, details, code) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }
}

/**
 * 403 for a valid user reaching into another university / organization / user's data.
 * The response is unchanged; the error middleware records CROSS_SCOPE_ACCESS_DENIED.
 * @param {string} message
 * @param {{ scopeType?: 'university'|'organization'|'user', code?: string }} [opts]
 */
function crossScopeForbidden(message, opts = {}) {
  const err = new ApiError(403, message, null, opts.code);
  err.securityEvent = 'CROSS_SCOPE_ACCESS_DENIED';
  err.scopeType = opts.scopeType || null;
  return err;
}

module.exports = { ApiError, crossScopeForbidden };
