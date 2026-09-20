const { env } = require('./env');

/** Browser origins allowed for API CORS and R2 bucket CORS. */
const BUILTIN_BROWSER_CORS_ORIGINS = Object.freeze([
  'https://eprojecto.com',
  'https://www.eprojecto.com',
  'https://lms.battechno.com',
  'https://www.lms.battechno.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
]);

function getBrowserCorsOrigins() {
  return [...new Set([...BUILTIN_BROWSER_CORS_ORIGINS, ...env.CORS_ORIGINS].filter(Boolean))];
}

module.exports = {
  BUILTIN_BROWSER_CORS_ORIGINS,
  getBrowserCorsOrigins,
};
