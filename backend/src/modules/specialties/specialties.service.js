const { ApiError } = require('../../utils/apiError');
const specialtiesRepository = require('./specialties.repository');

async function listActiveSpecialties() {
  const specialties = await specialtiesRepository.findActiveAll();
  return { specialties };
}

/**
 * @param {string | null | undefined} specialtyId
 * @param {{ requiredMessage?: string, invalidMessage?: string }} [messages]
 */
async function assertActiveSpecialty(specialtyId, messages = {}) {
  const requiredMessage = messages.requiredMessage ?? 'يرجى اختيار التخصص.';
  const invalidMessage = messages.invalidMessage ?? 'التخصص المحدد غير متاح.';

  if (!specialtyId) {
    throw new ApiError(400, requiredMessage, null, 'SPECIALTY_REQUIRED');
  }

  const specialty = await specialtiesRepository.findActiveById(specialtyId);
  if (!specialty) {
    throw new ApiError(400, invalidMessage, null, 'SPECIALTY_NOT_AVAILABLE');
  }
  return specialty;
}

module.exports = {
  listActiveSpecialties,
  assertActiveSpecialty,
};
