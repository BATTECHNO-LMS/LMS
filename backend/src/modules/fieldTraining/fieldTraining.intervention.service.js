/**
 * Field Training Intervention Cases — staff follow-up workflow.
 * Does NOT affect scoring. Internal notes are never student-visible by default.
 */

const { ApiError } = require('../../utils/apiError');
const { prisma } = require('../../config/db');
const { recordAudit } = require('../../utils/auditRecorder');
const { assertManageOpportunityAccess } = require('./fieldTraining.access');
const repo = require('./fieldTraining.repository');
const { emitDomainEvent } = require('../notificationEngine/notificationDispatcher.service');

const ACTIVE_STATUSES = Object.freeze(['OPEN', 'IN_PROGRESS', 'MONITORING']);
const CASE_TYPES = Object.freeze([
  'LOW_ATTENDANCE',
  'TASKS_OVERDUE',
  'LOW_PERFORMANCE',
  'MISSING_POST',
  'HOURS_INCOMPLETE',
  'INACTIVITY',
  'BEHAVIOR_CONCERN',
  'SUPERVISOR_CONCERN',
  'STUDENT_SUPPORT',
  'OTHER',
]);
const SEVERITIES = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const STATUSES = Object.freeze(['OPEN', 'IN_PROGRESS', 'MONITORING', 'RESOLVED', 'CLOSED']);
const ACTIONS = Object.freeze([
  'CASE_OPENED',
  'ASSIGNED',
  'COMMENT_ADDED',
  'STUDENT_CONTACTED',
  'SUPERVISOR_CONTACTED',
  'WARNING_SENT',
  'MEETING_HELD',
  'ACTION_PLAN_CREATED',
  'STATUS_CHANGED',
  'FOLLOW_UP_ADDED',
  'RESOLVED',
  'REOPENED',
]);
const RESOLUTIONS = Object.freeze([
  'IMPROVED',
  'REQUIREMENT_COMPLETED',
  'WARNING_ISSUED',
  'REFERRED',
  'NO_FURTHER_ACTION',
  'TRAINING_ENDED',
  'OTHER',
]);

function mapCase(row, { events = null, student = null } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    application_id: row.application_id,
    opportunity_id: row.opportunity_id,
    student_id: row.student_id,
    student_name: student?.full_name || student?.email || null,
    case_type: row.case_type,
    severity: row.severity,
    status: row.status,
    source: row.source,
    title: row.title,
    reason: row.reason,
    description: row.description,
    opened_by_id: row.opened_by_id,
    opened_at: row.opened_at,
    assigned_to_id: row.assigned_to_id,
    due_at: row.due_at,
    follow_up_at: row.follow_up_at,
    resolved_at: row.resolved_at,
    resolved_by_id: row.resolved_by_id,
    resolution: row.resolution,
    resolution_note: row.resolution_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    follow_up_overdue:
      row.follow_up_at &&
      ACTIVE_STATUSES.includes(row.status) &&
      new Date(row.follow_up_at).getTime() < Date.now(),
    events: events
      ? events.map((e) => ({
          id: e.id,
          action: e.action,
          actor_user_id: e.actor_user_id,
          note: e.note,
          student_visible: e.student_visible,
          next_step: e.next_step,
          follow_up_at: e.follow_up_at,
          created_at: e.created_at,
        }))
      : undefined,
  };
}

async function assertCaseOpportunityAccess(user, opportunityId) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  return opp;
}

async function findActiveDuplicate(applicationId, caseType) {
  return prisma.field_training_intervention_cases.findFirst({
    where: {
      application_id: applicationId,
      case_type: caseType,
      status: { in: [...ACTIVE_STATUSES] },
    },
    orderBy: { opened_at: 'desc' },
  });
}

async function openCase(body, user) {
  const applicationId = body.application_id || body.applicationId;
  const app = await prisma.field_training_applications.findUnique({
    where: { id: applicationId },
  });
  if (!app) throw new ApiError(404, 'Application not found');
  await assertCaseOpportunityAccess(user, app.opportunity_id);

  const caseType = String(body.case_type || body.caseType || '').toUpperCase();
  if (!CASE_TYPES.includes(caseType)) {
    throw new ApiError(400, 'نوع حالة المتابعة غير صالح');
  }
  const severity = String(body.severity || 'MEDIUM').toUpperCase();
  if (!SEVERITIES.includes(severity)) {
    throw new ApiError(400, 'مستوى الخطورة غير صالح');
  }

  const existing = await findActiveDuplicate(app.id, caseType);
  if (existing) {
    return {
      created: false,
      duplicate: true,
      case: mapCase(existing),
      message: 'توجد حالة متابعة نشطة من نفس النوع لهذا الطالب',
    };
  }

  const title =
    String(body.title || '').trim() ||
    `متابعة: ${caseType.replace(/_/g, ' ')}`;
  const now = new Date();
  const row = await prisma.field_training_intervention_cases.create({
    data: {
      application_id: app.id,
      opportunity_id: app.opportunity_id,
      student_id: app.student_id,
      case_type: caseType,
      severity,
      status: 'OPEN',
      source: body.source === 'RISK_ENGINE_SUGGESTED' ? 'RISK_ENGINE_SUGGESTED' : 'MANUAL',
      title,
      reason: body.reason?.trim() || null,
      description: body.description?.trim() || null,
      opened_by_id: user.userId,
      opened_at: now,
      assigned_to_id: body.assigned_to_id || body.assignedToId || null,
      due_at: body.due_at ? new Date(body.due_at) : null,
      follow_up_at: body.follow_up_at ? new Date(body.follow_up_at) : null,
    },
  });

  await prisma.field_training_intervention_events.create({
    data: {
      case_id: row.id,
      action: 'CASE_OPENED',
      actor_user_id: user.userId,
      note: body.reason?.trim() || title,
      student_visible: false,
    },
  });

  if (row.assigned_to_id) {
    await prisma.field_training_intervention_events.create({
      data: {
        case_id: row.id,
        action: 'ASSIGNED',
        actor_user_id: user.userId,
        note: `Assigned to ${row.assigned_to_id}`,
        student_visible: false,
      },
    });
    setImmediate(() => {
      emitDomainEvent('INTERVENTION_CASE_ASSIGNED', {
        opportunityId: app.opportunity_id,
        applicationId: app.id,
        actorUserId: user.userId,
        entityType: 'field_training_intervention_case',
        entityId: row.id,
        templateVars: {
          case_title: title,
          action_url: `/admin/field-training/${app.opportunity_id}/manage?tab=interventions`,
        },
      }).catch(() => null);
    });
  }

  await recordAudit({
    userId: user.userId,
    actionType: 'INTERVENTION_CASE_OPENED',
    entityType: 'field_training_intervention_case',
    entityId: row.id,
    newValues: {
      application_id: app.id,
      opportunity_id: app.opportunity_id,
      case_type: caseType,
      severity,
      student_id: app.student_id,
    },
  });

  return { created: true, duplicate: false, case: mapCase(row) };
}

async function listCases(opportunityId, query, user) {
  await assertCaseOpportunityAccess(user, opportunityId);

  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || query.limit) || 20));
  const where = { opportunity_id: opportunityId };

  if (query.status) {
    const statuses = String(query.status)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => STATUSES.includes(s));
    if (statuses.length) where.status = { in: statuses };
  }
  if (query.severity) {
    const sev = String(query.severity).toUpperCase();
    if (SEVERITIES.includes(sev)) where.severity = sev;
  }
  if (query.case_type || query.caseType) {
    const ct = String(query.case_type || query.caseType).toUpperCase();
    if (CASE_TYPES.includes(ct)) where.case_type = ct;
  }
  if (query.assigned_to_id || query.assignedToId) {
    where.assigned_to_id = query.assigned_to_id || query.assignedToId;
  }
  if (query.application_id || query.applicationId) {
    where.application_id = query.application_id || query.applicationId;
  }
  if (query.student_id || query.studentId) {
    where.student_id = query.student_id || query.studentId;
  }
  if (query.follow_up_overdue === 'true' || query.followUpOverdue === true) {
    where.follow_up_at = { lt: new Date() };
    where.status = { in: [...ACTIVE_STATUSES] };
  }
  if (query.from || query.to) {
    where.opened_at = {};
    if (query.from) where.opened_at.gte = new Date(query.from);
    if (query.to) where.opened_at.lte = new Date(query.to);
  }

  const [total, rows] = await Promise.all([
    prisma.field_training_intervention_cases.count({ where }),
    prisma.field_training_intervention_cases.findMany({
      where,
      orderBy: [{ severity: 'desc' }, { follow_up_at: 'asc' }, { opened_at: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const studentIds = [...new Set(rows.map((r) => r.student_id))];
  const users =
    studentIds.length > 0
      ? await prisma.users.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, full_name: true, email: true },
        })
      : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  return {
    items: rows.map((r) => mapCase(r, { student: byId.get(r.student_id) })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
  };
}

async function getCase(caseId, user) {
  const row = await prisma.field_training_intervention_cases.findUnique({
    where: { id: caseId },
    include: {
      field_training_intervention_events: { orderBy: { created_at: 'asc' } },
    },
  });
  if (!row) throw new ApiError(404, 'Case not found');
  await assertCaseOpportunityAccess(user, row.opportunity_id);
  const student = await prisma.users.findUnique({
    where: { id: row.student_id },
    select: { id: true, full_name: true, email: true },
  });
  return {
    case: mapCase(row, {
      events: row.field_training_intervention_events,
      student,
    }),
  };
}

async function addFollowUp(caseId, body, user) {
  const row = await prisma.field_training_intervention_cases.findUnique({ where: { id: caseId } });
  if (!row) throw new ApiError(404, 'Case not found');
  await assertCaseOpportunityAccess(user, row.opportunity_id);

  const action = String(body.action || 'FOLLOW_UP_ADDED').toUpperCase();
  if (!ACTIONS.includes(action) || action === 'CASE_OPENED' || action === 'RESOLVED' || action === 'REOPENED') {
    if (!['COMMENT_ADDED', 'STUDENT_CONTACTED', 'SUPERVISOR_CONTACTED', 'WARNING_SENT', 'MEETING_HELD', 'ACTION_PLAN_CREATED', 'FOLLOW_UP_ADDED', 'STATUS_CHANGED', 'ASSIGNED'].includes(action)) {
      throw new ApiError(400, 'نوع الإجراء غير صالح');
    }
  }

  const studentVisible = body.student_visible === true;
  const followUpAt = body.follow_up_at ? new Date(body.follow_up_at) : null;
  const nextStatus = body.status ? String(body.status).toUpperCase() : null;

  const event = await prisma.field_training_intervention_events.create({
    data: {
      case_id: caseId,
      action: ACTIONS.includes(action) ? action : 'FOLLOW_UP_ADDED',
      actor_user_id: user.userId,
      note: body.note?.trim() || null,
      student_visible: studentVisible,
      next_step: body.next_step?.trim() || null,
      follow_up_at: followUpAt,
    },
  });

  const update = { updated_at: new Date() };
  if (followUpAt) update.follow_up_at = followUpAt;
  if (body.assigned_to_id || body.assignedToId) {
    update.assigned_to_id = body.assigned_to_id || body.assignedToId;
  }
  if (nextStatus && STATUSES.includes(nextStatus) && !['RESOLVED', 'CLOSED'].includes(nextStatus)) {
    update.status = nextStatus;
  }

  const updated = await prisma.field_training_intervention_cases.update({
    where: { id: caseId },
    data: update,
  });

  await recordAudit({
    userId: user.userId,
    actionType: 'INTERVENTION_FOLLOW_UP_ADDED',
    entityType: 'field_training_intervention_case',
    entityId: caseId,
    newValues: { action: event.action, student_visible: studentVisible },
  });

  return { case: mapCase(updated), event };
}

async function assignCase(caseId, body, user) {
  const row = await prisma.field_training_intervention_cases.findUnique({ where: { id: caseId } });
  if (!row) throw new ApiError(404, 'Case not found');
  await assertCaseOpportunityAccess(user, row.opportunity_id);

  const assignedTo = body.assigned_to_id || body.assignedToId;
  if (!assignedTo) throw new ApiError(400, 'المسند إليه مطلوب');

  const updated = await prisma.field_training_intervention_cases.update({
    where: { id: caseId },
    data: {
      assigned_to_id: assignedTo,
      status: row.status === 'OPEN' ? 'IN_PROGRESS' : row.status,
      updated_at: new Date(),
    },
  });

  await prisma.field_training_intervention_events.create({
    data: {
      case_id: caseId,
      action: 'ASSIGNED',
      actor_user_id: user.userId,
      note: body.note?.trim() || null,
      student_visible: false,
    },
  });

  await recordAudit({
    userId: user.userId,
    actionType: 'INTERVENTION_CASE_ASSIGNED',
    entityType: 'field_training_intervention_case',
    entityId: caseId,
    newValues: { assigned_to_id: assignedTo },
  });

  setImmediate(() => {
    emitDomainEvent('INTERVENTION_CASE_ASSIGNED', {
      opportunityId: row.opportunity_id,
      applicationId: row.application_id,
      actorUserId: user.userId,
      entityType: 'field_training_intervention_case',
      entityId: caseId,
      templateVars: {
        case_title: row.title,
        action_url: `/admin/field-training/${row.opportunity_id}/manage?tab=interventions`,
      },
    }).catch(() => null);
  });

  return { case: mapCase(updated) };
}

async function resolveCase(caseId, body, user) {
  const row = await prisma.field_training_intervention_cases.findUnique({ where: { id: caseId } });
  if (!row) throw new ApiError(404, 'Case not found');
  await assertCaseOpportunityAccess(user, row.opportunity_id);

  const resolution = String(body.resolution || '').toUpperCase();
  if (!RESOLUTIONS.includes(resolution)) {
    throw new ApiError(400, 'نتيجة الإغلاق غير صالحة');
  }
  const note = String(body.resolution_note || body.note || '').trim();
  if (!note) throw new ApiError(400, 'ملاحظة الإغلاق مطلوبة');

  const now = new Date();
  const updated = await prisma.field_training_intervention_cases.update({
    where: { id: caseId },
    data: {
      status: body.close === true ? 'CLOSED' : 'RESOLVED',
      resolution,
      resolution_note: note,
      resolved_at: now,
      resolved_by_id: user.userId,
      updated_at: now,
    },
  });

  await prisma.field_training_intervention_events.create({
    data: {
      case_id: caseId,
      action: 'RESOLVED',
      actor_user_id: user.userId,
      note: `${resolution}: ${note}`,
      student_visible: body.student_visible === true,
    },
  });

  await recordAudit({
    userId: user.userId,
    actionType: 'INTERVENTION_CASE_RESOLVED',
    entityType: 'field_training_intervention_case',
    entityId: caseId,
    newValues: { resolution, status: updated.status },
  });

  return { case: mapCase(updated) };
}

async function reopenCase(caseId, body, user) {
  const row = await prisma.field_training_intervention_cases.findUnique({ where: { id: caseId } });
  if (!row) throw new ApiError(404, 'Case not found');
  await assertCaseOpportunityAccess(user, row.opportunity_id);
  if (!['RESOLVED', 'CLOSED'].includes(row.status)) {
    throw new ApiError(400, 'الحالة ليست مغلقة');
  }

  // Preserve prior resolution fields for history; clear active resolution pointers.
  const updated = await prisma.field_training_intervention_cases.update({
    where: { id: caseId },
    data: {
      status: 'IN_PROGRESS',
      updated_at: new Date(),
      // Keep resolution / resolved_at for audit trail; do not overwrite history events.
    },
  });

  await prisma.field_training_intervention_events.create({
    data: {
      case_id: caseId,
      action: 'REOPENED',
      actor_user_id: user.userId,
      note: body.note?.trim() || 'Case reopened',
      student_visible: false,
    },
  });

  await recordAudit({
    userId: user.userId,
    actionType: 'INTERVENTION_CASE_REOPENED',
    entityType: 'field_training_intervention_case',
    entityId: caseId,
    newValues: {
      previous_resolution: row.resolution,
      previous_resolved_at: row.resolved_at,
    },
  });

  return { case: mapCase(updated) };
}

async function getKpis(opportunityId, user) {
  await assertCaseOpportunityAccess(user, opportunityId);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [open, highCritical, overdue, resolvedMonth, unassigned] = await Promise.all([
    prisma.field_training_intervention_cases.count({
      where: { opportunity_id: opportunityId, status: { in: [...ACTIVE_STATUSES] } },
    }),
    prisma.field_training_intervention_cases.count({
      where: {
        opportunity_id: opportunityId,
        status: { in: [...ACTIVE_STATUSES] },
        severity: { in: ['HIGH', 'CRITICAL'] },
      },
    }),
    prisma.field_training_intervention_cases.count({
      where: {
        opportunity_id: opportunityId,
        status: { in: [...ACTIVE_STATUSES] },
        follow_up_at: { lt: now },
      },
    }),
    prisma.field_training_intervention_cases.count({
      where: {
        opportunity_id: opportunityId,
        status: { in: ['RESOLVED', 'CLOSED'] },
        resolved_at: { gte: monthStart },
      },
    }),
    prisma.field_training_intervention_cases.count({
      where: {
        opportunity_id: opportunityId,
        status: { in: [...ACTIVE_STATUSES] },
        assigned_to_id: null,
      },
    }),
  ]);

  return {
    open_cases: open,
    high_critical_cases: highCritical,
    overdue_follow_ups: overdue,
    resolved_this_month: resolvedMonth,
    unassigned_cases: unassigned,
  };
}

async function getCasesForApplications(applicationIds) {
  if (!applicationIds?.length) return [];
  return prisma.field_training_intervention_cases.findMany({
    where: {
      application_id: { in: applicationIds },
      status: { in: [...ACTIVE_STATUSES] },
    },
    select: {
      id: true,
      application_id: true,
      case_type: true,
      severity: true,
      status: true,
      assigned_to_id: true,
      follow_up_at: true,
      title: true,
    },
  });
}

/** Student-visible communications only (explicit student_visible=true). */
async function listStudentVisibleActions(applicationId, studentId) {
  const cases = await prisma.field_training_intervention_cases.findMany({
    where: { application_id: applicationId, student_id: studentId },
    select: { id: true },
  });
  if (!cases.length) return [];
  return prisma.field_training_intervention_events.findMany({
    where: {
      case_id: { in: cases.map((c) => c.id) },
      student_visible: true,
      action: { in: ['WARNING_SENT', 'MEETING_HELD', 'ACTION_PLAN_CREATED', 'STUDENT_CONTACTED'] },
    },
    orderBy: { created_at: 'desc' },
    take: 20,
    select: {
      id: true,
      action: true,
      note: true,
      next_step: true,
      follow_up_at: true,
      created_at: true,
    },
  });
}

module.exports = {
  CASE_TYPES,
  SEVERITIES,
  STATUSES,
  ACTIONS,
  RESOLUTIONS,
  ACTIVE_STATUSES,
  openCase,
  listCases,
  getCase,
  addFollowUp,
  assignCase,
  resolveCase,
  reopenCase,
  getKpis,
  getCasesForApplications,
  listStudentVisibleActions,
  findActiveDuplicate,
};
