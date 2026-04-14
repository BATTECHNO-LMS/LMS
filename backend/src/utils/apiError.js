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

module.exports = { ApiError };
