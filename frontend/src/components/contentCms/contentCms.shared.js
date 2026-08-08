/** Lower number = higher priority (matches backend). */
export function compareCmsPriority(a, b) {
  const pa = Number(a?.priority ?? 100);
  const pb = Number(b?.priority ?? 100);
  if (pa !== pb) return pa - pb;
  const ackA = Boolean(a?.requires_acknowledgement);
  const ackB = Boolean(b?.requires_acknowledgement);
  if (ackA !== ackB) return ackA ? -1 : 1;
  return 0;
}

/**
 * Pick a single modal candidate so managed popups and announcement POPUPs never stack.
 * Prefers lower priority number, then acknowledgement-required.
 */
export function pickHighestPriorityModal(candidates = []) {
  if (!candidates.length) return null;
  return [...candidates].sort(compareCmsPriority)[0] || null;
}

export function announcementHasChannel(announcement, code) {
  const channels = announcement?.channels || [];
  return channels.some((c) => c.channel_code === code && c.is_enabled !== false);
}

export function isDashboardPath(pathname = '') {
  return /\/(student|instructor|reviewer|admin|academic)\/dashboard\/?$/.test(pathname)
    || pathname === '/admin'
    || pathname === '/admin/';
}

export function normalizeAnnouncementsPayload(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.announcements)) return data.announcements;
  return [];
}

export function normalizePopupsPayload(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.popups)) return data.popups;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}
