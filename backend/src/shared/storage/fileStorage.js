const path = require('path');
const { env } = require('../../config/env');

/**
 * File storage abstraction. Today: local disk + optional CDN/public base URL.
 * For S3: set STORAGE_BACKEND=s3 and implement upload in a future adapter — callers should store `storage_key` in DB and resolve URLs here.
 */
const STORAGE_BACKEND = env.STORAGE_BACKEND || 'local';

/**
 * Build a browser-accessible URL for a stored object key or legacy relative path.
 * @param {string | null | undefined} fileUrlOrKey Path under UPLOAD_DIR, full URL, or S3 key
 * @returns {string | null}
 */
function resolvePublicUrl(fileUrlOrKey) {
  if (fileUrlOrKey == null || fileUrlOrKey === '') return null;
  const s = String(fileUrlOrKey).trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (STORAGE_BACKEND === 's3' && env.S3_PUBLIC_BASE_URL) {
    const key = s.replace(/^\/+/, '');
    return `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  }
  const clean = s.replace(/^\/+/, '');
  const base = (env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  return `${base}/uploads/${clean}`;
}

/**
 * Normalize an incoming client path to a value safe to persist (relative to upload root).
 * Rejects absolute paths and parent traversal.
 * @param {string} input
 * @returns {string}
 */
function normalizeStoredPath(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  if (s.includes('..') || path.isAbsolute(s)) {
    throw new Error('Invalid file path');
  }
  return s.replace(/^\/+/, '');
}

module.exports = {
  STORAGE_BACKEND,
  resolvePublicUrl,
  normalizeStoredPath,
};
