'use strict';

const TEST_EMAIL_DOMAINS = new Set(['batuni.edu']);

function beneficiaryUniversityIds(opportunity = {}) {
  const ids = new Set();
  if (opportunity.university_id) ids.add(String(opportunity.university_id));
  for (const row of opportunity.field_training_opportunity_eligibility || []) {
    if (row?.university_id) ids.add(String(row.university_id));
  }
  return ids;
}

function classifyOfficialReportExclusion({ student = {}, opportunity = {} } = {}) {
  const beneficiaries = beneficiaryUniversityIds(opportunity);
  const primaryUniversityId = student.primary_university_id || student.primaryUniversityId;
  const email = String(student.email || '').trim().toLowerCase();
  const domain = email.includes('@') ? email.split('@')[1] : '';

  if (domain && TEST_EMAIL_DOMAINS.has(domain)) {
    return {
      excluded: true,
      code: 'TEST_ACCOUNT_EXCLUDED',
      reason: 'Demo/test platform account — excluded from official Mutah report population',
    };
  }

  if (beneficiaries.size && primaryUniversityId && !beneficiaries.has(String(primaryUniversityId))) {
    return {
      excluded: true,
      code: 'NON_BENEFICIARY_UNIVERSITY',
      reason: 'Student primary university is outside the opportunity beneficiary universities',
    };
  }

  return { excluded: false, code: null, reason: null };
}

module.exports = {
  beneficiaryUniversityIds,
  classifyOfficialReportExclusion,
};
