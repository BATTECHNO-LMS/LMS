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

module.exports = { resolvePrimaryUniversityId, resolveStudentSpecialtyId };
