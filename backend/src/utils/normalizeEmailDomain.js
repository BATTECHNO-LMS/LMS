/**
 * Normalize a university email domain for storage / comparison.
 * Strips protocol, paths, whitespace; lowercases hostname-only value.
 * @param {unknown} value
 * @returns {string|null} normalized domain, or null if empty/invalid
 */
function normalizeEmailDomain(value) {
  if (value == null) return null;
  let raw = String(value).trim().toLowerCase();
  if (!raw) return null;

  raw = raw.replace(/^https?:\/\//i, '');
  raw = raw.replace(/^www\./i, '');
  // Drop path / query / fragment if pasted as URL host/path
  const slash = raw.indexOf('/');
  if (slash >= 0) raw = raw.slice(0, slash);
  const q = raw.indexOf('?');
  if (q >= 0) raw = raw.slice(0, q);
  const hash = raw.indexOf('#');
  if (hash >= 0) raw = raw.slice(0, hash);
  // If someone pasted an email, keep the host part
  const at = raw.lastIndexOf('@');
  if (at >= 0) raw = raw.slice(at + 1);

  raw = raw.replace(/\s+/g, '').replace(/\.+$/g, '');
  if (!raw) return null;

  // Require a dotted hostname (e.g. mutah.edu.jo) — single labels are not valid email domains.
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(raw)) {
    return null;
  }
  return raw;
}

module.exports = { normalizeEmailDomain };
