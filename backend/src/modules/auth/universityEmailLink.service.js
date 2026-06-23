const { prisma } = require('../../config/db');
const { extractEmailDomain, emailDomainMatchesAllowed } = require('../../utils/emailDomain');

/**
 * Resolve active university from an email address using university_email_domains.
 * @param {string} email
 * @returns {Promise<{ id: string, name: string } | null>}
 */
async function resolveUniversityFromEmail(email) {
  const emailDomain = extractEmailDomain(email);
  if (!emailDomain) return null;

  const rows = await prisma.university_email_domains.findMany({
    where: { is_active: true, universities: { status: 'active' } },
    select: {
      domain: true,
      university_id: true,
      universities: { select: { id: true, name: true, status: true } },
    },
  });

  for (const row of rows) {
    if (!emailDomainMatchesAllowed(emailDomain, [row.domain])) continue;
    if (row.universities?.status !== 'active') continue;
    return { id: row.universities.id, name: row.universities.name };
  }

  return null;
}

/**
 * Set primary_university_id and university_users from email domain when missing.
 * @param {string} userId
 * @param {string} email
 * @returns {Promise<{ id: string, name: string } | null>}
 */
async function ensureUserLinkedToUniversityFromEmail(userId, email) {
  if (!userId || !email) return null;

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, email: true, primary_university_id: true },
  });
  if (!user) return null;

  if (user.primary_university_id) {
    const uni = await prisma.universities.findFirst({
      where: { id: user.primary_university_id, status: 'active' },
      select: { id: true, name: true },
    });
    return uni;
  }

  const resolved = await resolveUniversityFromEmail(email);
  if (!resolved) return null;

  await prisma.$transaction(async (tx) => {
    await tx.users.update({
      where: { id: userId },
      data: { primary_university_id: resolved.id },
    });

    const existing = await tx.university_users.findFirst({
      where: { user_id: userId, university_id: resolved.id },
    });
    if (!existing) {
      await tx.university_users.create({
        data: {
          user_id: userId,
          university_id: resolved.id,
          relationship_type: 'student',
        },
      });
    }
  });

  return resolved;
}

module.exports = { resolveUniversityFromEmail, ensureUserLinkedToUniversityFromEmail };
