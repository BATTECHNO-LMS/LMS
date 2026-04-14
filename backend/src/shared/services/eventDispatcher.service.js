const { prisma } = require('../../config/db');
const notificationService = require('./notification.service');
const auditService = require('./audit.service');

async function handleRecognitionRequestStatusChanged(event) {
  const { request, actor, ipAddress } = event;
  await auditService.recordAudit({
    userId: actor?.userId ?? null,
    universityId: request?.university_id ?? actor?.universityId ?? null,
    actionType: 'recognition_request.status',
    entityType: 'recognition_request',
    entityId: request?.id,
    newValues: { status: request?.status },
    ipAddress: ipAddress ?? null,
  });
  if (request?.created_by) {
    await notificationService.createNotificationForUser({
      userId: request.created_by,
      title: `Recognition request status changed to ${request.status}`,
      body: `Request ${request.id} is now ${request.status}.`,
      type: 'action_required',
      dedupeWindowHours: 2,
    });
  }
}

async function handleCertificateIssued(event) {
  const { certificate, actor, ipAddress } = event;
  await auditService.recordAudit({
    userId: actor?.userId ?? null,
    universityId: actor?.universityId ?? null,
    actionType: 'certificate.issue',
    entityType: 'certificate',
    entityId: certificate?.id,
    newValues: {
      certificate_no: certificate?.certificate_no,
      student_id: certificate?.student_id,
      status: certificate?.status,
    },
    ipAddress: ipAddress ?? null,
  });
  if (certificate?.student_id) {
    await notificationService.createNotificationForUser({
      userId: certificate.student_id,
      title: `Certificate issued: ${certificate.certificate_no}`,
      body: `Your certificate has been issued with status ${certificate.status}.`,
      type: 'success',
      dedupeWindowHours: 24,
    });
  }
}

async function handleCertificateStatusChanged(event) {
  const { certificate, actor, ipAddress } = event;
  await auditService.recordAudit({
    userId: actor?.userId ?? null,
    universityId: actor?.universityId ?? null,
    actionType: 'certificate.status',
    entityType: 'certificate',
    entityId: certificate?.id,
    newValues: { status: certificate?.status },
    ipAddress: ipAddress ?? null,
  });
  if (certificate?.student_id) {
    await notificationService.createNotificationForUser({
      userId: certificate.student_id,
      title: `Certificate status changed: ${certificate.status}`,
      body: `Certificate ${certificate.certificate_no} status is now ${certificate.status}.`,
      type: 'warning',
      dedupeWindowHours: 8,
    });
  }
}

async function handleAttendanceBelowThreshold(event) {
  const { cohortId, attendanceRate, threshold = 75 } = event;
  const cohort = await prisma.cohorts.findUnique({ where: { id: cohortId } });
  if (!cohort) return;
  const recipientIds = [];
  if (cohort.instructor_id) recipientIds.push(cohort.instructor_id);
  const adminIds = await notificationService.userIdsByRoleCodes(['university_admin', 'academic_admin', 'qa_officer'], {
    universityId: cohort.university_id,
  });
  recipientIds.push(...adminIds);
  await notificationService.createNotificationsForUsers({
    userIds: recipientIds,
    title: `Attendance below threshold in cohort ${cohort.title}`,
    body: `Current average attendance (${attendanceRate.toFixed(2)}%) is below threshold (${threshold}%).`,
    type: 'warning',
    dedupeWindowHours: 24,
  });
}

async function handleCorrectiveActionOverdue(event) {
  const { correctiveAction } = event;
  const recipients = [];
  if (correctiveAction?.assigned_to) recipients.push(correctiveAction.assigned_to);
  const qa = await prisma.qa_reviews.findUnique({
    where: { id: correctiveAction.qa_review_id },
    select: { cohort_id: true },
  });
  if (qa?.cohort_id) {
    const cohort = await prisma.cohorts.findUnique({
      where: { id: qa.cohort_id },
      select: { university_id: true },
    });
    if (cohort?.university_id) {
      const qaOfficers = await notificationService.userIdsByRoleCodes(['qa_officer'], {
        universityId: cohort.university_id,
      });
      recipients.push(...qaOfficers);
    }
  }
  await notificationService.createNotificationsForUsers({
    userIds: recipients,
    title: 'Corrective action overdue',
    body: `Corrective action ${correctiveAction.id} is overdue.`,
    type: 'warning',
    dedupeWindowHours: 24,
  });
}

async function handleIntegrityCaseReported(event) {
  const { integrityCase, actor, ipAddress } = event;
  await auditService.recordAudit({
    userId: actor?.userId ?? null,
    universityId: actor?.universityId ?? null,
    actionType: 'integrity_case.reported',
    entityType: 'integrity_case',
    entityId: integrityCase?.id,
    newValues: {
      status: integrityCase?.status,
      case_type: integrityCase?.case_type,
      cohort_id: integrityCase?.cohort_id,
    },
    ipAddress: ipAddress ?? null,
  });
  const cohort = await prisma.cohorts.findUnique({
    where: { id: integrityCase?.cohort_id },
    select: { university_id: true, title: true },
  });
  const oversight = await notificationService.userIdsByRoleCodes(['super_admin', 'program_admin', 'university_admin', 'qa_officer'], {
    universityId: cohort?.university_id,
  });
  await notificationService.createNotificationsForUsers({
    userIds: oversight,
    title: 'Integrity case reported',
    body: `A new integrity case was reported for cohort ${cohort?.title || integrityCase?.cohort_id}.`,
    type: 'danger',
    dedupeWindowHours: 2,
  });
}

async function handleQaReviewOpened(event) {
  const { qaReview } = event;
  const cohort = await prisma.cohorts.findUnique({
    where: { id: qaReview?.cohort_id },
    select: { university_id: true, title: true, instructor_id: true },
  });
  const recipients = [];
  if (qaReview?.reviewer_id) recipients.push(qaReview.reviewer_id);
  if (cohort?.instructor_id) recipients.push(cohort.instructor_id);
  const qaOfficers = await notificationService.userIdsByRoleCodes(['qa_officer', 'university_admin'], {
    universityId: cohort?.university_id,
  });
  recipients.push(...qaOfficers);
  await notificationService.createNotificationsForUsers({
    userIds: recipients,
    title: 'QA review opened',
    body: `A QA review has been opened for cohort ${cohort?.title || qaReview?.cohort_id}.`,
    type: 'info',
    dedupeWindowHours: 8,
  });
}

async function handleAssessmentOverdue(event) {
  const { assessment } = event;
  if (!assessment?.cohort_id) return;
  const cohort = await prisma.cohorts.findUnique({
    where: { id: assessment.cohort_id },
    select: { instructor_id: true, university_id: true, title: true },
  });
  const recipients = [];
  if (cohort?.instructor_id) recipients.push(cohort.instructor_id);
  const admins = await notificationService.userIdsByRoleCodes(['academic_admin'], {
    universityId: cohort?.university_id,
  });
  recipients.push(...admins);
  await notificationService.createNotificationsForUsers({
    userIds: recipients,
    title: 'Assessment overdue',
    body: `Assessment "${assessment.title}" is overdue in cohort ${cohort?.title || assessment.cohort_id}.`,
    type: 'warning',
    dedupeWindowHours: 12,
  });
}

async function handleAssessmentUngradedBeforeClosure(event) {
  const { assessment } = event;
  if (!assessment?.cohort_id) return;
  const cohort = await prisma.cohorts.findUnique({
    where: { id: assessment.cohort_id },
    select: { instructor_id: true, university_id: true, title: true },
  });
  const recipients = [];
  if (cohort?.instructor_id) recipients.push(cohort.instructor_id);
  const admins = await notificationService.userIdsByRoleCodes(['academic_admin', 'qa_officer'], {
    universityId: cohort?.university_id,
  });
  recipients.push(...admins);
  await notificationService.createNotificationsForUsers({
    userIds: recipients,
    title: 'Assessment closed with pending grading',
    body: `Assessment "${assessment.title}" is closed but still has pending grading.`,
    type: 'warning',
    dedupeWindowHours: 12,
  });
}

async function dispatchAppEvent(type, payload) {
  switch (type) {
    case 'recognition_request_status_changed':
      await handleRecognitionRequestStatusChanged(payload);
      break;
    case 'certificate_issued':
      await handleCertificateIssued(payload);
      break;
    case 'certificate_status_changed':
      await handleCertificateStatusChanged(payload);
      break;
    case 'attendance_below_threshold':
      await handleAttendanceBelowThreshold(payload);
      break;
    case 'corrective_action_overdue':
      await handleCorrectiveActionOverdue(payload);
      break;
    case 'integrity_case_reported':
      await handleIntegrityCaseReported(payload);
      break;
    case 'qa_review_opened':
      await handleQaReviewOpened(payload);
      break;
    case 'assessment_overdue':
      await handleAssessmentOverdue(payload);
      break;
    case 'assessment_ungraded_before_closure':
      await handleAssessmentUngradedBeforeClosure(payload);
      break;
    case 'cohort_status_changed':
    default:
      break;
  }
}

module.exports = {
  dispatchAppEvent,
};
