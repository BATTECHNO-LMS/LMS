'use strict';

const { ApiError } = require('../../utils/apiError');

const LOGBOOK_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REVISION_REQUESTED'],
  REVISION_REQUESTED: ['SUBMITTED'],
  APPROVED: [],
});

function assertTransition(from, to) {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new ApiError(
      400,
      `انتقال حالة سجل التدريب غير مسموح: ${from} → ${to}`,
      { from, to },
      'FIELD_TRAINING_LOGBOOK_INVALID_TRANSITION'
    );
  }
}

function canStudentEdit(status) {
  return status === LOGBOOK_STATUS.DRAFT || status === LOGBOOK_STATUS.REVISION_REQUESTED;
}

function canStudentDelete(status) {
  return status === LOGBOOK_STATUS.DRAFT;
}

function isReadOnlyAfterFinalize(trainingStatus) {
  return trainingStatus === 'completed' || trainingStatus === 'expelled';
}

module.exports = {
  LOGBOOK_STATUS,
  ALLOWED_TRANSITIONS,
  assertTransition,
  canStudentEdit,
  canStudentDelete,
  isReadOnlyAfterFinalize,
};
