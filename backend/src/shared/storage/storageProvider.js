const { env } = require('../../config/env');
const local = require('./providers/local.provider');
const r2 = require('./providers/r2.provider');

const BACKEND = (env.STORAGE_BACKEND || 'local').trim().toLowerCase();

function getProvider() {
  if (BACKEND === 'r2') return r2;
  return local;
}

function getStorageBackend() {
  return BACKEND;
}

function assertStorageConfigured() {
  if (BACKEND === 'r2') {
    r2.assertR2Configured();
  }
}

module.exports = {
  getProvider,
  getStorageBackend,
  assertStorageConfigured,
  local,
  r2,
};
