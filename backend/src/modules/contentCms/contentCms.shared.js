'use strict';

const { ApiError } = require('../../utils/apiError');
const { normalizeRoleCodes } = require('../../utils/roleCanon');
const {
  isSystemWideAdmin,
  assertUniversityRecordAccess,
} = require('../../utils/universityScope');

const CONTENT_ADMIN_FORBIDDEN_MSG =
  'لا تملك صلاحية إدارة محتوى دليل المستخدم أو الإعلانات.';

const OFFICIAL_ROLES = Object.freeze([
  'super_admin',
  'admin',
  'instructor',
  'trainer',
  'trainee',
  'student',
  'reviewer',
]);

const ALLOWED_TEMPLATE_VARS = Object.freeze([
  'student_name',
  'email',
  'activation_wait_hours',
  'university_name',
]);

const ALLOWED_TEMPLATE_VAR_SET = new Set(ALLOWED_TEMPLATE_VARS);

const ALLOWED_HTML_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'a',
  'img',
  'blockquote',
  'code',
  'pre',
  'hr',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'div',
  'span',
]);

const VOID_HTML_TAGS = new Set(['br', 'hr', 'img']);

const ALLOWED_NOTE_CLASSES = new Set(['note', 'warning', 'info']);

function normalizeRoles(user) {
  return normalizeRoleCodes(user?.roles || []);
}

/**
 * Content CMS admin: global user, or role super_admin / admin.
 * @param {{ isGlobal?: boolean, roles?: string[] } | null | undefined} user
 */
function assertContentAdmin(user) {
  if (user?.isGlobal) return;
  const roles = normalizeRoles(user);
  if (roles.includes('super_admin') || roles.includes('admin')) return;
  throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
}

/**
 * Soft-delete restore and similar: system-wide admin or super_admin role only.
 * @param {{ isGlobal?: boolean, roles?: string[] } | null | undefined} user
 */
function assertSuperAdminRestore(user) {
  if (isSystemWideAdmin(user) || normalizeRoles(user).includes('super_admin')) return;
  throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
}

/**
 * When a target university is set, non–system-wide users may only target their own.
 * @param {{ isGlobal?: boolean, universityId?: string | null } | null | undefined} user
 * @param {string | null | undefined} universityId
 */
function assertTargetUniversityInScope(user, universityId) {
  if (universityId == null || universityId === '') return;
  if (isSystemWideAdmin(user)) return;
  assertUniversityRecordAccess(user, universityId);
}

/**
 * @param {{ isGlobal?: boolean, universityId?: string | null } | null | undefined} user
 * @param {Array<string | null | undefined> | null | undefined} universityIds
 */
function assertTargetUniversitiesInScope(user, universityIds) {
  if (!Array.isArray(universityIds) || universityIds.length === 0) return;
  for (const id of universityIds) {
    assertTargetUniversityInScope(user, id);
  }
}

/**
 * Reject dangerous URL schemes; allow http(s), root-relative paths, and mailto.
 * @param {unknown} url
 * @returns {string | null}
 */
function sanitizeCtaUrl(url) {
  if (url == null) return null;
  const raw = String(url).trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return null;
  }

  if (/^https?:\/\//i.test(raw) || raw.startsWith('/') || /^mailto:/i.test(raw)) {
    return raw;
  }

  return null;
}

/**
 * Whitelist HTML for CMS body fields.
 * Strips scripts, event handlers, and javascript: URLs; keeps a small tag set.
 * @param {unknown} input
 * @returns {string}
 */
function sanitizeHtml(input) {
  if (input == null) return '';
  let html = String(input);

  html = html.replace(/<(script|style)[\s\S]*?>[\s\S]*?<\/\1>/gi, '');
  html = html.replace(/<\/?(script|style)\b[^>]*>/gi, '');
  html = html.replace(/\s+on\w+\s*=\s*(['"])[\s\S]*?\1/gi, '');
  html = html.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');
  html = html.replace(/(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '$1=""');
  html = html.replace(/(href|src)\s*=\s*javascript:[^\s>]*/gi, '$1=""');

  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)\/?>/g, (match, tagName, attrs) => {
    const tag = String(tagName).toLowerCase();
    const isClose = match.startsWith('</');
    if (!ALLOWED_HTML_TAGS.has(tag)) return '';

    if (isClose) {
      if (VOID_HTML_TAGS.has(tag)) return '';
      return `</${tag}>`;
    }

    const safeAttrs = sanitizeAllowedAttributes(tag, attrs || '');
    if (VOID_HTML_TAGS.has(tag)) {
      return `<${tag}${safeAttrs}>`;
    }
    return `<${tag}${safeAttrs}>`;
  });
}

/**
 * @param {string} tag
 * @param {string} attrsRaw
 * @returns {string}
 */
function sanitizeAllowedAttributes(tag, attrsRaw) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m;
  while ((m = re.exec(attrsRaw))) {
    const name = m[1].toLowerCase();
    const value = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4] || '';
    attrs[name] = value;
  }

  const out = [];

  if (tag === 'a' && Object.prototype.hasOwnProperty.call(attrs, 'href')) {
    const href = sanitizeCtaUrl(attrs.href);
    if (href) out.push(` href="${escapeAttr(href)}"`);
  }

  if (tag === 'img') {
    if (Object.prototype.hasOwnProperty.call(attrs, 'src')) {
      const src = sanitizeCtaUrl(attrs.src);
      if (src && !/^mailto:/i.test(src)) {
        out.push(` src="${escapeAttr(src)}"`);
      }
    }
    if (Object.prototype.hasOwnProperty.call(attrs, 'alt')) {
      out.push(` alt="${escapeAttr(attrs.alt)}"`);
    }
  }

  if ((tag === 'div' || tag === 'span') && Object.prototype.hasOwnProperty.call(attrs, 'class')) {
    const classes = String(attrs.class)
      .split(/\s+/)
      .map((c) => c.trim().toLowerCase())
      .filter((c) => ALLOWED_NOTE_CLASSES.has(c));
    if (classes.length) {
      out.push(` class="${escapeAttr(classes.join(' '))}"`);
    }
  }

  return out.join('');
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Replace `{{key}}` only for keys in ALLOWED_TEMPLATE_VARS that appear in vars.
 * Unknown placeholders are left unchanged.
 * @param {unknown} text
 * @param {Record<string, unknown> | null | undefined} vars
 * @returns {string}
 */
function interpolateTemplate(text, vars) {
  const source = text == null ? '' : String(text);
  const map = vars && typeof vars === 'object' ? vars : {};
  return source.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, key) => {
    if (!ALLOWED_TEMPLATE_VAR_SET.has(key)) return full;
    if (!Object.prototype.hasOwnProperty.call(map, key)) return full;
    const value = map[key];
    return value == null ? '' : String(value);
  });
}

/**
 * @param {string} status
 * @returns {{ is_published: boolean, is_active: boolean }}
 */
function syncPublishedFlags(status) {
  const published = status === 'PUBLISHED';
  return { is_published: published, is_active: published };
}

/**
 * Same priority as help.service: student > super_admin > admin > instructor > reviewer.
 * @param {{ roles?: string[] } | null | undefined} user
 * @returns {string | null}
 */
function primaryRole(user) {
  const roles = normalizeRoles(user);
  if (roles.includes('student')) return 'student';
  if (roles.includes('super_admin')) return 'super_admin';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('instructor')) return 'instructor';
  if (roles.includes('reviewer')) return 'reviewer';
  return roles[0] || null;
}

/**
 * @returns {Date}
 */
function nowUtc() {
  return new Date();
}

module.exports = {
  CONTENT_ADMIN_FORBIDDEN_MSG,
  OFFICIAL_ROLES,
  ALLOWED_TEMPLATE_VARS,
  assertContentAdmin,
  assertSuperAdminRestore,
  assertTargetUniversityInScope,
  assertTargetUniversitiesInScope,
  sanitizeHtml,
  sanitizeCtaUrl,
  interpolateTemplate,
  syncPublishedFlags,
  primaryRole,
  nowUtc,
};
