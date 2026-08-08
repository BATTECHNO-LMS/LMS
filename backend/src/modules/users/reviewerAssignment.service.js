'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { isSystemWideAdmin } = require('../../utils/universityScope');
const { normalizeRoleCodes } = require('../../utils/roleCanon');
const { normalizeEmailDomain } = require('../../utils/normalizeEmailDomain');

function assertSuperAdmin(user) {
  if (!isSystemWideAdmin(user) && !normalizeRoleCodes(user?.roles || []).includes('super_admin')) {
    throw new ApiError(403, 'غير مصرح', null, 'REVIEWER_ASSIGN_FORBIDDEN');
  }
}

/**
 * Active university assignment for a reviewer (source of truth for scope).
 */
async function getActiveReviewerAssignment(userId) {
  if (!userId) return null;
  return prisma.reviewer_university_assignments.findFirst({
    where: { reviewer_user_id: userId, is_active: true },
    orderBy: { assigned_at: 'desc' },
    include: {
      // no relation defined — fetch university separately if needed
    },
  });
}

async function resolveReviewerUniversityId(userId, fallbackPrimaryId = null) {
  const assignment = await getActiveReviewerAssignment(userId);
  if (assignment?.university_id) return assignment.university_id;
  return fallbackPrimaryId || null;
}

async function deactivateOtherAssignments(tx, reviewerUserId, keepUniversityId = null) {
  await tx.reviewer_university_assignments.updateMany({
    where: {
      reviewer_user_id: reviewerUserId,
      is_active: true,
      ...(keepUniversityId ? { university_id: { not: keepUniversityId } } : {}),
    },
    data: { is_active: false, updated_at: new Date() },
  });
}

/**
 * Upsert active assignment and sync users.primary_university_id.
 */
async function assignReviewerUniversity({
  reviewerUserId,
  universityId,
  source = 'MANUAL',
  assignedById = null,
}) {
  if (!reviewerUserId || !universityId) {
    throw new ApiError(400, 'المراجع والجامعة مطلوبان');
  }
  const uni = await prisma.universities.findUnique({
    where: { id: universityId },
    select: { id: true, name: true, status: true },
  });
  if (!uni) throw new ApiError(404, 'الجامعة غير موجودة');

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    await deactivateOtherAssignments(tx, reviewerUserId, universityId);

    const existing = await tx.reviewer_university_assignments.findUnique({
      where: {
        reviewer_user_id_university_id: {
          reviewer_user_id: reviewerUserId,
          university_id: universityId,
        },
      },
    });

    let row;
    if (existing) {
      row = await tx.reviewer_university_assignments.update({
        where: { id: existing.id },
        data: {
          is_active: true,
          assignment_source: source,
          assigned_by_id: assignedById,
          assigned_at: now,
          updated_at: now,
        },
      });
    } else {
      row = await tx.reviewer_university_assignments.create({
        data: {
          reviewer_user_id: reviewerUserId,
          university_id: universityId,
          assignment_source: source,
          assigned_by_id: assignedById,
          assigned_at: now,
          is_active: true,
        },
      });
    }

    await tx.users.update({
      where: { id: reviewerUserId },
      data: { primary_university_id: universityId, updated_at: now },
    });

    const membership = await tx.university_users.findFirst({
      where: { user_id: reviewerUserId, university_id: universityId },
    });
    if (!membership) {
      await tx.university_users.create({
        data: {
          user_id: reviewerUserId,
          university_id: universityId,
          relationship_type: 'reviewer',
        },
      });
    } else if (membership.relationship_type !== 'reviewer') {
      await tx.university_users.update({
        where: { id: membership.id },
        data: { relationship_type: 'reviewer', updated_at: now },
      });
    }

    return row;
  });

  return result;
}

/**
 * Auto-assign from email domain when exactly one active university matches.
 * @returns {Promise<object|null>} assignment or null
 */
async function tryAutoAssignFromEmail(userId, email, { assignedById = null } = {}) {
  const domain = normalizeEmailDomain(String(email || '').split('@')[1] || '');
  if (!domain) return null;

  // Skip common free mail providers — require manual assignment
  const freeDomains = new Set([
    'gmail.com',
    'googlemail.com',
    'outlook.com',
    'hotmail.com',
    'yahoo.com',
    'icloud.com',
    'live.com',
    'msn.com',
  ]);
  if (freeDomains.has(domain)) return null;

  const matches = await prisma.university_email_domains.findMany({
    where: { domain, is_active: true },
    select: { university_id: true },
  });
  const uniqueUniIds = [...new Set(matches.map((m) => m.university_id))];
  if (uniqueUniIds.length !== 1) return null;

  return assignReviewerUniversity({
    reviewerUserId: userId,
    universityId: uniqueUniIds[0],
    source: 'EMAIL_DOMAIN',
    assignedById,
  });
}

async function adminAssignReviewerUniversity(actor, reviewerUserId, universityId) {
  assertSuperAdmin(actor);
  const previous = await getActiveReviewerAssignment(reviewerUserId);
  const row = await assignReviewerUniversity({
    reviewerUserId,
    universityId,
    source: 'MANUAL',
    assignedById: actor.userId,
  });
  await recordAudit({
    userId: actor.userId,
    actionType: 'REVIEWER_UNIVERSITY_ASSIGNED',
    entityType: 'reviewer_university_assignments',
    entityId: row.id,
    oldValues: previous
      ? { university_id: previous.university_id, source: previous.assignment_source }
      : null,
    newValues: {
      reviewer_user_id: reviewerUserId,
      university_id: universityId,
      source: 'MANUAL',
    },
  });
  return { assignment: row };
}

async function deactivateReviewerAssignments(reviewerUserId) {
  await prisma.reviewer_university_assignments.updateMany({
    where: { reviewer_user_id: reviewerUserId, is_active: true },
    data: { is_active: false, updated_at: new Date() },
  });
}

async function adminDeactivateReviewerAssignment(actor, reviewerUserId) {
  assertSuperAdmin(actor);
  const previous = await getActiveReviewerAssignment(reviewerUserId);
  await deactivateReviewerAssignments(reviewerUserId);
  await recordAudit({
    userId: actor.userId,
    actionType: 'REVIEWER_UNIVERSITY_UNASSIGNED',
    entityType: 'reviewer_university_assignments',
    entityId: previous?.id || null,
    oldValues: previous
      ? { university_id: previous.university_id, source: previous.assignment_source }
      : null,
    newValues: { reviewer_user_id: reviewerUserId, is_active: false },
  });
  return { ok: true };
}

async function listReviewersNeedingAssignment() {
  const reviewerRole = await prisma.roles.findUnique({ where: { code: 'reviewer' } });
  if (!reviewerRole) return { reviewers: [] };
  const links = await prisma.user_roles.findMany({
    where: { role_id: reviewerRole.id },
    select: { user_id: true },
  });
  const userIds = links.map((l) => l.user_id);
  if (!userIds.length) return { reviewers: [] };

  const assigned = await prisma.reviewer_university_assignments.findMany({
    where: { reviewer_user_id: { in: userIds }, is_active: true },
    select: { reviewer_user_id: true },
  });
  const assignedSet = new Set(assigned.map((a) => a.reviewer_user_id));
  const missingIds = userIds.filter((id) => !assignedSet.has(id));
  if (!missingIds.length) return { reviewers: [] };

  const users = await prisma.users.findMany({
    where: { id: { in: missingIds } },
    select: {
      id: true,
      email: true,
      full_name: true,
      primary_university_id: true,
      status: true,
    },
  });
  return { reviewers: users };
}

module.exports = {
  getActiveReviewerAssignment,
  resolveReviewerUniversityId,
  assignReviewerUniversity,
  tryAutoAssignFromEmail,
  adminAssignReviewerUniversity,
  adminDeactivateReviewerAssignment,
  deactivateReviewerAssignments,
  listReviewersNeedingAssignment,
};
