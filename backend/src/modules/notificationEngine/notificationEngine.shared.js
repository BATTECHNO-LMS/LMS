'use strict';

const { ApiError } = require('../../utils/apiError');
const { normalizeRoleCodes } = require('../../utils/roleCanon');
const {
  isSystemWideAdmin,
  assertUniversityRecordAccess,
} = require('../../utils/universityScope');
const { ALLOWED_TEMPLATE_VARS } = require('./notificationEvents.catalog');

const NOTIFICATION_ADMIN_FORBIDDEN_MSG = 'لا تملك صلاحية إدارة هذه الإشعارات.';

const OFFICIAL_ROLES = Object.freeze([
  'super_admin',
  'admin',
  'instructor',
  'trainer',
  'trainee',
  'student',
  'reviewer',
]);

const ALLOWED_TEMPLATE_VAR_SET = new Set(ALLOWED_TEMPLATE_VARS);

const TEMPLATE_VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * @param {{ isGlobal?: boolean, roles?: string[] } | null | undefined} user
 * @returns {string[]}
 */
function normalizeRoles(user) {
  return normalizeRoleCodes(user?.roles || []);
}

/**
 * Notification engine admin: global user, or role super_admin / admin.
 * @param {{ isGlobal?: boolean, roles?: string[] } | null | undefined} user
 */
function assertNotificationAdmin(user) {
  if (user?.isGlobal) return;
  const roles = normalizeRoles(user);
  if (roles.includes('super_admin') || roles.includes('admin')) return;
  throw new ApiError(403, NOTIFICATION_ADMIN_FORBIDDEN_MSG, null, 'NOTIFICATION_ADMIN_FORBIDDEN');
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
 * Read university ids from rule.target_scope.university_ids.
 * @param {unknown} targetScope
 * @returns {string[]}
 */
function getTargetUniversityIdsFromScope(targetScope) {
  if (!targetScope || typeof targetScope !== 'object' || Array.isArray(targetScope)) return [];
  const ids = /** @type {{ university_ids?: unknown }} */ (targetScope).university_ids;
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => String(id)).filter(Boolean);
}

/**
 * Build target_scope JSON from API-facing university id list.
 * Empty / missing → null (global rule).
 * @param {unknown} universityIds
 * @returns {{ university_ids: string[] } | null}
 */
function toTargetScope(universityIds) {
  if (!Array.isArray(universityIds) || universityIds.length === 0) return null;
  const ids = [...new Set(universityIds.map((id) => String(id)).filter(Boolean))];
  if (!ids.length) return null;
  return { university_ids: ids };
}

/**
 * Replace `{{key}}` with vars. Unknown/missing keys become empty string (or fallback '-').
 * Never returns the string "undefined".
 * @param {unknown} template
 * @param {Record<string, unknown> | null | undefined} vars
 * @param {{ missingFallback?: string }} [options]
 * @returns {string}
 */
function renderTemplate(template, vars, options = {}) {
  const source = template == null ? '' : String(template);
  const map = vars && typeof vars === 'object' ? vars : {};
  const missingFallback =
    options.missingFallback === undefined ? '' : String(options.missingFallback ?? '');

  return source.replace(TEMPLATE_VAR_RE, (_full, key) => {
    if (!Object.prototype.hasOwnProperty.call(map, key)) {
      return missingFallback === '' ? '' : missingFallback;
    }
    const value = map[key];
    if (value == null) return missingFallback === '' ? '' : missingFallback;
    const str = String(value);
    if (str === 'undefined' || str === 'null') {
      return missingFallback === '' ? '' : missingFallback;
    }
    return str;
  });
}

/**
 * Reject templates that reference variables outside ALLOWED_TEMPLATE_VARS.
 * @param {unknown} template
 * @returns {{ ok: true } | { ok: false, unknown: string[] }}
 */
function validateTemplateVariables(template) {
  const source = template == null ? '' : String(template);
  const unknown = new Set();
  let m;
  const re = new RegExp(TEMPLATE_VAR_RE.source, 'g');
  while ((m = re.exec(source))) {
    const key = m[1];
    if (!ALLOWED_TEMPLATE_VAR_SET.has(key)) unknown.add(key);
  }
  if (unknown.size) return { ok: false, unknown: [...unknown] };
  return { ok: true };
}

/**
 * Assert all template fields only use allowed variables.
 * @param {{ title_template?: string, body_template?: string, action_label_template?: string | null, action_url_template?: string | null }} fields
 */
function assertTemplatesUseAllowedVars(fields) {
  const parts = [
    fields.title_template,
    fields.body_template,
    fields.action_label_template,
    fields.action_url_template,
  ];
  const unknown = new Set();
  for (const part of parts) {
    const result = validateTemplateVariables(part);
    if (!result.ok) result.unknown.forEach((k) => unknown.add(k));
  }
  if (unknown.size) {
    throw new ApiError(
      400,
      `متغيرات قالب غير معروفة: ${[...unknown].join(', ')}`,
      { unknown: [...unknown] },
      'UNKNOWN_TEMPLATE_VARIABLES'
    );
  }
}

/**
 * Map engine priority to legacy notifications.type enum values.
 * @param {unknown} priority
 * @returns {'info'|'success'|'warning'|'danger'|'system'|'action_required'}
 */
function mapPriorityToLegacyType(priority) {
  const p = String(priority || 'NORMAL').toUpperCase();
  if (p === 'URGENT') return 'danger';
  if (p === 'HIGH') return 'warning';
  if (p === 'LOW') return 'info';
  return 'info';
}

/**
 * Stable deduplication key for a recipient+event+entity+rule tuple.
 * @param {{ eventType: string, recipientId: string, entityType?: string | null, entityId?: string | null, ruleId?: string | null }} params
 * @returns {string}
 */
function buildDeduplicationKey({ eventType, recipientId, entityType, entityId, ruleId }) {
  const parts = [
    String(eventType || ''),
    String(recipientId || ''),
    String(entityType || ''),
    String(entityId || ''),
    String(ruleId || ''),
  ];
  return parts.join(':').slice(0, 300);
}

/**
 * Strip any accidental attendance code / secret fields from template vars.
 * @param {Record<string, unknown> | null | undefined} vars
 * @returns {Record<string, unknown>}
 */
function sanitizeTemplateVars(vars) {
  const map = vars && typeof vars === 'object' ? { ...vars } : {};
  const banned = [
    'attendance_code',
    'code',
    'code_hash',
    'otp',
    'password',
    'token',
    'secret',
  ];
  for (const key of banned) {
    if (Object.prototype.hasOwnProperty.call(map, key)) delete map[key];
  }
  return map;
}

module.exports = {
  NOTIFICATION_ADMIN_FORBIDDEN_MSG,
  OFFICIAL_ROLES,
  ALLOWED_TEMPLATE_VARS,
  assertNotificationAdmin,
  assertTargetUniversityInScope,
  assertTargetUniversitiesInScope,
  getTargetUniversityIdsFromScope,
  toTargetScope,
  renderTemplate,
  validateTemplateVariables,
  assertTemplatesUseAllowedVars,
  mapPriorityToLegacyType,
  buildDeduplicationKey,
  sanitizeTemplateVars,
  normalizeRoles,
  isSystemWideAdmin,
};
