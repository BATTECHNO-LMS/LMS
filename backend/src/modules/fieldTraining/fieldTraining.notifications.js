const { prisma } = require('../../config/db');
const { env } = require('../../config/env');
const {
  createNotificationForUser,
  createNotificationsForUsers,
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
  return createNotificationsForUsers({
    userIds,
    title: 'طلب تدريب ميداني جديد',
    body: `قدّم الطالب ${studentName || ''} طلبًا على فرصة "${opportunityTitle || ''}".`.trim(),
    type: 'action_required',
    actionUrl: `/admin/field-training/${opportunityId}/applications`,
  });
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
  return createNotificationsForUsers({
    userIds,
    title: 'مهمة تدريب ميداني جديدة',
    body: `تمت إضافة مهمة "${taskTitle || ''}" لفرصة "${opportunityTitle || ''}".`,
    type: 'info',
    actionUrl: `/student/field-training/${opportunityId}?tab=tasks`,
  });
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
  const uniqueIds = [...new Set((studentIds || []).filter(Boolean))];
  if (!uniqueIds.length) return { created_count: 0 };

  const title = 'بدء التدريب الميداني';
  const body = `بدأ التدريب لفرصة "${opportunityTitle || ''}".`;
  const actionUrl = `/student/field-training/${opportunityId}?tab=overview`;
  const rows = uniqueIds.map((userId) => ({
    user_id: userId,
    title,
    body,
    type: 'success',
    action_url: actionUrl,
  }));

  try {
    const result = await prisma.notifications.createMany({ data: rows });
    return { created_count: result.count };
  } catch (_bulkErr) {
    let created = 0;
    for (const userId of uniqueIds) {
      const row = await createNotificationForUser({
        userId,
        title,
        body,
        type: 'success',
        actionUrl,
      });
      if (row) created += 1;
    }
    return { created_count: created };
  }
}

async function notifyStudentsNewSession(params) {
  const { studentIds, opportunityId, opportunityTitle, sessionTitle } = params;
  return createNotificationsForUsers({
    userIds: studentIds,
    title: 'جلسة تدريب جديدة',
    body: `تمت جدولة جلسة "${sessionTitle || ''}" لفرصة "${opportunityTitle || ''}".`,
    type: 'info',
    actionUrl: `/student/field-training/${opportunityId}?tab=sessions`,
  });
}

async function notifyStudentsMarkedAbsent(params) {
  const { studentIds, opportunityId, opportunityTitle, sessionTitle } = params;
  return createNotificationsForUsers({
    userIds: studentIds,
    title: 'تسجيل غياب',
    body: `تم تسجيل غيابك عن جلسة "${sessionTitle || ''}" في فرصة "${opportunityTitle || ''}".`,
    type: 'warning',
    actionUrl: `/student/field-training/${opportunityId}?tab=attendance`,
  });
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
  return createNotificationsForUsers({
    userIds: studentIds,
    title,
    body,
    type: 'action_required',
    actionUrl,
  });
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
  return createNotificationsForUsers({
    userIds: studentIds,
    title: 'تحديث جلسة تدريب',
    body: `تم تحديث جلسة "${sessionTitle || ''}" لفرصة "${opportunityTitle || ''}".`,
    type: 'info',
    actionUrl: `/student/field-training/${opportunityId}?tab=sessions`,
  });
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
  return createNotificationsForUsers({
    userIds: studentIds,
    title: 'التقييم البعدي متاح',
    body: `التقييم البعدي متاح الآن لفرصة "${opportunityTitle || ''}".`,
    type: 'action_required',
    actionUrl: `/student/field-training/${opportunityId}?tab=assessments`,
    dedupeByActionUrl: true,
  });
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
  return createNotificationsForUsers({
    userIds,
    title: 'طلب استبعاد طالب من التدريب الميداني',
    body: `طلب المدرب ${instructorName || ''} استبعاد الطالب ${studentName || ''} من فرصة "${opportunityTitle || ''}". السبب: ${reason || ''}`.trim(),
    type: 'action_required',
    actionUrl: `/admin/field-training/${opportunityId}/applications`,
  });
}

async function notifyLogbookSubmitted(params) {
  const {
    opportunityId,
    opportunityTitle,
    universityId,
    studentId,
    entryId,
    instructorId,
    isResubmission,
  } = params;
  const adminIds = await findFieldTrainingAdminUserIds(universityId);
  const userIds = [...new Set([...(instructorId ? [instructorId] : []), ...adminIds])];
  const title = isResubmission
    ? 'إعادة إرسال سجل تدريب للمراجعة'
    : 'سجل تدريب بانتظار المراجعة';
  await createNotificationsForUsers({
    userIds,
    title,
    body: `يوجد سجل تدريب ${isResubmission ? 'مُعاد إرساله' : 'جديد'} بانتظار المراجعة لفرصة "${opportunityTitle || ''}".`,
    type: 'action_required',
    actionUrl: `/admin/field-training/${opportunityId}/manage?tab=command_center&quick_filter=logbook_pending`,
  });
  // Also notify academic supervisor if assigned
  try {
    const app = await prisma.field_training_applications.findFirst({
      where: { opportunity_id: opportunityId, student_id: studentId },
      select: { id: true },
    });
    if (app?.id) {
      const assignment = await prisma.field_training_academic_supervisor_assignments.findUnique({
        where: { application_id: app.id },
        select: { supervisor_user_id: true },
      });
      if (assignment?.supervisor_user_id) {
        await createNotificationForUser({
          userId: assignment.supervisor_user_id,
          title,
          body: entryId
            ? 'سجل تدريب بانتظار مراجعتك.'
            : 'سجل تدريب بانتظار مراجعتك.',
          type: 'action_required',
          actionUrl: `/admin/field-training/${opportunityId}/manage?tab=command_center&quick_filter=logbook_pending`,
          dedupeByActionUrl: true,
        });
      }
    }
  } catch {
    /* best-effort */
  }
}

async function notifyLogbookRevisionRequested(params) {
  const { studentId, opportunityId, comment } = params;
  return createNotificationForUser({
    userId: studentId,
    title: 'طلب تعديل على سجل التدريب',
    body: comment
      ? `يرجى تعديل سجل التدريب: ${String(comment).slice(0, 180)}`
      : 'طلب المشرف تعديلاً على أحد سجلات التدريب.',
    type: 'warning',
    actionUrl: `/student/field-training/${opportunityId}?tab=logbook`,
  });
}

async function notifyLogbookApproved(params) {
  const { studentId, opportunityId } = params;
  return createNotificationForUser({
    userId: studentId,
    title: 'تم اعتماد سجل التدريب',
    body: 'تم اعتماد أحد سجلات التدريب الخاصة بك.',
    type: 'success',
    actionUrl: `/student/field-training/${opportunityId}?tab=logbook`,
  });
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
  notifyLogbookSubmitted,
  notifyLogbookRevisionRequested,
  notifyLogbookApproved,
};
