const { ApiError } = require('../../utils/apiError');
const repo = require('./settings.repository');

async function getSettings() {
  const settings = await repo.getAllSettings();
  return { settings };
}

async function updateSettings(body) {
  const keys = Object.keys(body);
  if (!keys.length) {
    throw new ApiError(400, 'No settings provided');
  }
  for (const key of keys) {
    if (!repo.ALLOWED_KEYS.has(key)) {
      throw new ApiError(400, `Unknown setting key: ${key}`);
    }
    await repo.upsertSetting(key, body[key]);
  }
  return getSettings();
}

module.exports = { getSettings, updateSettings };
