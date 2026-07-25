const crypto = require('crypto');
const { ApiError } = require('../../utils/apiError');
const { env } = require('../../config/env');
const { prisma } = require('../../config/db');
const { recordAudit } = require('../../utils/auditRecorder');
const { assertManageOpportunityAccess } = require('./fieldTraining.access');
const workflow = require('./fieldTraining.workflow');
const repo = require('./fieldTraining.repository');
const ftNotify = require('./fieldTraining.notifications');

const ALLOWED_DURATIONS = Object.freeze([60, 120, 180, 300]);
const MAX_FAILED_ATTEMPTS = 5;
const CODE_LENGTH = 6;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function hashAttendanceCode(code) {
  const pepper = String(env.JWT_SECRET || env.SESSION_SECRET || 'battechno-ft-attendance');
  return crypto.createHash('sha256').update(`${pepper}:${String(code || '').trim().toUpperCase()}`).digest('hex');
}

function generateAttendanceCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function timingSafeEqualHash(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function mapWindowPublic(row, { includeCode = false, code = null, stats = null } = {}) {
  const now = Date.now();
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : null;
  const remaining = expiresAt != null ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : null;
  const base = {
    id: row.id,
    session_id: row.session_id,
    status: row.status,
    mode: row.mode,
    opened_at: row.opened_at,
    expires_at: row.expires_at,
    closed_at: row.closed_at,
    opened_by_id: row.opened_by_id,
    duration_seconds: row.duration_seconds,
    notes: row.notes ?? null,
    remaining_seconds: remaining,
    server_now: new Date().toISOString(),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (includeCode && code) base.code = code;
  if (stats) Object.assign(base, stats);
  return base;
}

async function getOpenWindowForSession(sessionId) {
  return prisma.field_training_attendance_windows.findFirst({
    where: { session_id: sessionId, status: 'open' },
  });
}

async function expireWindowIfNeeded(windowRow, { closedById = null } = {}) {
  if (!windowRow || windowRow.status !== 'open') return windowRow;
  if (windowRow.expires_at && new Date(windowRow.expires_at).getTime() > Date.now()) {
    return windowRow;
  }
  return closeAttendanceWindowInternal(windowRow, {
    closedById,
    reason: 'expired',
  });
}

async function buildWindowStats(sessionId, windowId) {
  const apps = await repo.findActiveParticipants(
    (await repo.findSessionById(sessionId))?.opportunity_id
  );
  const eligible = apps.length;
  const attendance = await prisma.field_training_attendance.findMany({
    where: { session_id: sessionId },
    select: { status: true, method: true, attendance_window_id: true },
  });
  const presentLike = attendance.filter((a) => ['present', 'late', 'excused'].includes(a.status)).length;
  const unconfirmed = attendance.filter((a) => a.status === 'unconfirmed').length;
  const electronic = attendance.filter((a) => a.method === 'electronic').length;
  return {
    eligible_count: eligible,
    confirmed_count: presentLike,
    unconfirmed_count: unconfirmed,
    electronic_count: electronic,
    remaining_unmarked: Math.max(0, eligible - attendance.length),
    window_id: windowId,
  };
}

async function closeAttendanceWindowInternal(windowRow, { closedById = null, reason = 'closed' } = {}) {
  const session = await repo.findSessionById(windowRow.session_id);
  if (!session) throw new ApiError(404, 'Session not found');

  const apps = await repo.findActiveParticipants(session.opportunity_id);
  const existing = await prisma.field_training_attendance.findMany({
    where: { session_id: windowRow.session_id },
    select: { application_id: true, status: true },
  });
  const existingByApp = new Map(existing.map((r) => [r.application_id, r]));
  const finalizedStatuses = new Set(['present', 'late', 'excused', 'absent']);

  const now = new Date();
  const note =
    reason === 'expired'
      ? 'انتهت نافذة الحضور الإلكتروني دون تأكيد'
      : 'أُغلقت نافذة الحضور دون تأكيد';

  // Bulk ops instead of N upserts inside an interactive transaction.
  // Neon pooler drops long interactive txs ("Transaction not found").
  await prisma.field_training_attendance_windows.update({
    where: { id: windowRow.id },
    data: {
      status: 'closed',
      closed_at: now,
      closed_by_id: closedById,
      updated_at: now,
    },
  });

  const toCreate = [];
  const toUpdateAppIds = [];
  for (const app of apps) {
    const current = existingByApp.get(app.id);
    if (current && finalizedStatuses.has(current.status)) continue;
    if (!current) {
      toCreate.push({
        session_id: windowRow.session_id,
        application_id: app.id,
        student_id: app.student_id,
        status: 'unconfirmed',
        method: 'electronic',
        attendance_window_id: windowRow.id,
        recorded_by_id: closedById,
        recorded_at: now,
        note,
      });
    } else {
      toUpdateAppIds.push(app.id);
    }
  }

  if (toCreate.length) {
    await prisma.field_training_attendance.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }
  if (toUpdateAppIds.length) {
    await prisma.field_training_attendance.updateMany({
      where: {
        session_id: windowRow.session_id,
        application_id: { in: toUpdateAppIds },
        status: { notIn: [...finalizedStatuses] },
      },
      data: {
        status: 'unconfirmed',
        method: 'electronic',
        attendance_window_id: windowRow.id,
        recorded_by_id: closedById,
        recorded_at: now,
        updated_at: now,
        note,
      },
    });
  }

  // Refresh percentages outside the write path; failures must not reopen the window.
  const chunkSize = 25;
  for (let i = 0; i < apps.length; i += chunkSize) {
    const chunk = apps.slice(i, i + chunkSize);
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      chunk.map((app) => workflow.refreshAttendancePercentage(app.id).catch(() => null))
    );
  }

  await recordAudit({
    userId: closedById,
    actionType: 'FIELD_TRAINING_ATTENDANCE_WINDOW_CLOSED',
    entityType: 'field_training_attendance_window',
    entityId: windowRow.id,
    newValues: { reason, session_id: windowRow.session_id, status: 'closed' },
  });

  return prisma.field_training_attendance_windows.findUnique({ where: { id: windowRow.id } });
}

async function openAttendanceWindow(sessionId, body, user) {
  const session = await repo.findSessionById(sessionId);
  if (!session) throw new ApiError(404, 'Session not found');
  const opp = session.field_training_opportunities;
  await assertManageOpportunityAccess(user, opp);

  const duration = Number(body.duration_seconds ?? 120);
  if (!ALLOWED_DURATIONS.includes(duration)) {
    throw new ApiError(400, 'مدة نافذة الحضور غير صالحة');
  }
  const mode = body.mode === 'late' ? 'late' : 'normal';

  let existing = await getOpenWindowForSession(sessionId);
  if (existing) {
    existing = await expireWindowIfNeeded(existing, { closedById: user.userId });
  }
  if (existing && existing.status === 'open') {
    throw new ApiError(409, 'توجد نافذة حضور مفتوحة لهذه الجلسة بالفعل', null, 'ATTENDANCE_WINDOW_OPEN');
  }

  const code = String(body.code || '').trim().toUpperCase() || generateAttendanceCode();
  if (!/^[A-Z0-9]{4,12}$/.test(code)) {
    throw new ApiError(400, 'رمز الحضور يجب أن يكون من 4 إلى 12 حرفًا/رقمًا');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + duration * 1000);
  const windowRow = await prisma.field_training_attendance_windows.create({
    data: {
      session_id: sessionId,
      code_hash: hashAttendanceCode(code),
      status: 'open',
      mode,
      opened_at: now,
      expires_at: expiresAt,
      opened_by_id: user.userId,
      duration_seconds: duration,
      notes: body.notes?.trim() || null,
    },
  });

  const oppFull = await repo.findById(opp.id);
  await ftNotify.notifyStudentsAttendanceWindowOpened({
    opportunityId: opp.id,
    opportunityTitle: oppFull?.title,
    sessionTitle: session.title,
    sessionId,
    windowId: windowRow.id,
    mode,
    expiresAt,
    durationSeconds: duration,
  });

  await recordAudit({
    userId: user.userId,
    actionType: 'FIELD_TRAINING_ATTENDANCE_WINDOW_OPENED',
    entityType: 'field_training_attendance_window',
    entityId: windowRow.id,
    newValues: {
      session_id: sessionId,
      mode,
      duration_seconds: duration,
      expires_at: expiresAt.toISOString(),
      // never log plaintext code
    },
  });

  const stats = await buildWindowStats(sessionId, windowRow.id);
  return {
    window: mapWindowPublic(windowRow, { includeCode: true, code, stats }),
    code, // one-time return for announcer UI
  };
}

async function getSessionAttendanceWindow(sessionId, user) {
  const session = await repo.findSessionById(sessionId);
  if (!session) throw new ApiError(404, 'Session not found');
  await assertManageOpportunityAccess(user, session.field_training_opportunities);

  let windowRow = await getOpenWindowForSession(sessionId);
  if (windowRow) {
    windowRow = await expireWindowIfNeeded(windowRow, { closedById: user.userId });
  }
  if (!windowRow || windowRow.status !== 'open') {
    const latest = await prisma.field_training_attendance_windows.findFirst({
      where: { session_id: sessionId },
      orderBy: { created_at: 'desc' },
    });
    const stats = await buildWindowStats(sessionId, latest?.id || null);
    return { window: latest ? mapWindowPublic(latest, { stats }) : null };
  }

  const stats = await buildWindowStats(sessionId, windowRow.id);
  return { window: mapWindowPublic(windowRow, { stats }) };
}

async function closeAttendanceWindow(sessionId, user) {
  const session = await repo.findSessionById(sessionId);
  if (!session) throw new ApiError(404, 'Session not found');
  await assertManageOpportunityAccess(user, session.field_training_opportunities);

  let windowRow = await getOpenWindowForSession(sessionId);
  if (!windowRow) throw new ApiError(404, 'لا توجد نافذة حضور مفتوحة');
  windowRow = await expireWindowIfNeeded(windowRow, { closedById: user.userId });
  if (windowRow.status !== 'open') {
    const stats = await buildWindowStats(sessionId, windowRow.id);
    return { window: mapWindowPublic(windowRow, { stats }) };
  }

  const closed = await closeAttendanceWindowInternal(windowRow, {
    closedById: user.userId,
    reason: 'manual_close',
  });
  const stats = await buildWindowStats(sessionId, closed.id);
  return { window: mapWindowPublic(closed, { stats }) };
}

async function finalizeUnconfirmedAbsences(sessionId, user) {
  const session = await repo.findSessionById(sessionId);
  if (!session) throw new ApiError(404, 'Session not found');
  await assertManageOpportunityAccess(user, session.field_training_opportunities);

  let open = await getOpenWindowForSession(sessionId);
  if (open) {
    open = await expireWindowIfNeeded(open, { closedById: user.userId });
    if (open.status === 'open') {
      throw new ApiError(400, 'أغلق نافذة الحضور قبل اعتماد الغياب');
    }
  }

  const unconfirmed = await prisma.field_training_attendance.findMany({
    where: { session_id: sessionId, status: 'unconfirmed' },
  });
  if (!unconfirmed.length) {
    return { ok: true, updated: 0 };
  }

  const now = new Date();
  await prisma.field_training_attendance.updateMany({
    where: { session_id: sessionId, status: 'unconfirmed' },
    data: {
      status: 'absent',
      method: 'auto_finalize',
      recorded_by_id: user.userId,
      recorded_at: now,
      updated_at: now,
      manual_reason: 'اعتماد الغياب بعد مراجعة غير المؤكدين',
    },
  });

  const latestWindow = await prisma.field_training_attendance_windows.findFirst({
    where: { session_id: sessionId },
    orderBy: { created_at: 'desc' },
  });
  if (latestWindow && latestWindow.status === 'closed') {
    await prisma.field_training_attendance_windows.update({
      where: { id: latestWindow.id },
      data: { status: 'finalized', updated_at: now },
    });
  }

  const oppFull = await repo.findById(session.opportunity_id);
  await ftNotify.notifyStudentsMarkedAbsent({
    studentIds: unconfirmed.map((r) => r.student_id),
    opportunityId: session.opportunity_id,
    opportunityTitle: oppFull?.title,
    sessionTitle: session.title,
  });

  for (const row of unconfirmed) {
    await workflow.refreshAttendancePercentage(row.application_id);
    await workflow.persistEligibility(row.application_id);
    await recordAudit({
      userId: user.userId,
      actionType: 'FIELD_TRAINING_ATTENDANCE_FINALIZED_ABSENT',
      entityType: 'field_training_attendance',
      entityId: row.id,
      oldValues: { status: 'unconfirmed' },
      newValues: {
        status: 'absent',
        method: 'auto_finalize',
        student_id: row.student_id,
        session_id: sessionId,
      },
    });
  }

  return { ok: true, updated: unconfirmed.length };
}

async function updateStudentAttendanceManual(sessionId, studentId, body, user, reqMeta = {}) {
  const session = await repo.findSessionById(sessionId);
  if (!session) throw new ApiError(404, 'Session not found');
  await assertManageOpportunityAccess(user, session.field_training_opportunities);

  const reason = String(body.manual_reason || body.reason || '').trim();
  if (!reason) {
    throw new ApiError(400, 'سبب التعديل اليدوي مطلوب', null, 'MANUAL_REASON_REQUIRED');
  }
  const status = String(body.status || '').toLowerCase();
  if (!['present', 'absent', 'late', 'excused', 'unconfirmed'].includes(status)) {
    throw new ApiError(400, 'حالة الحضور غير صالحة');
  }

  const app = await repo.findApplicationByOpportunityAndStudent(session.opportunity_id, studentId);
  if (!app || app.status !== 'approved') {
    throw new ApiError(404, 'الطالب غير مشارك في هذه الفرصة');
  }

  const existing = await prisma.field_training_attendance.findUnique({
    where: {
      session_id_application_id: {
        session_id: sessionId,
        application_id: app.id,
      },
    },
  });

  const now = new Date();
  const row = await prisma.field_training_attendance.upsert({
    where: {
      session_id_application_id: {
        session_id: sessionId,
        application_id: app.id,
      },
    },
    create: {
      session_id: sessionId,
      application_id: app.id,
      student_id: studentId,
      status,
      note: body.note ?? null,
      method: 'manual',
      manual_reason: reason,
      recorded_by_id: user.userId,
      recorded_at: now,
      confirmed_at: ['present', 'late', 'excused'].includes(status) ? now : null,
      ip_address: reqMeta.ipAddress || null,
      device_info: reqMeta.deviceInfo || null,
    },
    update: {
      status,
      note: body.note ?? existing?.note ?? null,
      method: 'manual',
      manual_reason: reason,
      recorded_by_id: user.userId,
      recorded_at: now,
      confirmed_at: ['present', 'late', 'excused'].includes(status) ? now : null,
      updated_at: now,
      ip_address: reqMeta.ipAddress || null,
      device_info: reqMeta.deviceInfo || null,
    },
  });

  await workflow.refreshAttendancePercentage(app.id);
  await workflow.persistEligibility(app.id);

  await recordAudit({
    userId: user.userId,
    actionType: 'FIELD_TRAINING_ATTENDANCE_MANUAL_UPDATE',
    entityType: 'field_training_attendance',
    entityId: row.id,
    oldValues: existing
      ? { status: existing.status, method: existing.method, student_id: existing.student_id }
      : null,
    newValues: {
      status,
      method: 'manual',
      manual_reason: reason,
      student_id: studentId,
      session_id: sessionId,
    },
    ipAddress: reqMeta.ipAddress || null,
  });

  return { attendance: repo.mapAttendanceRow(row) };
}

async function listActiveWindowsForStudent(studentId) {
  const apps = await prisma.field_training_applications.findMany({
    where: {
      student_id: studentId,
      status: 'approved',
      expelled_at: null,
      training_status: { not: 'expelled' },
    },
    select: { id: true, opportunity_id: true },
  });
  if (!apps.length) return { windows: [] };

  const opportunityIds = apps.map((a) => a.opportunity_id);
  const openWindows = await prisma.field_training_attendance_windows.findMany({
    where: {
      status: 'open',
      field_training_sessions: { opportunity_id: { in: opportunityIds } },
    },
    include: {
      field_training_sessions: {
        select: {
          id: true,
          title: true,
          opportunity_id: true,
          session_date: true,
          start_time: true,
          end_time: true,
          field_training_opportunities: { select: { id: true, title: true } },
        },
      },
    },
    orderBy: { opened_at: 'asc' },
  });

  const result = [];
  for (const win of openWindows) {
    const refreshed = await expireWindowIfNeeded(win);
    if (!refreshed || refreshed.status !== 'open') continue;

    const app = apps.find((a) => a.opportunity_id === win.field_training_sessions.opportunity_id);
    if (!app) continue;

    const existing = await prisma.field_training_attendance.findUnique({
      where: {
        session_id_application_id: {
          session_id: win.session_id,
          application_id: app.id,
        },
      },
    });
    if (existing && ['present', 'late', 'excused'].includes(existing.status)) {
      continue;
    }

    result.push({
      ...mapWindowPublic(refreshed),
      session: {
        id: win.field_training_sessions.id,
        title: win.field_training_sessions.title,
        session_date: win.field_training_sessions.session_date,
        start_time: win.field_training_sessions.start_time,
        end_time: win.field_training_sessions.end_time,
      },
      opportunity: {
        id: win.field_training_sessions.field_training_opportunities.id,
        title: win.field_training_sessions.field_training_opportunities.title,
      },
      already_confirmed: false,
    });
  }

  return { windows: result };
}

async function confirmAttendanceWithCode(body, user, reqMeta = {}) {
  const studentId = user.userId;
  const windowId = body.windowId || body.window_id;
  const code = String(body.code || '').trim().toUpperCase();
  if (!windowId || !code) {
    throw new ApiError(400, 'رمز الحضور ومعرّف النافذة مطلوبان');
  }

  let windowRow = await prisma.field_training_attendance_windows.findUnique({
    where: { id: windowId },
    include: {
      field_training_sessions: {
        include: {
          field_training_opportunities: { select: { id: true, title: true, assigned_instructor_id: true } },
        },
      },
    },
  });
  if (!windowRow) throw new ApiError(404, 'نافذة الحضور غير موجودة');

  windowRow = await expireWindowIfNeeded(windowRow);
  if (windowRow.status !== 'open') {
    throw new ApiError(400, 'انتهت فترة تسجيل الحضور الإلكتروني. راجع المدرس في حال كنت حاضرًا ولم تتمكن من التسجيل.', null, 'ATTENDANCE_WINDOW_CLOSED');
  }
  if (windowRow.expires_at && new Date(windowRow.expires_at).getTime() <= Date.now()) {
    await expireWindowIfNeeded(windowRow);
    throw new ApiError(400, 'انتهت فترة تسجيل الحضور الإلكتروني. راجع المدرس في حال كنت حاضرًا ولم تتمكن من التسجيل.', null, 'ATTENDANCE_WINDOW_EXPIRED');
  }

  const session = windowRow.field_training_sessions;
  const app = await repo.findApplicationByOpportunityAndStudent(session.opportunity_id, studentId);
  if (!app || app.status !== 'approved' || app.expelled_at || app.training_status === 'expelled') {
    throw new ApiError(403, 'غير مصرح لك بتسجيل الحضور لهذه الجلسة');
  }
  if (!workflow.canAccessTrainingContent(app)) {
    throw new ApiError(403, 'التدريب غير نشط بعد');
  }

  const attempt = await prisma.field_training_attendance_window_attempts.upsert({
    where: {
      window_id_student_id: { window_id: windowId, student_id: studentId },
    },
    create: { window_id: windowId, student_id: studentId, attempt_count: 0 },
    update: {},
  });
  if (attempt.attempt_count >= MAX_FAILED_ATTEMPTS) {
    throw new ApiError(429, 'تجاوزت عدد محاولات إدخال الرمز المسموح', null, 'ATTENDANCE_CODE_ATTEMPTS_EXCEEDED');
  }

  const existing = await prisma.field_training_attendance.findUnique({
    where: {
      session_id_application_id: {
        session_id: session.id,
        application_id: app.id,
      },
    },
  });
  if (existing && ['present', 'late', 'excused'].includes(existing.status)) {
    throw new ApiError(409, 'تم تسجيل حضورك مسبقًا لهذه الجلسة', null, 'ATTENDANCE_ALREADY_RECORDED');
  }

  const ok = timingSafeEqualHash(windowRow.code_hash, hashAttendanceCode(code));
  if (!ok) {
    await prisma.field_training_attendance_window_attempts.update({
      where: { id: attempt.id },
      data: {
        attempt_count: { increment: 1 },
        last_attempt_at: new Date(),
        updated_at: new Date(),
      },
    });
    throw new ApiError(400, 'رمز الحضور غير صحيح. تحقق من الرمز وحاول مرة أخرى.', null, 'ATTENDANCE_CODE_INVALID');
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
      method: 'electronic',
      confirmed_at: now,
      attendance_window_id: windowId,
      recorded_by_id: studentId,
      recorded_at: now,
      ip_address: reqMeta.ipAddress || null,
      device_info: reqMeta.deviceInfo || null,
    },
    update: {
      status,
      method: 'electronic',
      confirmed_at: now,
      attendance_window_id: windowId,
      recorded_by_id: studentId,
      recorded_at: now,
      updated_at: now,
      manual_reason: null,
      ip_address: reqMeta.ipAddress || null,
      device_info: reqMeta.deviceInfo || null,
    },
  });

  await workflow.refreshAttendancePercentage(app.id);

  await recordAudit({
    userId: studentId,
    actionType: 'FIELD_TRAINING_ATTENDANCE_ELECTRONIC_CONFIRM',
    entityType: 'field_training_attendance',
    entityId: row.id,
    newValues: {
      status,
      method: 'electronic',
      session_id: session.id,
      window_id: windowId,
      mode: windowRow.mode,
    },
    ipAddress: reqMeta.ipAddress || null,
  });

  return {
    ok: true,
    message: 'تم تسجيل حضورك بنجاح.',
    attendance: repo.mapAttendanceRow(row),
  };
}

module.exports = {
  ALLOWED_DURATIONS,
  generateAttendanceCode,
  hashAttendanceCode,
  openAttendanceWindow,
  getSessionAttendanceWindow,
  closeAttendanceWindow,
  finalizeUnconfirmedAbsences,
  updateStudentAttendanceManual,
  listActiveWindowsForStudent,
  confirmAttendanceWithCode,
};
