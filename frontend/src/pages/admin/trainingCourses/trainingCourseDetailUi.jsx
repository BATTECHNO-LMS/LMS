/**
 * Display helpers for the admin training-course detail overview.
 * Date labels stay on ar-EG + Asia/Amman noon so calendar days do not shift.
 */

export function formatTrainingDateAr(value) {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T12:00:00+03:00`;
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Amman',
    }).format(new Date(iso));
  } catch {
    return raw;
  }
}

export function formatTrainingDateRangeShort(start, end) {
  const s = formatTrainingDateAr(start);
  const e = formatTrainingDateAr(end);
  if (s && e) {
    const startShort = s.replace(/\s*2026\s*$/, '').trim();
    return `${startShort} – ${e}`;
  }
  if (s) return s;
  if (e) return e;
  return '—';
}

export function parseCourseDomains(course) {
  if (Array.isArray(course?.domains) && course.domains.length) {
    return course.domains.map((d) => String(d).trim()).filter(Boolean);
  }
  return String(course?.field || '')
    .split(/[،,•|]/)
    .map((d) => d.trim())
    .filter(Boolean);
}

export function MultilineBlock({ text }) {
  if (!text) return <p className="muted">—</p>;
  const lines = String(text)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{text}</p>;
  return (
    <ul style={{ margin: 0, paddingInlineStart: '1.25rem', lineHeight: 1.85 }}>
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
