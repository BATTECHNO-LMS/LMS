/**
 * Dynamic QR attendance challenges for Field Training sessions.
 *
 * Security model:
 * - QR payload is a short-lived HMAC challenge (NOT a JWT / session token).
 * - Challenge is bound to attendance window + session + time slot.
 * - Rotation is compute-only (no DB write per tick).
 * - Student identity always comes from authenticated session.
 * - Confirmation writes PRESENT via the same attendance upsert path as electronic codes.
 */

const crypto = require('crypto');
const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { prisma } = require('../../config/db');
const { recordAudit } = require('../../utils/auditRecorder');
const { assertManageOpportunityAccess } = require('./fieldTraining.access');
const workflow = require('./fieldTraining.workflow');
const repo = require('./fieldTraining.repository');
const attendanceWindow = require('./fieldTraining.attendanceWindow.service');
const { emitDomainEvent } = require('../notificationEngine/notificationDispatcher.service');

const MAX_FAILED_ATTEMPTS = 5;

function rotationSeconds() {
  return Number(env.ATTENDANCE_QR_ROTATION_SECONDS) || 45;
}

function qrPepper() {
  return String(env.JWT_SECRET || env.SESSION_SECRET || 'battechno-ft-qr');
}

function currentSlot(nowMs = Date.now()) {
  return Math.floor(nowMs / (rotationSeconds() * 1000));
}

function hmacChallenge(windowId, sessionId, slot) {
  return crypto
    .createHmac('sha256', qrPepper())
    .update(`ft-qr-v1|${windowId}|${sessionId}|${slot}`)
    .digest('base64url');
}

function timingSafeEqualStr(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function encodeQrPayload({ windowId, sessionId, slot, challenge }) {
  // Compact opaque reference only — no JWT, no student id, no auth secret.
  return Buffer.from(
    JSON.stringify({
      v: 1,
      w: windowId,
      s: sessionId,
      k: slot,
      c: challenge,
    }),
    'utf8'
  ).toString('base64url');
}

function decodeQrPayload(raw) {
  try {
    const text = Buffer.from(String(raw || ''), 'base64url').toString('utf8');
    const parsed = JSON.parse(text);
    if (!parsed || parsed.v !== 1 || !parsed.w || !parsed.s || parsed.k == null || !parsed.c) {
      return null;
    }
    return {
      windowId: String(parsed.w),
      sessionId: String(parsed.s),
      slot: Number(parsed.k),
      challenge: String(parsed.c),
    };
  } catch {
    return null;
  }
}

function buildQrChallengeForWindow(windowRow, nowMs = Date.now()) {
  const slot = currentSlot(nowMs);
  const challenge = hmacChallenge(windowRow.id, windowRow.session_id, slot);
  const slotStart = slot * rotationSeconds() * 1000;
  const expiresAt = new Date(slotStart + rotationSeconds() * 1000);
  const remaining = Math.max(0, Math.floor((expiresAt.getTime() - nowMs) / 1000));
  const token = encodeQrPayload({
    windowId: windowRow.id,
    sessionId: windowRow.session_id,
    slot,
    challenge,
  });
  return {
    token,
    rotation_version: slot,
    rotation_seconds: rotationSeconds(),
    challenge_expires_at: expiresAt.toISOString(),
    remaining_seconds: remaining,
    // Safe scan URL path — auth tokens never embedded.
    scan_path: `/student/field-training/attendance/qr?t=${encodeURIComponent(token)}`,
  };
}

function verifyChallengeAgainstWindow(payload, windowRow, nowMs = Date.now()) {
  if (!payload || !windowRow) return { ok: false, reason: 'invalid_payload' };
  if (payload.windowId !== windowRow.id) return { ok: false, reason: 'wrong_window' };
  if (payload.sessionId !== windowRow.session_id) return { ok: false, reason: 'wrong_session' };

  const slotNow = currentSlot(nowMs);
  // Accept current and previous slot only (grace across rotation edge).
  const allowedSlots = [slotNow, slotNow - 1];
  if (!allowedSlots.includes(payload.slot)) {
    return { ok: false, reason: 'expired_challenge' };
  }

  for (const slot of allowedSlots) {
    if (payload.slot !== slot) continue;
    const expected = hmacChallenge(windowRow.id, windowRow.session_id, slot);
    if (timingSafeEqualStr(expected, payload.challenge)) {
      return { ok: true, slot };
    }
  }
  return { ok: false, reason: 'invalid_challenge' };
}

async function getLiveQrForSession(sessionId, user) {
  const session = await repo.findSessionById(sessionId);
  if (!session) throw new ApiError(404, 'Session not found');
  const opp = session.field_training_opportunities;
  await assertManageOpportunityAccess(user, opp);

  let windowRow = await attendanceWindow.getOpenWindowForSession(sessionId);
  if (windowRow) {
    windowRow = await attendanceWindow.expireWindowIfNeeded(windowRow, { closedById: user.userId });
  }

  if (!windowRow || windowRow.status !== 'open') {
    return {
      open: false,
      session: { id: session.id, title: session.title },
      window: null,
      qr: null,
      roster: [],
      stats: null,
    };
  }

  const qr = buildQrChallengeForWindow(windowRow);
  const live = await getLiveAttendanceRoster(sessionId, windowRow.id);
  return {
    open: true,
    session: { id: session.id, title: session.title },
    window: {
      id: windowRow.id,
      status: windowRow.status,
      opened_at: windowRow.opened_at,
      expires_at: windowRow.expires_at,
      remaining_seconds: Math.max(
        0,
        Math.floor((new Date(windowRow.expires_at).getTime() - Date.now()) / 1000)
      ),
      mode: windowRow.mode,
      duration_seconds: windowRow.duration_seconds,
    },
    qr,
    ...live,
  };
}

async function getLiveAttendanceRoster(sessionId, windowId) {
  const session = await repo.findSessionById(sessionId);
  const apps = await repo.findActiveParticipants(session.opportunity_id);
  const attendance = await prisma.field_training_attendance.findMany({
    where: { session_id: sessionId },
  });
  const byApp = new Map(attendance.map((r) => [r.application_id, r]));

  const studentIds = apps.map((a) => a.student_id);
  const users =
    studentIds.length > 0
      ? await prisma.users.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, full_name: true, email: true },
        })
      : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  const methodLabel = (method) => {
    if (method === 'qr') return 'QR';
    if (method === 'electronic') return 'ELECTRONIC';
    if (method === 'manual' || method === 'bulk_manual') return 'MANUAL';
    if (method === 'auto_finalize') return 'AUTO';
    return method || '-';
  };

  // Recorded-lecture completion uses electronic/manual paths historically;
  // surface note heuristic for staff roster display when available.
  const roster = apps.map((app) => {
    const row = byApp.get(app.id);
    const u = userById.get(app.student_id);
    let source = row ? methodLabel(row.method) : '-';
    if (row?.note && /recorded.?lecture|محاضرة مسجلة/i.test(String(row.note))) {
      source = 'RECORDED_LECTURE';
    }
    return {
      application_id: app.id,
      student_id: app.student_id,
      student_name: u?.full_name || u?.email || app.student_id,
      status: row?.status || 'unmarked',
      confirmation_source: source,
      confirmed_at: row?.confirmed_at || null,
      method: row?.method || null,
    };
  });

  const present = roster.filter((r) => ['present', 'late', 'excused'].includes(r.status));
  return {
    roster,
    stats: {
      eligible_count: roster.length,
      present_count: present.length,
      remaining_count: Math.max(0, roster.length - present.length),
      recently_confirmed: present
        .filter((r) => r.confirmed_at)
        .sort((a, b) => new Date(b.confirmed_at) - new Date(a.confirmed_at))
        .slice(0, 8),
      window_id: windowId,
    },
  };
}

async function confirmAttendanceWithQr(body, user, reqMeta = {}) {
  const studentId = user.userId;
  const token = body.token || body.qr_token || body.t;
  const payload = decodeQrPayload(token);
  if (!payload) {
    throw new ApiError(400, 'رمز QR غير صالح', null, 'ATTENDANCE_QR_INVALID');
  }

  // Never trust student identity from QR — only from session.
  if (body.studentId || body.student_id || body.userId || body.applicationId) {
    // Ignore client-supplied identity fields entirely (anti-mass-assignment).
  }

  let windowRow = await prisma.field_training_attendance_windows.findUnique({
    where: { id: payload.windowId },
    include: {
      field_training_sessions: {
        include: {
          field_training_opportunities: {
            select: { id: true, title: true, university_id: true, assigned_instructor_id: true },
          },
        },
      },
    },
  });
  if (!windowRow) {
    throw new ApiError(404, 'نافذة الحضور غير موجودة', null, 'ATTENDANCE_WINDOW_NOT_FOUND');
  }

  // Session binding: reject if URL/session tampered.
  if (payload.sessionId !== windowRow.session_id) {
    throw new ApiError(403, 'رمز الحضور لا يطابق هذه الجلسة', null, 'ATTENDANCE_QR_SESSION_MISMATCH');
  }
  if (body.sessionId && body.sessionId !== windowRow.session_id) {
    throw new ApiError(403, 'رمز الحضور لا يطابق هذه الجلسة', null, 'ATTENDANCE_QR_SESSION_MISMATCH');
  }

  if (windowRow.status !== 'open') {
    throw new ApiError(
      400,
      'انتهت صلاحية رمز الحضور. امسح الرمز الحالي المعروض لدى المشرف.',
      null,
      'ATTENDANCE_WINDOW_CLOSED'
    );
  }
  if (windowRow.expires_at && new Date(windowRow.expires_at).getTime() <= Date.now()) {
    throw new ApiError(
      400,
      'انتهت صلاحية رمز الحضور. امسح الرمز الحالي المعروض لدى المشرف.',
      null,
      'ATTENDANCE_WINDOW_EXPIRED'
    );
  }

  const verified = verifyChallengeAgainstWindow(payload, windowRow);
  if (!verified.ok) {
    const msg =
      verified.reason === 'expired_challenge'
        ? 'انتهت صلاحية رمز الحضور. امسح الرمز الحالي المعروض لدى المشرف.'
        : 'رمز الحضور غير صالح أو منتهي. امسح الرمز الحالي المعروض لدى المشرف.';
    throw new ApiError(400, msg, null, 'ATTENDANCE_QR_EXPIRED');
  }

  const session = windowRow.field_training_sessions;
  const app = await repo.findApplicationByOpportunityAndStudent(session.opportunity_id, studentId);
  if (!app || app.status !== 'approved' || app.expelled_at || app.training_status === 'expelled') {
    throw new ApiError(403, 'غير مصرح لك بتسجيل الحضور لهذه الجلسة', null, 'ATTENDANCE_QR_UNAUTHORIZED');
  }
  if (!workflow.canAccessTrainingContent(app)) {
    throw new ApiError(403, 'التدريب غير نشط بعد', null, 'ATTENDANCE_QR_UNAUTHORIZED');
  }

  const attempt = await prisma.field_training_attendance_window_attempts.upsert({
    where: {
      window_id_student_id: { window_id: windowRow.id, student_id: studentId },
    },
    create: { window_id: windowRow.id, student_id: studentId, attempt_count: 0 },
    update: {},
  });
  if (attempt.attempt_count >= MAX_FAILED_ATTEMPTS) {
    throw new ApiError(429, 'تجاوزت عدد محاولات الحضور المسموح', null, 'ATTENDANCE_QR_ATTEMPTS_EXCEEDED');
  }

  const existing = await prisma.field_training_attendance.findUnique({
    where: {
      session_id_application_id: {
        session_id: session.id,
        application_id: app.id,
      },
    },
  });

  // Idempotent: already PRESENT/late/excused → success no-op (no duplicate audit/notify).
  if (existing && ['present', 'late', 'excused'].includes(existing.status)) {
    return {
      ok: true,
      idempotent: true,
      message: 'تم تسجيل حضورك بنجاح',
      attendance: repo.mapAttendanceRow(existing),
      session: { id: session.id, title: session.title },
      status: existing.status === 'late' ? 'متأخر' : 'حاضر',
      confirmed_at: existing.confirmed_at,
    };
  }

  const status = windowRow.mode === 'late' ? 'late' : 'present';
  const now = new Date();
  const row = await prisma.field_training_attendance.upsert({
    where: {
      session_id_application_id: {
        session_id: session.id,
        application_id: app.id,
      },
    },
    create: {
      session_id: session.id,
      application_id: app.id,
      student_id: studentId,
      status,
      method: 'qr',
      confirmed_at: now,
      attendance_window_id: windowRow.id,
      recorded_by_id: studentId,
      recorded_at: now,
      ip_address: reqMeta.ipAddress || null,
      device_info: reqMeta.deviceInfo || null,
      note: 'QR attendance',
    },
    update: {
      status,
      method: 'qr',
      confirmed_at: now,
      attendance_window_id: windowRow.id,
      recorded_by_id: studentId,
      recorded_at: now,
      updated_at: now,
      manual_reason: null,
      ip_address: reqMeta.ipAddress || null,
      device_info: reqMeta.deviceInfo || null,
      note: 'QR attendance',
    },
  });

  await workflow.refreshAttendancePercentage(app.id);

  await recordAudit({
    userId: studentId,
    actionType: 'FIELD_TRAINING_QR_ATTENDANCE_CONFIRMED',
    entityType: 'field_training_attendance',
    entityId: row.id,
    newValues: {
      status,
      method: 'qr',
      source: 'QR',
      session_id: session.id,
      opportunity_id: session.opportunity_id,
      window_id: windowRow.id,
      rotation_version: verified.slot,
      // never persist raw challenge secret
    },
    ipAddress: reqMeta.ipAddress || null,
  });

  setImmediate(() => {
    emitDomainEvent('ATTENDANCE_CONFIRMED', {
      sessionId: session.id,
      opportunityId: session.opportunity_id,
      universityId: session.field_training_opportunities?.university_id || null,
      actorUserId: studentId,
      applicationId: app.id,
      entityType: 'field_training_attendance',
      entityId: row.id,
      templateVars: {
        session_title: session.title || '',
        action_url: `/student/field-training/${session.opportunity_id}`,
      },
    }).catch(() => null);
  });

  return {
    ok: true,
    idempotent: false,
    message: 'تم تسجيل حضورك بنجاح',
    attendance: repo.mapAttendanceRow(row),
    session: { id: session.id, title: session.title },
    status: status === 'late' ? 'متأخر' : 'حاضر',
    confirmed_at: row.confirmed_at,
  };
}

module.exports = {
  rotationSeconds,
  buildQrChallengeForWindow,
  encodeQrPayload,
  decodeQrPayload,
  verifyChallengeAgainstWindow,
  hmacChallenge,
  currentSlot,
  getLiveQrForSession,
  confirmAttendanceWithQr,
  getLiveAttendanceRoster,
};
