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
 * Exact match or subdomain of an allowed campus domain (e.g. mail.yu.edu.jo vs yu.edu.jo).
 * @param {string} emailDomain
 * @param {string[]} allowedDomains lowercased hostnames from DB
 */
function emailDomainMatchesAllowed(emailDomain, allowedDomains) {
  if (!emailDomain || !allowedDomains?.length) return false;
  const d = emailDomain.toLowerCase();
  return allowedDomains.some((allowed) => {
    const a = String(allowed).trim().toLowerCase();
    if (!a) return false;
    return d === a || d.endsWith(`.${a}`);
  });
}

module.exports = { extractEmailDomain, emailDomainMatchesAllowed };
