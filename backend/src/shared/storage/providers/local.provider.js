const fs = require('fs');
const path = require('path');
const { env } = require('../../../config/env');
const { assertSafeStorageKey } = require('../fileRules');

function getAbsolutePath(storageKey) {
  const key = assertSafeStorageKey(storageKey);
  return path.join(env.UPLOAD_DIR || 'uploads', key.replace(/^uploads\//, ''));
}

async function objectExists(storageKey) {
  try {
    await fs.promises.access(getAbsolutePath(storageKey), fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function headObject(storageKey) {
  const abs = getAbsolutePath(storageKey);
  try {
    const stat = await fs.promises.stat(abs);
    return { size: stat.size, contentType: null };
  } catch {
    return null;
  }
}

async function deleteObject(storageKey) {
  const abs = getAbsolutePath(storageKey);
  try {
    await fs.promises.unlink(abs);
    return true;
  } catch {
    return false;
  }
}

async function createPresignedPutUrl() {
  throw new Error('Presigned uploads require STORAGE_BACKEND=r2');
}

async function createPresignedGetUrl() {
  throw new Error('Presigned downloads require STORAGE_BACKEND=r2');
}

async function checkHealth() {
  const dir = path.resolve(env.UPLOAD_DIR || 'uploads');
  try {
    await fs.promises.access(dir, fs.constants.W_OK);
    return { ok: true, backend: 'local', uploadDir: dir };
  } catch (err) {
    return { ok: false, backend: 'local', error: err.message };
  }
}

async function getObjectBuffer(storageKey) {
  const abs = getAbsolutePath(storageKey);
  return fs.promises.readFile(abs);
}

module.exports = {
  objectExists,
  headObject,
  deleteObject,
  createPresignedPutUrl,
  createPresignedGetUrl,
  checkHealth,
  getAbsolutePath,
  getObjectBuffer,
};
