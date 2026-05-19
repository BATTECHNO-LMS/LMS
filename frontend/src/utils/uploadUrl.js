/** Build browser URL for a file stored under backend /uploads */
export function resolveUploadUrl(stored) {
  if (!stored) return null;
  const s = String(stored).trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const clean = s.replace(/^\/+/, '').replace(/^uploads\//, '');
  return base ? `${base}/uploads/${clean}` : `/uploads/${clean}`;
}
