const { prisma } = require('../../config/db');

const ALLOWED_KEYS = new Set(['platform_name', 'timezone', 'default_locale', 'support_email']);

async function getSetting(key) {
  const row = await prisma.system_settings.findUnique({ where: { setting_key: key } });
  return row?.setting_value ?? null;
}

async function getAllSettings() {
  const rows = await prisma.system_settings.findMany({
    where: { setting_key: { in: [...ALLOWED_KEYS] } },
    orderBy: { setting_key: 'asc' },
  });
  const out = {};
  for (const key of ALLOWED_KEYS) {
    out[key] = null;
  }
  for (const row of rows) {
    const val = row.setting_value;
    out[row.setting_key] = typeof val === 'object' && val !== null && 'value' in val ? val.value : val;
  }
  return out;
}

async function upsertSetting(key, value) {
  if (!ALLOWED_KEYS.has(key)) {
    throw new Error(`Setting key not allowed: ${key}`);
  }
  const setting_value = { value };
  return prisma.system_settings.upsert({
    where: { setting_key: key },
    create: { setting_key: key, setting_value },
    update: { setting_value, updated_at: new Date() },
  });
}

module.exports = { ALLOWED_KEYS, getSetting, getAllSettings, upsertSetting };
