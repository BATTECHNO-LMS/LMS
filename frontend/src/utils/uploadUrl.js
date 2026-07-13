/** Build browser URL for a file stored under backend /uploads or public CDN */
export function resolveUploadUrl(stored) {
  if (!stored) return null;
  const s = String(stored).trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('blob:')) return s;
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const clean = s.replace(/^\/+/, '').replace(/^uploads\//, '');
  if (s.startsWith('uploads/') || s.startsWith('/uploads/')) {
    const path = s.replace(/^\/+/, '');
    return base ? `${base}/${path}` : `/${path}`;
  }
  return base ? `${base}/uploads/${clean}` : `/uploads/${clean}`;
}

/** Alias used by course/cover UI — same behavior as resolveUploadUrl. */
export function getFileUrl(stored) {
  return resolveUploadUrl(stored);
}

/** Stored value for DB fields after presigned upload (url, storage key, or file id). */
export function storedValueFromFileRecord(record) {
  if (!record) return '';
  return record.url || record.storageKey || record.id || '';
}

/** Preview URL for a stored file record or legacy path. */
export function previewUrlFromFileRecord(record) {
  if (!record) return null;
  if (record.url) return record.url;
  return resolveUploadUrl(record.storageKey);
}
