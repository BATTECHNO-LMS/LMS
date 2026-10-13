import { useEffect } from 'react';
import { apiClient } from '../../services/apiClient.js';
import { endpoints } from '../../services/endpoints.js';

/** Must match backend NAVIGATION_ACTIONS keys. */
export const NAVIGATION_MODULES = Object.freeze({
  COURSE: 'COURSE',
  ASSIGNMENT: 'ASSIGNMENT',
  FIELD_TRAINING: 'FIELD_TRAINING',
  REPORT: 'REPORT',
  RECORDED_LECTURE: 'RECORDED_LECTURE',
});

const CLIENT_DEDUPE_MS = 30 * 60 * 1000;
const recent = new Map();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Record that the user opened a page (business navigation event, deduplicated client-
 * and server-side). Not a session activity signal; failures are silent.
 */
export function recordNavigation({ module, entityId = null, entityType = null, reportKey = null }) {
  if (!NAVIGATION_MODULES[module]) return Promise.resolve(null);
  const id = entityId && UUID_RE.test(String(entityId)) ? String(entityId) : null;
  const key = `${module}:${id || ''}:${reportKey || ''}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < CLIENT_DEDUPE_MS) return Promise.resolve(null);
  recent.set(key, now);
  if (recent.size > 500) recent.delete(recent.keys().next().value);
  const body = { module };
  if (id) body.entity_id = id;
  if (entityType) body.entity_type = String(entityType).slice(0, 60);
  if (reportKey) body.report_key = String(reportKey).slice(0, 60);
  return apiClient.post(endpoints.activityNavigation, body).catch(() => null);
}

/** Hook form: fires once per (module, entity) while the page is mounted. */
export function useNavigationActivity(module, entityId, { enabled = true, entityType, reportKey } = {}) {
  useEffect(() => {
    if (!enabled || !module) return;
    if (!entityId && !reportKey) return;
    recordNavigation({ module, entityId, entityType, reportKey });
  }, [enabled, module, entityId, entityType, reportKey]);
}
