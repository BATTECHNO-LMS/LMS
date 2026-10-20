/**
 * External Training Supervisor Portal — limited scoped access.
 * Missing assignment ⇒ NO ACCESS (never global).
 */

const { ApiError } = require('../../utils/apiError');
const { prisma } = require('../../config/db');
const { recordAudit } = require('../../utils/auditRecorder');
const { assertManageOpportunityAccess } = require('./fieldTraining.access');
const {
  isExternalSupervisorRole,
  listActiveAssignments,
  assertAssignedToApplication,
} = require('./fieldTraining.externalScope');
const repo = require('./fieldTraining.repository');
const workflow = require('./fieldTraining.workflow');
const { validateCompletedHoursReplacement, buildHoursSummary } = require('./fieldTraining.hours');
const evaluationService = require('./fieldTrainingEvaluation.service');
const progressSnapshot = require('./fieldTraining.progressSnapshot.service');
const { emitDomainEvent } = require('../notificationEngine/notificationDispatcher.service');
const { LOGBOOK_STATUS, assertTransition } = require('./fieldTraining.logbook.workflow');
const ftNotify = require('./fieldTraining.notifications');

async function assignExternalSupervisor(body, user) {
  const opportunityId = body.opportunity_id || body.opportunityId;
  const supervisorUserId = body.supervisor_user_id || body.supervisorUserId;
  const applicationId = body.application_id || body.applicationId || null;
  if (!opportunityId || !supervisorUserId) {
    throw new ApiError(400, 'المشرف والفرصة مطلوبان');
  }

  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);

  if (applicationId) {
    const app = await prisma.field_training_applications.findUnique({ where: { id: applicationId } });
    if (!app || app.opportunity_id !== opportunityId) {
      throw new ApiError(400, 'الطالب لا ينتمي لهذه الفرصة');
    }
  }

  const existing = await prisma.field_training_external_supervisor_assignments.findFirst({
    where: {
      supervisor_user_id: supervisorUserId,
      opportunity_id: opportunityId,
      application_id: applicationId,
      is_active: true,
    },
  });
  if (existing) {
    return { assignment: existing, created: false };
  }

  const row = await prisma.field_training_external_supervisor_assignments.create({
    data: {
      supervisor_user_id: supervisorUserId,
      opportunity_id: opportunityId,
      application_id: applicationId,
      organization_label: body.organization_label?.trim() || null,
      is_active: true,
      assigned_by_id: user.userId,
    },
  });

  await recordAudit({
    userId: user.userId,
    actionType: 'EXTERNAL_SUPERVISOR_ASSIGNED',
    entityType: 'field_training_external_supervisor_assignment',
    entityId: row.id,
    newValues: {
      supervisor_user_id: supervisorUserId,
      opportunity_id: opportunityId,
      application_id: applicationId,
    },
  });

  setImmediate(() => {
    emitDomainEvent('EXTERNAL_SUPERVISOR_ASSIGNED', {
      opportunityId,
      actorUserId: user.userId,
      entityType: 'field_training_external_supervisor_assignment',
      entityId: row.id,
      templateVars: {
        action_url: '/external/field-training',
      },
    }).catch(() => null);
  });

  return { assignment: row, created: true };
}

async function revokeAssignment(assignmentId, user) {
  const row = await prisma.field_training_external_supervisor_assignments.findUnique({
    where: { id: assignmentId },
  });
  if (!row) throw new ApiError(404, 'Assignment not found');
  const opp = await repo.findById(row.opportunity_id);
  await assertManageOpportunityAccess(user, opp);

  const updated = await prisma.field_training_external_supervisor_assignments.update({
    where: { id: assignmentId },
    data: { is_active: false, revoked_at: new Date(), updated_at: new Date() },
  });

  await recordAudit({
    userId: user.userId,
    actionType: 'EXTERNAL_SUPERVISOR_UNASSIGNED',
    entityType: 'field_training_external_supervisor_assignment',
    entityId: assignmentId,
    newValues: { revoked: true },
  });

  return { assignment: updated };
}

async function listAdminAssignments(opportunityId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);

  const rows = await prisma.field_training_external_supervisor_assignments.findMany({
    where: { opportunity_id: opportunityId },
    orderBy: { assigned_at: 'desc' },
  });
  const supervisorIds = [...new Set(rows.map((r) => r.supervisor_user_id))];
  const users =
    supervisorIds.length > 0
      ? await prisma.users.findMany({
          where: { id: { in: supervisorIds } },
          select: { id: true, full_name: true, email: true },
        })
      : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return {
    items: rows.map((r) => ({
      ...r,
      supervisor_name: byId.get(r.supervisor_user_id)?.full_name || null,
      supervisor_email: byId.get(r.supervisor_user_id)?.email || null,
    })),
  };
}

async function resolveAssignedApplicationIds(user) {
  const assignments = await listActiveAssignments(user.userId);
  if (!assignments.length) return { applicationIds: [], assignments };

  const explicit = assignments.filter((a) => a.application_id).map((a) => a.application_id);
  const oppWide = assignments.filter((a) => !a.application_id).map((a) => a.opportunity_id);

  let fromOpp = [];
  if (oppWide.length) {
    const apps = await prisma.field_training_applications.findMany({
      where: {
        opportunity_id: { in: oppWide },
        status: 'approved',
        expelled_at: null,
      },
      select: { id: true },
    });
    fromOpp = apps.map((a) => a.id);
  }

  return {
    applicationIds: [...new Set([...explicit, ...fromOpp])],
    assignments,
  };
}

async function getDashboard(user) {
  const { applicationIds } = await resolveAssignedApplicationIds(user);
  if (!applicationIds.length) {
    return {
      students: [],
      summary: {
        assigned_students: 0,
        hours_pending_confirmation: 0,
        evaluations_pending: 0,
        completed_students: 0,
        logbook_awaiting_review: 0,
      },
      empty_message: 'لا يوجد طلاب مسندون إليك حاليًا.',
    };
  }

  const apps = await prisma.field_training_applications.findMany({
    where: { id: { in: applicationIds } },
    include: {
      field_training_opportunities: {
        select: {
          id: true,
          title: true,
          required_training_hours: true,
          start_date: true,
          end_date: true,
        },
      },
    },
  });

  const studentIds = apps.map((a) => a.student_id);
  const [users, ratings, logbookPending] = await Promise.all([
    prisma.users.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, full_name: true, email: true },
    }),
    prisma.field_training_supervisor_ratings.findMany({
      where: { application_id: { in: applicationIds } },
      select: { application_id: true, rated_at: true },
    }),
    prisma.field_training_logbook_entries.count({
      where: {
        application_id: { in: applicationIds },
        deleted_at: null,
        status: { in: ['SUBMITTED', 'RESUBMITTED'] },
      },
    }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const ratedApps = new Set(ratings.map((r) => r.application_id));

  let hoursPending = 0;
  let evaluationsPending = 0;
  let completed = 0;

  const students = apps.map((app) => {
    const opp = app.field_training_opportunities;
    const required = opp.required_training_hours != null ? Number(opp.required_training_hours) : null;
    const completedHours = app.completed_training_hours != null ? Number(app.completed_training_hours) : 0;
    const hoursOk = required == null || completedHours >= required;
    if (!hoursOk) hoursPending += 1;
    const hasEval = ratedApps.has(app.id);
    if (!hasEval) evaluationsPending += 1;
    if (app.training_status === 'completed' || app.completion_eligibility_status === 'eligible') {
      completed += 1;
    }
    const u = userById.get(app.student_id);
    return {
      application_id: app.id,
      student_id: app.student_id,
      student_name: u?.full_name || u?.email || app.student_id,
      opportunity_id: opp.id,
      opportunity_title: opp.title,
      training_period: { start: opp.start_date, end: opp.end_date },
      approved_hours: completedHours,
      required_hours: required,
      hours_awaiting_confirmation: !hoursOk,
      evaluation_status: hasEval ? 'SUBMITTED' : 'PENDING',
      training_status: app.training_status,
      attendance_percentage: app.attendance_percentage != null ? Number(app.attendance_percentage) : null,
    };
  });

  return {
    students,
    summary: {
      assigned_students: students.length,
      hours_pending_confirmation: hoursPending,
      evaluations_pending: evaluationsPending,
      completed_students: completed,
      logbook_awaiting_review: logbookPending,
    },
  };
}

async function getStudentDetail(applicationId, user) {
  const app = await assertAssignedToApplication(user, applicationId);
  const opp = await repo.findById(app.opportunity_id);
  const student = await prisma.users.findUnique({
    where: { id: app.student_id },
    select: { id: true, full_name: true, email: true },
  });

  // Snapshot without staff manage gate — assignment already asserted.
  let snapshot = null;
  try {
    snapshot = await progressSnapshot.getFieldTrainingStudentProgressSnapshot(applicationId, null);
  } catch {
    snapshot = null;
  }

  const [logbook, ratings, attendanceAgg] = await Promise.all([
    prisma.field_training_logbook_entries.findMany({
      where: { application_id: applicationId, deleted_at: null },
      orderBy: { entry_date: 'desc' },
      take: 20,
      select: {
        id: true,
        entry_date: true,
        title: true,
        status: true,
        hours_spent: true,
        reviewed_at: true,
      },
    }),
    prisma.field_training_supervisor_ratings.findMany({
      where: { application_id: applicationId },
      orderBy: { rated_at: 'desc' },
      take: 5,
    }),
    prisma.field_training_attendance.groupBy({
      by: ['status'],
      where: {
        application_id: applicationId,
        field_training_sessions: { opportunity_id: app.opportunity_id },
      },
      _count: { _all: true },
    }),
  ]);

  return {
    student: {
      id: student?.id,
      name: student?.full_name || student?.email,
      email: student?.email,
    },
    opportunity: {
      id: opp.id,
      title: opp.title,
      required_training_hours: opp.required_training_hours,
      start_date: opp.start_date,
      end_date: opp.end_date,
    },
    application: {
      id: app.id,
      completed_training_hours: app.completed_training_hours,
      attendance_percentage: app.attendance_percentage,
      training_status: app.training_status,
      completion_eligibility_status: app.completion_eligibility_status,
    },
    hours: buildHoursSummary(app, opp),
    logbook,
    evaluations: ratings,
    attendance_summary: attendanceAgg.map((r) => ({
      status: r.status,
      count: r._count._all,
    })),
    readiness: snapshot?.readiness || null,
    journey: snapshot?.journey || null,
  };
}

async function confirmHours(applicationId, body, user) {
  const app = await assertAssignedToApplication(user, applicationId);
  const opp = await repo.findById(app.opportunity_id);
  if (workflow.isExpelled(app)) {
    throw new ApiError(409, 'لا يمكن تحديث ساعات طالب مستبعد');
  }

  const previous = app.completed_training_hours != null ? Number(app.completed_training_hours) : 0;
  if (body.expected_completed_hours !== undefined) {
    const expected = Number(body.expected_completed_hours) || 0;
    if (previous !== expected) {
      throw new ApiError(409, 'تم تحديث الساعات من مستخدم آخر. حدّث الصفحة وحاول مجدداً.', {
        current_completed_hours: previous,
      });
    }
  }

  const validated = validateCompletedHoursReplacement(
    body.completed_hours,
    opp.required_training_hours
  );
  if (!validated.ok) {
    throw new ApiError(validated.status, validated.message, null, validated.code);
  }

  const now = new Date();
  const updated = await prisma.field_training_applications.update({
    where: { id: applicationId },
    data: {
      completed_training_hours: validated.value,
      hours_updated_at: now,
      hours_updated_by_id: user.userId,
      updated_at: now,
    },
  });

  await recordAudit({
    userId: user.userId,
    actionType: 'TRAINING_HOURS_CONFIRMED',
    entityType: 'field_training_application',
    entityId: applicationId,
    oldValues: { completed_training_hours: previous },
    newValues: {
      completed_training_hours: validated.value,
      source: 'EXTERNAL_SUPERVISOR',
      note: body.note?.trim() || null,
    },
  });

  const eligibility = await workflow.persistEligibility(applicationId);

  setImmediate(() => {
    emitDomainEvent('HOURS_CONFIRMED', {
      opportunityId: opp.id,
      applicationId,
      actorUserId: user.userId,
      entityType: 'field_training_application',
      entityId: applicationId,
      templateVars: {
        action_url: `/student/field-training/${opp.id}`,
      },
    }).catch(() => null);
  });

  return {
    hours: buildHoursSummary(updated, opp),
    previous_completed_hours: previous,
    eligibility,
  };
}

async function requestHoursCorrection(applicationId, body, user) {
  await assertAssignedToApplication(user, applicationId);
  const note = String(body.note || body.reason || '').trim();
  if (!note) throw new ApiError(400, 'سبب طلب التصحيح مطلوب');

  await recordAudit({
    userId: user.userId,
    actionType: 'TRAINING_HOURS_CORRECTION_REQUESTED',
    entityType: 'field_training_application',
    entityId: applicationId,
    newValues: { note, source: 'EXTERNAL_SUPERVISOR' },
  });

  setImmediate(() => {
    emitDomainEvent('HOURS_CONFIRMATION_REQUIRED', {
      applicationId,
      actorUserId: user.userId,
      entityType: 'field_training_application',
      entityId: applicationId,
      templateVars: { note },
    }).catch(() => null);
  });

  return { ok: true, message: 'تم تسجيل طلب تصحيح الساعات' };
}

async function submitEvaluation(applicationId, body, user) {
  await assertAssignedToApplication(user, applicationId);
  // Canonical rating write with external-scope bypass in evaluation service.
  const result = await evaluationService.saveSupervisorRating(
    { ...user, _ftExternalSupervisor: true },
    applicationId,
    { ...body, source: 'SUPERVISOR' }
  );

  await recordAudit({
    userId: user.userId,
    actionType: 'EXTERNAL_SUPERVISOR_EVALUATION_SUBMITTED',
    entityType: 'field_training_supervisor_rating',
    entityId: result?.rating?.id || applicationId,
    newValues: { application_id: applicationId, source: 'EXTERNAL_SUPERVISOR' },
  });

  setImmediate(() => {
    emitDomainEvent('EXTERNAL_EVALUATION_SUBMITTED', {
      applicationId,
      actorUserId: user.userId,
      entityType: 'field_training_supervisor_rating',
      entityId: result?.rating?.id || applicationId,
    }).catch(() => null);
  });

  // Eligibility/readiness recalculation via behavior score change
  try {
    await workflow.persistEligibility(applicationId);
  } catch {
    /* non-fatal */
  }

  return result;
}

async function reviewLogbook(entryId, body, user) {
  const entry = await prisma.field_training_logbook_entries.findFirst({
    where: { id: entryId, deleted_at: null },
  });
  if (!entry) throw new ApiError(404, 'سجل التدريب غير موجود');
  await assertAssignedToApplication(user, entry.application_id);

  const action = String(body.action || '').toUpperCase();
  // External supervisor may request revision. Canonical APPROVE stays university staff.
  if (action === 'REQUEST_REVISION' || action === 'REVISION_REQUESTED') {
    const note = String(body.comment || body.note || '').trim();
    if (!note) throw new ApiError(400, 'سبب طلب التعديل مطلوب');
    assertTransition(entry.status, LOGBOOK_STATUS.REVISION_REQUESTED);
    await prisma.$transaction(async (tx) => {
      await tx.field_training_logbook_entries.update({
        where: { id: entryId },
        data: {
          status: LOGBOOK_STATUS.REVISION_REQUESTED,
          revision_comment: note,
          reviewed_by_id: user.userId,
          reviewed_at: new Date(),
          updated_at: new Date(),
        },
      });
      await tx.field_training_logbook_review_events.create({
        data: {
          entry_id: entryId,
          action: 'REVISION_REQUESTED',
          actor_user_id: user.userId,
          comment: note,
        },
      });
    });
    await recordAudit({
      userId: user.userId,
      actionType: 'LOGBOOK_REVIEWED_BY_EXTERNAL_SUPERVISOR',
      entityType: 'field_training_logbook_entry',
      entityId: entryId,
      newValues: { action: 'REVISION_REQUESTED' },
    });
    await ftNotify.notifyLogbookRevisionRequested({
      studentId: entry.student_id,
      opportunityId: entry.opportunity_id,
      entryId,
      comment: note,
    });
    return { ok: true, status: LOGBOOK_STATUS.REVISION_REQUESTED };
  }

  if (action === 'COMMENT' || action === 'VERIFY') {
    const note =
      String(body.comment || body.note || '').trim() || 'External supervisor verification';
    // Store verification as RESUBMITTED-safe audit trail without inventing COMMENT enum.
    await prisma.field_training_logbook_review_events.create({
      data: {
        entry_id: entryId,
        action: 'SUBMITTED',
        actor_user_id: user.userId,
        comment: `[EXTERNAL_VERIFY] ${note}`,
      },
    });
    await recordAudit({
      userId: user.userId,
      actionType: 'LOGBOOK_REVIEWED_BY_EXTERNAL_SUPERVISOR',
      entityType: 'field_training_logbook_entry',
      entityId: entryId,
      newValues: { action: 'VERIFY_COMMENT' },
    });
    return { ok: true };
  }

  throw new ApiError(
    400,
    'مشرف جهة التدريب يمكنه طلب تعديل أو إضافة تعليق تحقق. الاعتماد النهائي للجامعة.'
  );
}

module.exports = {
  isExternalSupervisorRole,
  listActiveAssignments,
  assertAssignedToApplication,
  assignExternalSupervisor,
  revokeAssignment,
  listAdminAssignments,
  resolveAssignedApplicationIds,
  getDashboard,
  getStudentDetail,
  confirmHours,
  requestHoursCorrection,
  submitEvaluation,
  reviewLogbook,
};
