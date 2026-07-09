const { ApiError } = require('../../utils/apiError');
const authRepository = require('../auth/auth.repository');
const universitySpecialtiesRepository = require('./universitySpecialties.repository');

function mapUniversitySpecialtyRow(row) {
  return {
    id: row.id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    code: row.code,
    collegeNameAr: row.college_name_ar,
    collegeNameEn: row.college_name_en,
    canonicalSpecialtyId: row.specialty_id,
  };
}

async function listActiveForUniversity(universityId) {
  const university = await authRepository.findUniversityById(universityId);
  if (!university) {
    throw new ApiError(404, 'University not found');
  }

  const rows = await universitySpecialtiesRepository.findActiveByUniversityId(universityId);
  return rows.map(mapUniversitySpecialtyRow);
}

/**
 * @param {string} universityId
 * @param {string} universitySpecialtyId
 */
async function assertActiveUniversitySpecialtyForUniversity(universityId, universitySpecialtyId) {
  if (!universitySpecialtyId) {
    throw new ApiError(
      400,
      'يرجى اختيار التخصص المرتبط بالجامعة المحددة.',
      null,
      'UNIVERSITY_SPECIALTY_REQUIRED'
    );
  }

  const row = await universitySpecialtiesRepository.findActiveByIdForUniversity(
    universitySpecialtyId,
    universityId
  );
  if (!row) {
    throw new ApiError(
      400,
      'التخصص المحدد غير مرتبط بالجامعة المختارة.',
      null,
      'UNIVERSITY_SPECIALTY_MISMATCH'
    );
  }
  return row;
}

module.exports = {
  listActiveForUniversity,
  assertActiveUniversitySpecialtyForUniversity,
  mapUniversitySpecialtyRow,
};
