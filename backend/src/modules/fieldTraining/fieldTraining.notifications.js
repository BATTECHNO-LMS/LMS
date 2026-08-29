const { prisma } = require('../../config/db');
const { env } = require('../../config/env');
const {
  createNotificationForUser,
  userIdsByRoleCodes,
} = require('../../shared/services/notification.service');

async function findFieldTrainingAdminUserIds(universityId) {
  const superIds = await userIdsByRoleCodes([
    env.SUPER_ADMIN_ROLE_CODE || 'super_admin',
  ]);
  const uniAdminIds = universityId
    ? await userIdsByRoleCodes(['admin'], { universityId })
    : [];
  return [...new Set([...superIds, ...uniAdminIds])];
}

async function notifyAdminsFieldTrainingApplicationSubmitted(params) {
  const { opportunityId, opportunityTitle, universityId, studentName } = params;
  const userIds = await findFieldTrainingAdminUserIds(universityId);
  if (!userIds.length) return { created_count: 0 };

  let created = 0;
  for (const userId of userIds) {
    const row = await createNotificationForUser({
      userId,
      title: 'طلب تدريب ميداني جديد',
      body: `قدّم الطالب ${studentName || ''} طلبًا على فرصة "${opportunityTitle || ''}".`.trim(),
      type: 'action_required',
      actionUrl: `/admin/field-training/${opportunityId}/applications`,
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyStudentFieldTrainingApplicationApproved(params) {
  const { studentId, opportunityId, opportunityTitle } = params;
  return createNotificationForUser({
    userId: studentId,
    title: 'تم قبول طلب التدريب الميداني',
    body: `تمت الموافقة على طلبك للفرصة "${opportunityTitle || ''}". تابع الخطوات التالية في صفحة التدريب.`,
    type: 'success',
    actionUrl: `/student/field-training/${opportunityId}?tab=overview`,
  });
}

async function notifyStudentFieldTrainingApplicationRejected(params) {
  const { studentId, opportunityId, opportunityTitle } = params;
  return createNotificationForUser({
    userId: studentId,
    title: 'تم رفض طلب التدريب الميداني',
    body: `تم رفض طلبك للفرصة "${opportunityTitle || ''}". راجع الملاحظات الإدارية للتفاصيل.`,
    type: 'warning',
    actionUrl: `/student/field-training/${opportunityId}?tab=overview`,
  });
}

async function notifyApprovedStudentsNewTask(params) {
  const { opportunityId, opportunityTitle, taskTitle } = params;
  const apps = await prisma.field_training_applications.findMany({
    where: {
      opportunity_id: opportunityId,
      status: 'approved',
      training_status: { not: 'expelled' },
    },
    select: { student_id: true },
  });
  const userIds = [...new Set(apps.map((a) => a.student_id))];
  if (!userIds.length) return { created_count: 0 };

  let created = 0;
  for (const userId of userIds) {
    const row = await createNotificationForUser({
      userId,
      title: 'مهمة تدريب ميداني جديدة',
      body: `تمت إضافة مهمة "${taskTitle || ''}" لفرصة "${opportunityTitle || ''}".`,
      type: 'info',
      actionUrl: `/student/field-training/${opportunityId}?tab=tasks`,
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyFieldTrainingTaskSubmitted(params) {
  const {
    opportunityId,
    opportunityTitle,
    universityId,
    studentName,
    taskTitle,
    instructorId,
  } = params;
  const userIds = new Set(await findFieldTrainingAdminUserIds(universityId));
  if (instructorId) userIds.add(instructorId);

  let created = 0;
  for (const userId of userIds) {
    const isInstructor = instructorId && String(userId) === String(instructorId);
    const actionUrl = isInstructor
      ? `/instructor/field-training/${opportunityId}/tasks`
      : `/admin/field-training/${opportunityId}/tasks`;
    const row = await createNotificationForUser({
      userId,
      title: 'تسليم مهمة جديد',
      body: `قام الطالب ${studentName || 'طالب'} بتسليم مهمة ${taskTitle || ''}.`,
      type: 'info',
      actionUrl,
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyStudentsTrainingStarted(params) {
  const { studentIds, opportunityId, opportunityTitle } = params;
  let created = 0;
  for (const userId of studentIds) {
    const row = await createNotificationForUser({
      userId,
      title: 'بدء التدريب الميداني',
      body: `بدأ التدريب لفرصة "${opportunityTitle || ''}".`,
      type: 'success',
      actionUrl: `/student/field-training/${opportunityId}?tab=overview`,
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyStudentsNewSession(params) {
  const { studentIds, opportunityId, opportunityTitle, sessionTitle } = params;
  let created = 0;
  for (const userId of studentIds) {
    const row = await createNotificationForUser({
      userId,
      title: 'جلسة تدريب جديدة',
      body: `تمت جدولة جلسة "${sessionTitle || ''}" لفرصة "${opportunityTitle || ''}".`,
      type: 'info',
      actionUrl: `/student/field-training/${opportunityId}?tab=sessions`,
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyStudentsMarkedAbsent(params) {
  const { studentIds, opportunityId, opportunityTitle, sessionTitle } = params;
  let created = 0;
  for (const userId of studentIds) {
    const row = await createNotificationForUser({
      userId,
      title: 'تسجيل غياب',
      body: `تم تسجيل غيابك عن جلسة "${sessionTitle || ''}" في فرصة "${opportunityTitle || ''}".`,
      type: 'warning',
      actionUrl: `/student/field-training/${opportunityId}?tab=attendance`,
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyStudentsAttendanceWindowOpened(params) {
  const {
    opportunityId,
    opportunityTitle,
    sessionTitle,
    sessionId,
    windowId,
    mode,
    durationSeconds,
  } = params;
  const apps = await prisma.field_training_applications.findMany({
    where: {
      opportunity_id: opportunityId,
      status: 'approved',
      expelled_at: null,
      training_status: { not: 'expelled' },
    },
    select: { student_id: true },
  });
  const title =
    mode === 'late' ? 'نافذة حضور للمتأخرين مفتوحة' : 'تسجيل حضور إلكتروني مفتوح الآن';
  const body =
    mode === 'late'
      ? `تم فتح نافذة تسجيل المتأخرين لجلسة "${sessionTitle || ''}" في "${opportunityTitle || ''}" لمدة ${Math.round((durationSeconds || 120) / 60)} دقيقة. أدخل رمز الحضور الآن.`
      : `تم فتح تسجيل الحضور الإلكتروني لجلسة "${sessionTitle || ''}" في "${opportunityTitle || ''}" لمدة ${Math.round((durationSeconds || 120) / 60)} دقيقة. أدخل رمز الحضور الآن.`;

  const studentIds = [...new Set(apps.map((a) => a.student_id).filter(Boolean))];
  if (!studentIds.length) return { created_count: 0 };

  const actionUrl = `/student/field-training/${opportunityId}?tab=sessions&attendanceWindow=${windowId || ''}&sessionId=${sessionId || ''}`;
  let created = 0;
  // Use createNotificationForUser to ensure fanoutPushForRow runs (FCM is sent best-effort).
  for (const userId of studentIds) {
    const row = await createNotificationForUser({
      userId,
      title,
      body,
      type: 'action_required',
      actionUrl,
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyStudentExpelled(params) {
  const { studentId, opportunityId, opportunityTitle, reason } = params;
  return createNotificationForUser({
    userId: studentId,
    title: 'استبعاد من التدريب الميداني',
    body: `تم استبعادك من فرصة "${opportunityTitle || ''}".${reason ? ` السبب: ${reason}` : ''}`,
    type: 'warning',
    actionUrl: `/student/field-training/${opportunityId}?tab=overview`,
  });
}

async function notifyStudentCompletionLetter(params) {
  const { studentId, opportunityId, opportunityTitle } = params;
  return createNotificationForUser({
    userId: studentId,
    title: 'إصدار كتاب إنهاء التدريب',
    body: `تم إصدار كتاب إنهاء التدريب لفرصة "${opportunityTitle || ''}".`,
    type: 'success',
    actionUrl: `/student/field-training/${opportunityId}?tab=completion`,
  });
}

async function staffUserIdsForOpportunity(universityId, instructorId) {
  const userIds = new Set(await findFieldTrainingAdminUserIds(universityId));
  if (instructorId) userIds.add(instructorId);
  return [...userIds];
}

function staffActionUrl(userId, instructorId, opportunityId, adminPath) {
  if (instructorId && String(userId) === String(instructorId)) {
    if (adminPath.includes('/applications')) {
      return `/instructor/field-training/${opportunityId}/manage`;
    }
    return adminPath.replace('/admin/field-training/', '/instructor/field-training/');
  }
  return adminPath;
}

async function notifyStudentsSessionUpdated(params) {
  const { studentIds, opportunityId, opportunityTitle, sessionTitle } = params;
  let created = 0;
  for (const userId of studentIds || []) {
    const row = await createNotificationForUser({
      userId,
      title: 'تحديث جلسة تدريب',
      body: `تم تحديث جلسة "${sessionTitle || ''}" لفرصة "${opportunityTitle || ''}".`,
      type: 'info',
      actionUrl: `/student/field-training/${opportunityId}?tab=sessions`,
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyStudentTaskReviewed(params) {
  const { studentId, opportunityId, opportunityTitle, taskTitle, reviewStatus } = params;
  const statusLabel =
    reviewStatus === 'approved'
      ? 'مقبول'
      : reviewStatus === 'rejected'
        ? 'مرفوض'
        : 'يحتاج تعديل';
  return createNotificationForUser({
    userId: studentId,
    title: 'مراجعة مهمة التدريب الميداني',
    body: `تمت مراجعة مهمة "${taskTitle || ''}" لفرصة "${opportunityTitle || ''}" — الحالة: ${statusLabel}.`,
    type: reviewStatus === 'approved' ? 'success' : 'warning',
    actionUrl: `/student/field-training/${opportunityId}?tab=tasks`,
  });
}

async function notifyStudentsPostAssessmentAvailable(params) {
  const { studentIds, opportunityId, opportunityTitle } = params;
  let created = 0;
  for (const userId of studentIds || []) {
    const row = await createNotificationForUser({
      userId,
      title: 'التقييم البعدي متاح',
      body: `التقييم البعدي متاح الآن لفرصة "${opportunityTitle || ''}".`,
      type: 'action_required',
      actionUrl: `/student/field-training/${opportunityId}?tab=assessments`,
      dedupeByActionUrl: true,
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyStaffPreAssessmentCompleted(params) {
  const { opportunityId, opportunityTitle, universityId, instructorId, studentName, level } = params;
  const userIds = await staffUserIdsForOpportunity(universityId, instructorId);
  let created = 0;
  for (const userId of userIds) {
    const row = await createNotificationForUser({
      userId,
      title: 'إكمال التقييم القبلي',
      body: `${studentName || 'طالب'} أكمل التقييم القبلي لفرصة "${opportunityTitle || ''}"${level ? ` — المستوى: ${level}` : ''}.`,
      type: 'info',
      actionUrl: staffActionUrl(
        userId,
        instructorId,
        opportunityId,
        `/admin/field-training/${opportunityId}/applications`
      ),
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyStaffPostAssessmentCompleted(params) {
  const { opportunityId, opportunityTitle, universityId, instructorId, studentName } = params;
  const userIds = await staffUserIdsForOpportunity(universityId, instructorId);
  let created = 0;
  for (const userId of userIds) {
    const row = await createNotificationForUser({
      userId,
      title: 'إكمال التقييم البعدي',
      body: `${studentName || 'طالب'} أكمل التقييم البعدي لفرصة "${opportunityTitle || ''}".`,
      type: 'info',
      actionUrl: staffActionUrl(
        userId,
        instructorId,
        opportunityId,
        `/admin/field-training/${opportunityId}/applications`
      ),
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyStaffEligibilityReady(params) {
  const { opportunityId, opportunityTitle, universityId, instructorId, studentName } = params;
  const userIds = await staffUserIdsForOpportunity(universityId, instructorId);
  let created = 0;
  for (const userId of userIds) {
    const row = await createNotificationForUser({
      userId,
      title: 'جاهز لإصدار كتاب الإنهاء',
      body: `${studentName || 'طالب'} أصبح مؤهلاً لإصدار كتاب الإنهاء لفرصة "${opportunityTitle || ''}".`,
      type: 'action_required',
      actionUrl: staffActionUrl(
        userId,
        instructorId,
        opportunityId,
        `/admin/field-training/${opportunityId}/applications`
      ),
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyStudentEligibilityUpdated(params) {
  const { studentId, opportunityId, opportunityTitle, eligible } = params;
  return createNotificationForUser({
    userId: studentId,
    title: eligible ? 'أصبحت مؤهلاً لإنهاء التدريب' : 'تحديث حالة الأهلية',
    body: eligible
      ? `أصبحت مؤهلاً لإنهاء التدريب لفرصة "${opportunityTitle || ''}". راجع تبويب الأهلية.`
      : `تم تحديث حالة أهليتك لفرصة "${opportunityTitle || ''}". راجع تبويب الأهلية.`,
    type: eligible ? 'success' : 'info',
    actionUrl: `/student/field-training/${opportunityId}?tab=eligibility`,
  });
}

async function notifyStaffAttendanceRisk(params) {
  const { opportunityId, opportunityTitle, universityId, instructorId, studentName, attendancePercentage, minimumRequired } = params;
  const userIds = await staffUserIdsForOpportunity(universityId, instructorId);
  let created = 0;
  for (const userId of userIds) {
    const row = await createNotificationForUser({
      userId,
      title: 'تنبيه حضور التدريب الميداني',
      body: `حضور ${studentName || 'طالب'} في فرصة "${opportunityTitle || ''}" ${attendancePercentage}% (الحد الأدنى ${minimumRequired}%).`,
      type: 'warning',
      actionUrl: staffActionUrl(
        userId,
        instructorId,
        opportunityId,
        `/admin/field-training/${opportunityId}/manage`
      ),
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyInstructorAssigned(params) {
  const { instructorId, opportunityId, opportunityTitle } = params;
  if (!instructorId) return null;
  return createNotificationForUser({
    userId: instructorId,
    title: 'تم إسناد تدريب ميداني إليك',
    body: `تم تعيينك كمدرب مسؤول عن فرصة "${opportunityTitle || ''}".`,
    type: 'action_required',
    actionUrl: `/instructor/field-training/${opportunityId}/manage`,
  });
}

async function notifyAdminsExpulsionRequested(params) {
  const {
    opportunityId,
    opportunityTitle,
    universityId,
    studentName,
    reason,
    instructorName,
    applicationId,
  } = params;
  const userIds = await findFieldTrainingAdminUserIds(universityId);
  if (!userIds.length) return { created_count: 0 };

  let created = 0;
  for (const userId of userIds) {
    const row = await createNotificationForUser({
      userId,
      title: 'طلب استبعاد طالب من التدريب الميداني',
      body: `طلب المدرب ${instructorName || ''} استبعاد الطالب ${studentName || ''} من فرصة "${opportunityTitle || ''}". السبب: ${reason || ''}`.trim(),
      type: 'action_required',
      actionUrl: `/admin/field-training/${opportunityId}/applications`,
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

module.exports = {
  notifyAdminsFieldTrainingApplicationSubmitted,
  notifyStudentFieldTrainingApplicationApproved,
  notifyStudentFieldTrainingApplicationRejected,
  notifyApprovedStudentsNewTask,
  notifyFieldTrainingTaskSubmitted,
  notifyStudentsTrainingStarted,
  notifyStudentsNewSession,
  notifyStudentsSessionUpdated,
  notifyStudentsMarkedAbsent,
  notifyStudentsAttendanceWindowOpened,
  notifyStudentExpelled,
  notifyStudentCompletionLetter,
  notifyStudentTaskReviewed,
  notifyStudentsPostAssessmentAvailable,
  notifyStaffPreAssessmentCompleted,
  notifyStaffPostAssessmentCompleted,
  notifyStaffEligibilityReady,
  notifyStudentEligibilityUpdated,
  notifyStaffAttendanceRisk,
  notifyInstructorAssigned,
  notifyAdminsExpulsionRequested,
};
