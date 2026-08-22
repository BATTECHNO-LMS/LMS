/**
 * @param {string} email
 * @returns {string} Lowercased domain after '@', or empty string if invalid.
 */
function extractEmailDomain(email) {
  if (email == null || typeof email !== 'string') return '';
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 1 || at === trimmed.length - 1) return '';
  return trimmed.slice(at + 1);
}

/**
 * Exact match against registered campus domains. Undeclared subdomains
 * (e.g. mail.uni.edu.jo when only uni.edu.jo is listed) are rejected.
 * @param {string} emailDomain
 * @param {string[]} allowedDomains lowercased hostnames from DB
 */
function emailDomainMatchesAllowed(emailDomain, allowedDomains) {
  if (!emailDomain || !allowedDomains?.length) return false;
  const d = emailDomain.toLowerCase();
  return allowedDomains.some((allowed) => String(allowed).trim().toLowerCase() === d);
}

module.exports = { extractEmailDomain, emailDomainMatchesAllowed };
