const { ApiError } = require('../../utils/apiError');
const universitiesRepository = require('./universities.repository');

function emptyToNull(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  return typeof value === 'string' ? value.trim() : value;
}

const UNIVERSITY_FIELD_KEYS = [
  'name',
  'name_en',
  'short_name',
  'code',
  'type',
  'website',
  'country',
  'city',
  'address',
  'contact_person',
  'contact_email',
  'contact_phone',
  'logo_url',
  'status',
  'partnership_state',
  'notes',
];

function normalizeFieldValue(key, value) {
  if (key === 'name') return String(value).trim();
  if (key === 'code') {
    const t = emptyToNull(value);
    return t == null ? null : String(t).trim().toUpperCase();
  }
  if (key === 'contact_email') {
    const t = emptyToNull(value);
    return t == null ? null : String(t).trim().toLowerCase();
  }
  if (key === 'status') return value ?? 'active';
  if (key === 'partnership_state') return value ?? 'active';
  if (key === 'notes') return value === null || value === '' ? null : value == null ? null : String(value);
  return emptyToNull(value);
}

function normalizeUniversityFields(body, { partial = false } = {}) {
  const out = {};
  for (const key of UNIVERSITY_FIELD_KEYS) {
    if (partial && body[key] === undefined) continue;
    if (!partial && body[key] === undefined) {
      if (key === 'name') continue;
      if (key === 'status') {
        out.status = 'active';
        continue;
      }
      if (key === 'partnership_state') {
        out.partnership_state = 'active';
        continue;
      }
      out[key] = null;
      continue;
    }
    out[key] = normalizeFieldValue(key, body[key]);
  }
  if (!partial && body.name !== undefined) {
    out.name = String(body.name).trim();
  }
  return out;
}

async function assertUniqueName(name, excludeId = null) {
  const row = await universitiesRepository.findByName(name);
  if (row && row.id !== excludeId) {
    throw new ApiError(409, 'اسم الجامعة مستخدم مسبقًا', null, 'UNIVERSITY_NAME_EXISTS');
  }
}

async function assertUniqueCode(code, excludeId = null) {
  if (!code) return;
  const row = await universitiesRepository.findByCode(code);
  if (row && row.id !== excludeId) {
    throw new ApiError(409, 'كود الجامعة مستخدم مسبقًا', null, 'UNIVERSITY_CODE_EXISTS');
  }
}

async function assertDomainsAvailable(domains, excludeUniversityId = null) {
  if (!domains?.length) return;
  for (const d of domains) {
    if (d.is_active === false) continue;
    const clash = await universitiesRepository.findActiveDomainElsewhere(d.domain, excludeUniversityId);
    if (clash) {
      const uniName = clash.universities?.name || clash.university_id;
      throw new ApiError(
        409,
        `نطاق البريد "${d.domain}" مستخدم بالفعل لدى جامعة أخرى (${uniName})`,
        { domain: d.domain, university_id: clash.university_id },
        'EMAIL_DOMAIN_IN_USE'
      );
    }
  }
}

async function listUniversities() {
  const rows = await universitiesRepository.findAllOrdered();
  return { universities: rows };
}

async function getUniversityById(id, query = {}) {
  const row = await universitiesRepository.findById(id, { includeRelations: true });
  if (!row) {
    throw new ApiError(404, 'الجامعة غير موجودة');
  }

  if (!query.include_counts) {
    return row;
  }

  const [linked_users_count, linked_micro_credentials_count] = await Promise.all([
    universitiesRepository.countLinkedUsers(id),
    universitiesRepository.countLinkedMicroCredentials(id),
  ]);

  return { ...row, linked_users_count, linked_micro_credentials_count };
}

async function createUniversity(body) {
  const payload = normalizeUniversityFields(body, { partial: false });
  await assertUniqueName(payload.name);
  await assertUniqueCode(payload.code);
  await assertDomainsAvailable(body.email_domains || []);

  try {
    return await universitiesRepository.createUniversityWithRelations(payload, {
      emailDomains: body.email_domains || [],
      specialties: body.specialties || [],
    });
  } catch (e) {
    if (e && e.code === 'P2002') {
      const target = e.meta?.target;
      if (Array.isArray(target) && target.includes('code')) {
        throw new ApiError(409, 'كود الجامعة مستخدم مسبقًا', null, 'UNIVERSITY_CODE_EXISTS');
      }
      if (Array.isArray(target) && target.some((t) => String(t).includes('domain'))) {
        throw new ApiError(409, 'نطاق البريد مكرر', null, 'EMAIL_DOMAIN_DUPLICATE');
      }
      throw new ApiError(409, 'اسم الجامعة مستخدم مسبقًا', null, 'UNIVERSITY_NAME_EXISTS');
    }
    throw e;
  }
}

async function updateUniversity(id, body) {
  const existing = await universitiesRepository.findById(id, { includeRelations: false });
  if (!existing) {
    throw new ApiError(404, 'الجامعة غير موجودة');
  }

  const payload = normalizeUniversityFields(body, { partial: true });
  if (payload.name) await assertUniqueName(payload.name, id);
  if (payload.code !== undefined) await assertUniqueCode(payload.code, id);
  if (body.email_domains !== undefined) {
    await assertDomainsAvailable(body.email_domains, id);
  }

  if (Object.keys(payload).length) {
    payload.updated_at = new Date();
  }

  try {
    return await universitiesRepository.updateUniversityWithRelations(id, payload, {
      emailDomains: body.email_domains,
      specialties: body.specialties,
    });
  } catch (e) {
    if (e && e.code === 'P2002') {
      const target = e.meta?.target;
      if (Array.isArray(target) && target.includes('code')) {
        throw new ApiError(409, 'كود الجامعة مستخدم مسبقًا', null, 'UNIVERSITY_CODE_EXISTS');
      }
      if (Array.isArray(target) && target.some((t) => String(t).includes('domain'))) {
        throw new ApiError(409, 'نطاق البريد مكرر', null, 'EMAIL_DOMAIN_DUPLICATE');
      }
      throw new ApiError(409, 'اسم الجامعة مستخدم مسبقًا', null, 'UNIVERSITY_NAME_EXISTS');
    }
    throw e;
  }
}

module.exports = {
  listUniversities,
  getUniversityById,
  createUniversity,
  updateUniversity,
};
