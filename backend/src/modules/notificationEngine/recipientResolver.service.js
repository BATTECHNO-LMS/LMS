'use strict';

const { prisma } = require('../../config/db');
const { findActiveAdminUserIdsForStudentRegistrationAlert } = require('../../shared/services/notification.service');
const {
  OFFICIAL_ROLES,
  getTargetUniversityIdsFromScope,
} = require('./notificationEngine.shared');

/**
 * @typedef {{ userId: string, roleCode: string }} Recipient
 */

/**
 * Resolve university id from context / related entities.
 * @param {Record<string, unknown>} context
 * @returns {Promise<string | null>}
 */
async function resolveUniversityId(context) {
  if (context.universityId) return String(context.universityId);

  if (context.opportunityId) {
    const opp = await prisma.field_training_opportunities.findUnique({
      where: { id: String(context.opportunityId) },
      select: { university_id: true },
    });
    if (opp?.university_id) return opp.university_id;
  }

  if (context.sessionId) {
    const session = await prisma.field_training_sessions.findUnique({
      where: { id: String(context.sessionId) },
      select: {
        field_training_opportunities: { select: { university_id: true } },
      },
    });
    if (session?.field_training_opportunities?.university_id) {
      return session.field_training_opportunities.university_id;
    }
  }

  if (context.taskId) {
    const task = await prisma.field_training_tasks.findUnique({
      where: { id: String(context.taskId) },
      select: {
        field_training_opportunities: { select: { university_id: true } },
      },
    });
    if (task?.field_training_opportunities?.university_id) {
      return task.field_training_opportunities.university_id;
    }
  }

  if (context.applicationId) {
    const app = await prisma.field_training_applications.findUnique({
      where: { id: String(context.applicationId) },
      select: {
        field_training_opportunities: { select: { university_id: true } },
      },
    });
    if (app?.field_training_opportunities?.university_id) {
      return app.field_training_opportunities.university_id;
    }
  }

  if (context.studentId || context.affectedUserId) {
    const userId = String(context.studentId || context.affectedUserId);
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { primary_university_id: true },
    });
    if (user?.primary_university_id) return user.primary_university_id;
  }

  return null;
}

/**
 * @param {string} opportunityId
 * @returns {Promise<string | null>}
 */
async function resolveOpportunityInstructorId(opportunityId) {
  if (!opportunityId) return null;
  const opp = await prisma.field_training_opportunities.findUnique({
    where: { id: String(opportunityId) },
    select: { assigned_instructor_id: true },
  });
  return opp?.assigned_instructor_id || null;
}

/**
 * @param {Record<string, unknown>} context
 * @returns {Promise<string | null>}
 */
async function resolveOpportunityId(context) {
  if (context.opportunityId) return String(context.opportunityId);
  if (context.sessionId) {
    const session = await prisma.field_training_sessions.findUnique({
      where: { id: String(context.sessionId) },
      select: { opportunity_id: true },
    });
    return session?.opportunity_id || null;
  }
  if (context.taskId) {
    const task = await prisma.field_training_tasks.findUnique({
      where: { id: String(context.taskId) },
      select: { opportunity_id: true },
    });
    return task?.opportunity_id || null;
  }
  if (context.applicationId) {
    const app = await prisma.field_training_applications.findUnique({
      where: { id: String(context.applicationId) },
      select: { opportunity_id: true },
    });
    return app?.opportunity_id || null;
  }
  return null;
}

/**
 * Active approved (non-expelled) students for an opportunity.
 * @param {string} opportunityId
 * @returns {Promise<Recipient[]>}
 */
async function enrolledStudentsOfOpportunity(opportunityId) {
  if (!opportunityId) return [];
  const apps = await prisma.field_training_applications.findMany({
    where: {
      opportunity_id: opportunityId,
      status: 'approved',
      training_status: { not: 'expelled' },
      expelled_at: null,
    },
    select: { student_id: true },
  });
  const ids = [...new Set(apps.map((a) => a.student_id).filter(Boolean))];
  if (!ids.length) return [];
  const users = await prisma.users.findMany({
    where: { id: { in: ids }, status: 'active' },
    select: { id: true },
  });
  return users.map((u) => ({ userId: u.id, roleCode: 'student' }));
}

/**
 * Eligible students for attendance window (session roster if present, else opportunity participants).
 * NEVER exposes attendance codes.
 * @param {Record<string, unknown>} context
 * @returns {Promise<Recipient[]>}
 */
async function eligibleAttendanceStudents(context) {
  const sessionId = context.sessionId ? String(context.sessionId) : null;
  const opportunityId = await resolveOpportunityId(context);

  if (sessionId) {
    const rows = await prisma.field_training_attendance.findMany({
      where: { session_id: sessionId },
      select: { student_id: true },
    });
    const ids = [...new Set(rows.map((r) => r.student_id).filter(Boolean))];
    if (ids.length) {
      const users = await prisma.users.findMany({
        where: { id: { in: ids }, status: 'active' },
        select: { id: true },
      });
      return users.map((u) => ({ userId: u.id, roleCode: 'student' }));
    }
  }

  if (opportunityId) return enrolledStudentsOfOpportunity(opportunityId);
  return [];
}

/**
 * Scoped university admins (not necessarily super_admin).
 * @param {string | null} universityId
 * @param {{ includeSuperAdmin?: boolean }} [opts]
 * @returns {Promise<Recipient[]>}
 */
async function scopedAdmins(universityId, opts = {}) {
  if (!universityId) return [];
  const includeSuperAdmin = opts.includeSuperAdmin !== false;
  const adminIds = await findActiveAdminUserIdsForStudentRegistrationAlert(universityId);
  if (!adminIds.length) return [];

  const links = await prisma.user_roles.findMany({
    where: { user_id: { in: adminIds } },
    select: { user_id: true, role_id: true },
  });
  const roleIds = [...new Set(links.map((l) => l.role_id))];
  const roleRows = roleIds.length
    ? await prisma.roles.findMany({
        where: { id: { in: roleIds } },
        select: { id: true, code: true },
      })
    : [];
  const codeByRoleId = new Map(roleRows.map((r) => [r.id, String(r.code || '').toLowerCase()]));
  const codesByUser = new Map();
  for (const link of links) {
    const code = codeByRoleId.get(link.role_id);
    if (!code) continue;
    if (!codesByUser.has(link.user_id)) codesByUser.set(link.user_id, new Set());
    codesByUser.get(link.user_id).add(code);
  }

  const out = [];
  for (const userId of adminIds) {
    const codes = codesByUser.get(userId) || new Set();
    if (codes.has('super_admin')) {
      if (includeSuperAdmin) out.push({ userId, roleCode: 'super_admin' });
      continue;
    }
    if (codes.has('admin')) out.push({ userId, roleCode: 'admin' });
  }
  return out;
}

/**
 * Active reviewers assigned to a university.
 * @param {string | null} universityId
 * @returns {Promise<Recipient[]>}
 */
async function reviewersOfUniversity(universityId) {
  if (!universityId) return [];
  const assignments = await prisma.reviewer_university_assignments.findMany({
    where: { university_id: universityId, is_active: true },
    select: { reviewer_user_id: true },
  });
  const ids = [...new Set(assignments.map((a) => a.reviewer_user_id).filter(Boolean))];
  if (!ids.length) return [];
  const users = await prisma.users.findMany({
    where: { id: { in: ids }, status: 'active' },
    select: { id: true },
  });
  return users.map((u) => ({ userId: u.id, roleCode: 'reviewer' }));
}

/**
 * @param {string | null | undefined} userId
 * @param {string} roleCode
 * @returns {Recipient[]}
 */
function singleRecipient(userId, roleCode) {
  if (!userId) return [];
  if (!OFFICIAL_ROLES.includes(roleCode)) return [];
  return [{ userId: String(userId), roleCode }];
}

/**
 * Deduplicate by userId, keeping first role assignment.
 * @param {Recipient[]} list
 * @returns {Recipient[]}
 */
function uniqueRecipients(list) {
  const seen = new Set();
  const out = [];
  for (const r of list) {
    if (!r?.userId) continue;
    const key = String(r.userId);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ userId: key, roleCode: String(r.roleCode || 'student') });
  }
  return out;
}

/**
 * Resolve recipients for a domain event. Never trust frontend recipientIds.
 * @param {string} eventType
 * @param {Record<string, unknown>} [context]
 * @returns {Promise<Recipient[]>}
 */
async function resolveRecipients(eventType, context = {}) {
  const type = String(eventType || '');
  // Announcements module owns delivery for publish events.
  if (type === 'ANNOUNCEMENT_PUBLISHED' || type === 'ANNOUNCEMENT_UPDATED') {
    return [];
  }

  const universityId = await resolveUniversityId(context);
  const opportunityId = await resolveOpportunityId(context);
  const studentId = context.studentId
    ? String(context.studentId)
    : context.affectedUserId
      ? String(context.affectedUserId)
      : null;
  const instructorId =
    (context.instructorId && String(context.instructorId)) ||
    (opportunityId ? await resolveOpportunityInstructorId(opportunityId) : null);

  switch (type) {
    case 'ACCOUNT_PENDING_ACTIVATION':
    case 'ACCOUNT_ACTIVATED':
    case 'ACCOUNT_ACTIVATION_DELAYED':
    case 'ACCOUNT_REJECTED':
    case 'ACCOUNT_DISABLED':
    case 'ACCOUNT_REACTIVATED': {
      const student = singleRecipient(studentId, 'student');
      const admins = await scopedAdmins(universityId, { includeSuperAdmin: true });
      return uniqueRecipients([...student, ...admins]);
    }

    case 'APPLICATION_SUBMITTED':
    case 'APPLICATION_ACCEPTED':
    case 'APPLICATION_REJECTED':
    case 'APPLICATION_NEEDS_UPDATE':
    case 'APPLICATION_WITHDRAWN': {
      const student = singleRecipient(studentId, 'student');
      const instructor = singleRecipient(instructorId, 'instructor');
      const admins = await scopedAdmins(universityId, { includeSuperAdmin: true });
      return uniqueRecipients([...student, ...instructor, ...admins]);
    }

    case 'SESSION_CREATED':
    case 'SESSION_UPDATED':
    case 'SESSION_RESCHEDULED':
    case 'SESSION_CANCELLED':
    case 'SESSION_STARTING_SOON':
    case 'ZOOM_LINK_ADDED':
    case 'ZOOM_LINK_UPDATED': {
      const students = opportunityId ? await enrolledStudentsOfOpportunity(opportunityId) : [];
      const instructor = singleRecipient(instructorId, 'instructor');
      const admins = await scopedAdmins(universityId, { includeSuperAdmin: true });
      const reviewers = await reviewersOfUniversity(universityId);
      return uniqueRecipients([...students, ...instructor, ...admins, ...reviewers]);
    }

    case 'ATTENDANCE_WINDOW_OPENED':
    case 'ATTENDANCE_WINDOW_CLOSING_SOON': {
      return uniqueRecipients(await eligibleAttendanceStudents(context));
    }

    case 'ATTENDANCE_CONFIRMED':
    case 'ATTENDANCE_MARKED_PRESENT':
    case 'ATTENDANCE_MARKED_ABSENT':
    case 'ATTENDANCE_MARKED_LATE':
    case 'ATTENDANCE_MARKED_EXCUSED':
    case 'ATTENDANCE_UNCONFIRMED':
    case 'ATTENDANCE_MANUALLY_UPDATED': {
      return uniqueRecipients(singleRecipient(studentId, 'student'));
    }

    case 'TASK_SUBMITTED':
    case 'TASK_RESUBMITTED': {
      // student + assigned instructor; admin optional via rule filter; NOT super_admin by default; NOT reviewer immediate
      const student = singleRecipient(studentId, 'student');
      const instructor = singleRecipient(instructorId, 'instructor');
      return uniqueRecipients([...student, ...instructor]);
    }

    case 'TASK_PUBLISHED':
    case 'TASK_CREATED':
    case 'TASK_UPDATED':
    case 'TASK_DEADLINE_APPROACHING':
    case 'TASK_DEADLINE_PASSED':
    case 'FINAL_TASK_AVAILABLE': {
      if (!opportunityId) return [];
      return uniqueRecipients(await enrolledStudentsOfOpportunity(opportunityId));
    }

    case 'TASK_GRADED':
    case 'TASK_REVISION_REQUESTED':
    case 'TASK_ACCEPTED':
    case 'TASK_REJECTED':
    case 'TASK_AI_EVALUATED': {
      return uniqueRecipients(singleRecipient(studentId, 'student'));
    }

    case 'TASK_MANUAL_REVIEW_REQUIRED': {
      return uniqueRecipients(singleRecipient(instructorId, 'instructor'));
    }

    case 'CERTIFICATE_ISSUED':
    case 'CERTIFICATE_ELIGIBLE':
    case 'CERTIFICATE_UPDATED':
    case 'CERTIFICATE_REVOKED':
    case 'TRAINING_LETTER_ISSUED': {
      const student = singleRecipient(studentId, 'student');
      const reviewers = await reviewersOfUniversity(universityId);
      const admins = await scopedAdmins(universityId, { includeSuperAdmin: true });
      return uniqueRecipients([...student, ...reviewers, ...admins]);
    }

    case 'PRE_TEST_AVAILABLE':
    case 'POST_TEST_AVAILABLE':
    case 'TEST_DEADLINE_APPROACHING': {
      if (!opportunityId) return [];
      return uniqueRecipients(await enrolledStudentsOfOpportunity(opportunityId));
    }

    case 'PRE_TEST_GRADED':
    case 'POST_TEST_GRADED':
    case 'PRE_TEST_SUBMITTED':
    case 'POST_TEST_SUBMITTED': {
      return uniqueRecipients(singleRecipient(studentId, 'student'));
    }

    case 'STUDENT_AT_RISK':
    case 'ATTENDANCE_RATE_LOW':
    case 'TASK_COMPLETION_RATE_LOW': {
      const student = singleRecipient(studentId, 'student');
      const instructor = singleRecipient(instructorId, 'instructor');
      const admins = await scopedAdmins(universityId, { includeSuperAdmin: false });
      return uniqueRecipients([...student, ...instructor, ...admins]);
    }

    case 'UNIVERSITY_REPORT_READY':
    case 'UNIVERSITY_REPORT_UPDATED':
    case 'UNIVERSITY_ATTENDANCE_ALERT':
    case 'UNIVERSITY_STUDENTS_AT_RISK':
    case 'UNIVERSITY_RESULTS_APPROVED':
    case 'UNIVERSITY_CERTIFICATES_ISSUED': {
      const reviewers = await reviewersOfUniversity(universityId);
      const admins = await scopedAdmins(universityId, { includeSuperAdmin: true });
      return uniqueRecipients([...reviewers, ...admins]);
    }

    default: {
      // Conservative fallback: affected student if present, else empty (rules alone do not invent recipients).
      if (studentId) return uniqueRecipients(singleRecipient(studentId, 'student'));
      return [];
    }
  }
}

/**
 * Filter resolved recipients by rule target roles / universities.
 * Universities come from target_scope.university_ids (API may expose as target_university_ids).
 * @param {Recipient[]} recipients
 * @param {{ target_roles?: string[], target_scope?: unknown, target_university_ids?: string[] }} rule
 * @param {string | null} contextUniversityId
 * @returns {Promise<Recipient[]>}
 */
async function filterRecipientsByRule(recipients, rule, contextUniversityId) {
  let list = recipients.slice();
  const targetRoles = Array.isArray(rule.target_roles)
    ? rule.target_roles.map((r) => String(r).toLowerCase()).filter(Boolean)
    : [];
  if (targetRoles.length) {
    list = list.filter((r) => targetRoles.includes(String(r.roleCode).toLowerCase()));
  }

  let targetUnis = getTargetUniversityIdsFromScope(rule.target_scope);
  if (!targetUnis.length && Array.isArray(rule.target_university_ids)) {
    targetUnis = rule.target_university_ids.map(String).filter(Boolean);
  }
  if (targetUnis.length && contextUniversityId) {
    if (!targetUnis.includes(String(contextUniversityId))) return [];
  } else if (targetUnis.length && !contextUniversityId) {
    // Rule is university-scoped but event has no university — skip.
    return [];
  }

  return list;
}

module.exports = {
  resolveRecipients,
  filterRecipientsByRule,
  resolveUniversityId,
  resolveOpportunityId,
  enrolledStudentsOfOpportunity,
  eligibleAttendanceStudents,
  scopedAdmins,
  reviewersOfUniversity,
};
