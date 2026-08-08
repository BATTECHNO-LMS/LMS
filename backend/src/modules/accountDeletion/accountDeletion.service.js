'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { comparePassword } = require('../../utils/password');
const { recordAudit } = require('../../shared/services/audit.service');
const repo = require('./accountDeletion.repository');

const SUPPORTED_ROLES = new Set([
  'student',
  'instructor',
  'university_admin',
  'academic_admin',
  'qa_officer',
  'university_reviewer',
  'super_admin',
]);

function assertDeletionAvailable(roles) {
  const list = Array.isArray(roles) ? roles : [];
  if (list.includes('program_admin') && !list.some((r) => SUPPORTED_ROLES.has(r))) {
    throw new ApiError(
      403,
      'Account deletion is unavailable for this role',
      null,
      'ACCOUNT_DELETION_UNAVAILABLE'
    );
  }
  if (!list.some((r) => SUPPORTED_ROLES.has(r))) {
    throw new ApiError(
      403,
      'Account deletion is unavailable for this role',
      null,
      'ACCOUNT_DELETION_UNAVAILABLE'
    );
  }
}

function toPublicRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    reason: row.reason ?? null,
    requested_at: row.requested_at,
    processed_at: row.processed_at ?? null,
    cancelled_at: row.cancelled_at ?? null,
    // Never expose resolution_note / processed_by_id to the requester.
  };
}

function toAdminRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    status: row.status,
    reason: row.reason ?? null,
    requested_at: row.requested_at,
    processed_at: row.processed_at ?? null,
    processed_by_id: row.processed_by_id ?? null,
    resolution_note: row.resolution_note ?? null,
    cancelled_at: row.cancelled_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getMyDeletionRequest(requester) {
  assertDeletionAvailable(requester.roles);
  const active = await repo.findActiveByUserId(requester.userId);
  if (active) {
    return { request: toPublicRequest(active), has_active_request: true };
  }
  const latest = await repo.findLatestByUserId(requester.userId);
  return {
    request: toPublicRequest(latest),
    has_active_request: false,
  };
}

async function createMyDeletionRequest(requester, body, { ipAddress } = {}) {
  assertDeletionAvailable(requester.roles);

  const active = await repo.findActiveByUserId(requester.userId);
  if (active) {
    throw new ApiError(
      409,
      'An active deletion request already exists',
      { status: active.status },
      'DELETION_REQUEST_ALREADY_EXISTS'
    );
  }

  const user = await prisma.users.findUnique({
    where: { id: requester.userId },
    select: { id: true, password_hash: true, primary_university_id: true },
  });
  if (!user) {
    throw new ApiError(401, 'Unauthorized', null, 'USER_NOT_FOUND');
  }

  const passwordOk = await comparePassword(body.currentPassword, user.password_hash);
  if (!passwordOk) {
    throw new ApiError(401, 'Current password is incorrect', null, 'INVALID_PASSWORD');
  }

  if (body.confirmation !== 'DELETE') {
    throw new ApiError(
      400,
      'Confirmation phrase DELETE is required',
      null,
      'CONFIRMATION_REQUIRED'
    );
  }

  const created = await repo.createRequest({
    userId: requester.userId,
    reason: body.reason || null,
  });

  await recordAudit({
    userId: requester.userId,
    universityId: user.primary_university_id,
    actionType: 'ACCOUNT_DELETION_REQUESTED',
    entityType: 'account_deletion_request',
    entityId: created.id,
    newValues: {
      status: created.status,
      // Do not log password or confirmation phrase.
      has_reason: Boolean(body.reason),
    },
    ipAddress: ipAddress ?? null,
  });

  return {
    request: toPublicRequest(created),
    message:
      'Deletion request submitted. This is not immediate deletion; an authorized review will process the request.',
  };
}

async function cancelMyDeletionRequest(requester, { ipAddress } = {}) {
  assertDeletionAvailable(requester.roles);

  const active = await repo.findActiveByUserId(requester.userId);
  if (!active) {
    throw new ApiError(
      404,
      'No active deletion request found',
      null,
      'DELETION_REQUEST_NOT_FOUND'
    );
  }
  if (active.status !== 'pending') {
    throw new ApiError(
      409,
      'Only pending deletion requests can be cancelled',
      { status: active.status },
      'DELETION_REQUEST_CANNOT_CANCEL'
    );
  }

  const cancelled = await repo.cancelRequest(active.id);

  await recordAudit({
    userId: requester.userId,
    universityId: requester.universityId ?? null,
    actionType: 'ACCOUNT_DELETION_CANCELLED',
    entityType: 'account_deletion_request',
    entityId: cancelled.id,
    oldValues: { status: 'pending' },
    newValues: { status: 'cancelled' },
    ipAddress: ipAddress ?? null,
  });

  return { request: toPublicRequest(cancelled) };
}

async function listDeletionRequestsForAdmin(requester, query = {}) {
  if (!requester.isGlobal && !(requester.roles || []).includes('super_admin')) {
    throw new ApiError(403, 'Forbidden', null, 'FORBIDDEN');
  }
  const rows = await repo.listRequests({
    status: query.status,
    take: query.take ? Number(query.take) : 50,
    skip: query.skip ? Number(query.skip) : 0,
  });
  return { items: rows.map(toAdminRequest) };
}

/**
 * Super-admin processing:
 * - processing: mark under review (no anonymization yet)
 * - rejected: close request; user remains active
 * - completed: anonymize identity + deactivate; retain academic records
 */
async function processDeletionRequest(requester, requestId, body, { ipAddress } = {}) {
  if (!requester.isGlobal && !(requester.roles || []).includes('super_admin')) {
    throw new ApiError(403, 'Forbidden', null, 'FORBIDDEN');
  }
  if (body.confirmation !== 'DELETE') {
    throw new ApiError(
      400,
      'Confirmation phrase DELETE is required',
      null,
      'CONFIRMATION_REQUIRED'
    );
  }

  const existing = await repo.findById(requestId);
  if (!existing) {
    throw new ApiError(
      404,
      'Deletion request not found',
      null,
      'DELETION_REQUEST_NOT_FOUND'
    );
  }
  if (!['pending', 'processing'].includes(existing.status)) {
    throw new ApiError(
      409,
      'Request is no longer processable',
      { status: existing.status },
      'DELETION_REQUEST_CANNOT_CANCEL'
    );
  }

  if (body.status === 'processing') {
    const updated = await repo.updateRequestStatus(requestId, {
      status: 'processing',
      processedById: requester.userId,
      resolutionNote: body.resolution_note ?? null,
    });
    await recordAudit({
      userId: requester.userId,
      universityId: null,
      actionType: 'ACCOUNT_DELETION_PROCESSING',
      entityType: 'account_deletion_request',
      entityId: requestId,
      oldValues: { status: existing.status },
      newValues: { status: 'processing' },
      ipAddress: ipAddress ?? null,
    });
    return { request: toAdminRequest(updated) };
  }

  if (body.status === 'rejected') {
    const updated = await repo.updateRequestStatus(requestId, {
      status: 'rejected',
      processedById: requester.userId,
      resolutionNote: body.resolution_note ?? null,
    });
    await recordAudit({
      userId: requester.userId,
      universityId: null,
      actionType: 'ACCOUNT_DELETION_REJECTED',
      entityType: 'account_deletion_request',
      entityId: requestId,
      oldValues: { status: existing.status },
      newValues: { status: 'rejected' },
      ipAddress: ipAddress ?? null,
    });
    return { request: toAdminRequest(updated) };
  }

  // completed — anonymize identity; do not cascade-delete academic rows
  const result = await prisma.$transaction(async (tx) => {
    await repo.anonymizeUserIdentity(existing.user_id, tx);
    await repo.deleteUserOtps(existing.user_id, tx);
    await repo.disablePushRegistrations(existing.user_id, tx);
    return tx.account_deletion_requests.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        processed_at: new Date(),
        processed_by_id: requester.userId,
        resolution_note: body.resolution_note ?? null,
        updated_at: new Date(),
      },
    });
  });

  await recordAudit({
    userId: requester.userId,
    universityId: null,
    actionType: 'ACCOUNT_DELETION_COMPLETED',
    entityType: 'account_deletion_request',
    entityId: requestId,
    oldValues: { status: existing.status, target_user_id: existing.user_id },
    newValues: {
      status: 'completed',
      anonymized: true,
      academic_records_retained: true,
    },
    ipAddress: ipAddress ?? null,
  });

  return { request: toAdminRequest(result) };
}

module.exports = {
  SUPPORTED_ROLES,
  assertDeletionAvailable,
  toPublicRequest,
  getMyDeletionRequest,
  createMyDeletionRequest,
  cancelMyDeletionRequest,
  listDeletionRequestsForAdmin,
  processDeletionRequest,
};
