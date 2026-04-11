/**
 * Extract the domain part of an email (lowercased), or empty string if invalid.
 * @param {string} email
 * @returns {string}
 */
export function getEmailDomain(email) {
  if (email == null || typeof email !== 'string') return '';
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');
  if (at < 1 || at === trimmed.length - 1) return '';
  return trimmed.slice(at + 1);
}

/**
 * Exact or subdomain match (e.g. stu.mail.yu.edu.jo vs yu.edu.jo).
 * @param {string} emailDomain
 * @param {string[]} allowedDomains
 * @returns {boolean}
 */
export function isEmailDomainAllowed(emailDomain, allowedDomains) {
  if (!emailDomain || !allowedDomains?.length) return false;
  const d = emailDomain.toLowerCase();
  return allowedDomains.some((allowed) => {
    const a = String(allowed).toLowerCase();
    return d === a || d.endsWith(`.${a}`);
  });
}
