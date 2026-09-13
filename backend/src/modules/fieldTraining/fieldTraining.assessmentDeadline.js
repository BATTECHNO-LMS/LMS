'use strict';

/**
 * Authoritative PRE/POST closing deadline for Field Training assessments.
 * Server/database time is the only clock that can close an assessment.
 */

const { ApiError } = require('../../utils/apiError');

const TIMEZONE = 'Asia/Amman';
const TIMEZONE_OFFSET = '+03:00';
const ERROR_CODE = 'ASSESSMENT_CLOSED';
const MSG_CLOSED = 'انتهى موعد تقديم الامتحان ولم يعد بالإمكان إرسال الإجابات.';
const MSG_EXPIRED = 'انتهى موعد تقديم الامتحان.';
const MSG_REQUIRED = 'يرجى تحديد موعد إغلاق الامتحان قبل النشر.';
const MSG_FUTURE = 'يجب أن يكون موعد إغلاق الامتحان في وقت لاحق عند النشر.';
const MSG_INVALID = 'موعد إغلاق الامتحان غير صالح.';
const DATETIME_LOCAL_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?$/;
const HAS_TZ_RE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

function serverNow(now) {
  return now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
}

function parseClosesAt(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const raw = String(value).trim();
  if (!raw) return null;

  const local = DATETIME_LOCAL_RE.exec(raw);
  if (local && !HAS_TZ_RE.test(raw)) {
    const iso = `${local[1]}T${local[2]}:${local[3] || '00'}${TIMEZONE_OFFSET}`;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveClosesAt(assessment, settings = null) {
  const fromColumn = parseClosesAt(assessment?.closes_at ?? assessment?.closesAt);
  if (fromColumn) return fromColumn;
  return parseClosesAt(settings?.closes_at ?? settings?.closesAt ?? null);
}

function resolveOpensAt(settings = null) {
  return parseClosesAt(settings?.opens_at ?? settings?.opensAt ?? null);
}

function isClosedAt(closesAt, now = new Date()) {
  if (!closesAt) return false;
  return serverNow(now).getTime() >= closesAt.getTime();
}

function isAssessmentClosed(assessment, { now = new Date(), settings = null } = {}) {
  const persisted = assessment?.status;
  if (persisted === 'closed') return true;
  return isClosedAt(resolveClosesAt(assessment, settings), now);
}

function isAssessmentOpen(assessment, { now = new Date(), settings = null } = {}) {
  if (assessment?.status !== 'published') return false;
  if (isAssessmentClosed(assessment, { now, settings })) return false;
  const opensAt = resolveOpensAt(settings);
  if (opensAt && serverNow(now).getTime() < opensAt.getTime()) return false;
  return true;
}

function deriveDisplayStatus(assessment, { now = new Date(), settings = null } = {}) {
  const persisted = assessment?.status || 'draft';
  if (persisted === 'draft') return 'draft';
  if (persisted === 'closed') return 'closed';
  if (persisted === 'published' && isAssessmentClosed(assessment, { now, settings })) {
    return 'closed';
  }
  return persisted;
}

function describeAvailability(assessment, { now = new Date(), settings = null } = {}) {
  const closesAt = resolveClosesAt(assessment, settings);
  const opensAt = resolveOpensAt(settings);
  const closed = isAssessmentClosed(assessment, { now, settings });
  const open = isAssessmentOpen(assessment, { now, settings });
  return {
    timezone: TIMEZONE,
    closes_at: closesAt ? closesAt.toISOString() : null,
    closesAt: closesAt ? closesAt.toISOString() : null,
    opens_at: opensAt ? opensAt.toISOString() : null,
    opensAt: opensAt ? opensAt.toISOString() : null,
    is_open: open,
    isOpen: open,
    is_closed: closed,
    isClosed: closed,
    display_status: deriveDisplayStatus(assessment, { now, settings }),
  };
}

function closedError() {
  return new ApiError(403, MSG_CLOSED, null, ERROR_CODE);
}

function assertNotClosed(assessment, { now = new Date(), settings = null } = {}) {
  if (isAssessmentClosed(assessment, { now, settings })) {
    throw closedError();
  }
}

function assertStudentWindow(assessment, { now = new Date(), settings = null } = {}) {
  const clock = serverNow(now);
  const opensAt = resolveOpensAt(settings);
  if (opensAt && clock.getTime() < opensAt.getTime()) {
    throw new ApiError(403, 'التقييم لم يبدأ بعد', null, 'ASSESSMENT_NOT_STARTED');
  }
  assertNotClosed(assessment, { now: clock, settings });
}

function assertPublishDeadline(closesAt, { now = new Date(), isInitialPublish = true } = {}) {
  if (!closesAt) {
    throw new ApiError(400, MSG_REQUIRED, null, 'ASSESSMENT_DEADLINE_REQUIRED');
  }
  if (isInitialPublish && isClosedAt(closesAt, now)) {
    throw new ApiError(400, MSG_FUTURE, null, 'ASSESSMENT_DEADLINE_NOT_FUTURE');
  }
}

function parseClosesAtOrThrow(value, { allowEmpty = true } = {}) {
  if (value === undefined) return undefined;
  if (value == null || value === '') {
    if (allowEmpty) return null;
    throw new ApiError(400, MSG_REQUIRED, null, 'ASSESSMENT_DEADLINE_REQUIRED');
  }
  const parsed = parseClosesAt(value);
  if (!parsed) {
    throw new ApiError(400, MSG_INVALID, null, 'ASSESSMENT_DEADLINE_INVALID');
  }
  return parsed;
}

module.exports = {
  TIMEZONE,
  TIMEZONE_OFFSET,
  ERROR_CODE,
  MSG_CLOSED,
  MSG_EXPIRED,
  MSG_REQUIRED,
  MSG_FUTURE,
  MSG_INVALID,
  serverNow,
  parseClosesAt,
  parseClosesAtOrThrow,
  resolveClosesAt,
  resolveOpensAt,
  isClosedAt,
  isAssessmentClosed,
  isAssessmentOpen,
  deriveDisplayStatus,
  describeAvailability,
  closedError,
  assertNotClosed,
  assertStudentWindow,
  assertPublishDeadline,
};
