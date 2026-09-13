'use strict';

const brand = {
  PRODUCT_NAME: 'eprojecto',
  CANONICAL_URL: 'https://eprojecto.com',
  COMPANY_NAME: 'BATMAN TECHNOLOGY',
  COMPANY_NAME_AR: 'شركة الرجل الوطواط للتكنولوجيا',
};

function formatEmailFrom(address) {
  const raw = String(address || '').trim();
  if (!raw) return `${brand.PRODUCT_NAME} <no-reply@lms.battechno.com>`;
  if (raw.includes('<')) return raw;
  return `${brand.PRODUCT_NAME} <${raw}>`;
}

module.exports = { brand, formatEmailFrom };
