export function formatLectureDuration(seconds) {
  if (seconds == null || seconds === '') return '—';
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return [hours, minutes, secs].map((n) => String(n).padStart(2, '0')).join(':');
}

export function moveLecture(list, fromIndex, toIndex) {
  if (!Array.isArray(list)) return [];
  if (fromIndex === toIndex) return [...list];
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return [...list];
  }
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function lectureStatusVariant(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'published') return 'success';
  if (key === 'hidden') return 'muted';
  return 'warning';
}

export function lectureStatusKey(status) {
  const key = String(status || 'draft').toLowerCase();
  if (key === 'published' || key === 'hidden' || key === 'draft') return key;
  return 'draft';
}
