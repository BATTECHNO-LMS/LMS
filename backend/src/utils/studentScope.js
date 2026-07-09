const { prisma } = require('../config/db');

/**
 * Student JWT may omit universityId on older tokens — fall back to users.primary_university_id.
 * @param {{ userId: string, universityId?: string | null }} requester
 * @returns {Promise<string | null>}
 */
async function resolvePrimaryUniversityId(requester) {
  if (requester?.universityId) return requester.universityId;
  if (!requester?.userId) return null;
  const u = await prisma.users.findUnique({
    where: { id: requester.userId },
    select: { primary_university_id: true },
  });
  return u?.primary_university_id ?? null;
}

/**
 * @param {{ userId: string }} requester
 * @returns {Promise<string | null>}
 */
async function resolveStudentSpecialtyId(requester) {
  if (!requester?.userId) return null;
  const u = await prisma.users.findUnique({
    where: { id: requester.userId },
    select: { specialty_id: true },
  });
  return u?.specialty_id ?? null;
}

/**
 * @param {{ userId: string }} requester
 * @returns {Promise<string | null>}
 */
async function resolveStudentUniversitySpecialtyId(requester) {
  if (!requester?.userId) return null;
  const u = await prisma.users.findUnique({
    where: { id: requester.userId },
    select: { university_specialty_id: true },
  });
  return u?.university_specialty_id ?? null;
}

/**
 * @param {{ userId: string }} requester
 * @returns {Promise<{ universityId: string | null, universitySpecialtyId: string | null, canonicalSpecialtyId: string | null }>}
 */
async function resolveStudentFieldTrainingScope(requester) {
  if (!requester?.userId) {
    return { universityId: null, universitySpecialtyId: null, canonicalSpecialtyId: null };
  }
  const u = await prisma.users.findUnique({
    where: { id: requester.userId },
    select: {
      primary_university_id: true,
      university_specialty_id: true,
      specialty_id: true,
    },
  });
  return {
    universityId: u?.primary_university_id ?? null,
    universitySpecialtyId: u?.university_specialty_id ?? null,
    canonicalSpecialtyId: u?.specialty_id ?? null,
  };
}

module.exports = {
  resolvePrimaryUniversityId,
  resolveStudentSpecialtyId,
  resolveStudentUniversitySpecialtyId,
  resolveStudentFieldTrainingScope,
};
