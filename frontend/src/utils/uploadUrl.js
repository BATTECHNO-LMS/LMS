/** Build browser URL for a file stored under backend /uploads or public CDN */
export function resolveUploadUrl(stored) {
  if (!stored) return null;
  const s = String(stored).trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const clean = s.replace(/^\/+/, '').replace(/^uploads\//, '');
  if (s.startsWith('uploads/')) {
    return base ? `${base}/${s}` : `/${s}`;
  }
  return base ? `${base}/uploads/${clean}` : `/uploads/${clean}`;
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
