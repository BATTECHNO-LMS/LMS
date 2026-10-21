/**
 * Privacy-safe internship journey analytics helpers.
 * Never attach PII (names, phones, national IDs, free-text university "other" details).
 */

const EVENT_PREFIX = 'internship_';

export function emitInternshipJourneyEvent(name, meta = {}) {
  const eventName = name.startsWith(EVENT_PREFIX) ? name : `${EVENT_PREFIX}${name}`;
  const safeMeta = sanitizeMeta(meta);
  try {
    window.dispatchEvent(new CustomEvent(eventName, { detail: safeMeta }));
  } catch {
    /* ignore non-DOM environments */
  }
  try {
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: eventName, ...safeMeta });
    }
  } catch {
    /* ignore */
  }
}

function sanitizeMeta(meta) {
  const out = {};
  for (const [key, value] of Object.entries(meta || {})) {
    if (value == null) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      if (/name|email|phone|national|address|otherUniversity|otherFaculty/i.test(key)) continue;
      out[key] = value;
    }
  }
  return out;
}
