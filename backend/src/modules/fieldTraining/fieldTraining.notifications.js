const { prisma } = require('../../config/db');
const { env } = require('../../config/env');
const {
  createNotificationForUser,
  userIdsByRoleCodes,
} = require('../../shared/services/notification.service');

async function findFieldTrainingAdminUserIds(universityId) {
  const superIds = await userIdsByRoleCodes([env.SUPER_ADMIN_ROLE_CODE || 'super_admin']);
  const uniAdminIds = universityId
    ? await userIdsByRoleCodes(['university_admin'], { universityId })
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
    body: `تمت الموافقة على طلبك للفرصة "${opportunityTitle || ''}". يمكنك الآن تنفيذ المهام.`,
    type: 'success',
    actionUrl: `/student/field-training/${opportunityId}`,
  });
}

async function notifyStudentFieldTrainingApplicationRejected(params) {
  const { studentId, opportunityId, opportunityTitle } = params;
  return createNotificationForUser({
    userId: studentId,
    title: 'تم رفض طلب التدريب الميداني',
    body: `تم رفض طلبك للفرصة "${opportunityTitle || ''}". راجع الملاحظات الإدارية للتفاصيل.`,
    type: 'warning',
    actionUrl: `/student/field-training/${opportunityId}`,
  });
}

async function notifyApprovedStudentsNewTask(params) {
  const { opportunityId, opportunityTitle, taskTitle } = params;
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunityId, status: 'approved' },
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
      actionUrl: `/student/field-training/${opportunityId}`,
    });
    if (row) created += 1;
  }
  return { created_count: created };
}

async function notifyAdminsFieldTrainingTaskSubmitted(params) {
  const { opportunityId, opportunityTitle, universityId, studentName, taskTitle } = params;
  const userIds = await findFieldTrainingAdminUserIds(universityId);
  if (!userIds.length) return { created_count: 0 };

  let created = 0;
  for (const userId of userIds) {
    const row = await createNotificationForUser({
      userId,
      title: 'تسليم مهمة تدريب ميداني',
      body: `${studentName || 'طالب'} سلّم مهمة "${taskTitle || ''}" للفرصة "${opportunityTitle || ''}".`,
      type: 'info',
      actionUrl: `/admin/field-training/${opportunityId}/tasks`,
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
  notifyAdminsFieldTrainingTaskSubmitted,
};
