'use strict';

/**
 * Recalculate and persist completion eligibility for تامر وائل نواف العلص.
 *
 * Usage:
 *   node scripts/mark-tamer-eligible.js
 *   node scripts/mark-tamer-eligible.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const workflow = require('../src/modules/fieldTraining/fieldTraining.workflow');
const { recordAudit } = require('../src/utils/auditRecorder');

const APPLY = process.argv.includes('--apply');
const STUDENT_EMAIL = '320220603026@stu.ttu.edu.jo';
const STUDENT_NUMBER = '320220603026';
const APPLICATION_ID = '7d5afdce-e512-4705-94e2-a8d77ebd05e9';
const OPERATION_ID = 'FIELD_TRAINING_MARK_TAMER_ELIGIBLE_V1';

async function findSuperAdminId() {
  const rows = await prisma.$queryRaw`
    SELECT u.id
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id
    WHERE r.code = 'super_admin' AND u.status = 'active'
    LIMIT 1
  `;
  return rows[0]?.id || null;
}

async function main() {
  const student = await prisma.users.findFirst({
    where: { OR: [{ email: STUDENT_EMAIL }, { university_student_number: STUDENT_NUMBER }] },
    select: { id: true, full_name: true, email: true },
  });
  if (!student) throw new Error(`لم يتم العثور على الطالب ${STUDENT_EMAIL}`);

  const before = await prisma.field_training_applications.findUnique({
    where: { id: APPLICATION_ID },
  });
  if (!before || before.student_id !== student.id) {
    throw new Error('تسجيل التدريب الميداني غير مطابق لهذا الطالب');
  }

  const calculated = await workflow.calculateFieldTrainingEligibility(APPLICATION_ID);
  const report = {
    operation: OPERATION_ID,
    apply: APPLY,
    student,
    application_id: APPLICATION_ID,
    before: {
      completion_eligibility_status: before.completion_eligibility_status,
      training_status: before.training_status,
      attendance_percentage: before.attendance_percentage,
      completed_training_hours: before.completed_training_hours,
      post_assessment_score: before.post_assessment_score,
      eligibility_reason: before.eligibility_reason,
    },
    calculated,
  };

  if (!APPLY) {
    console.log(JSON.stringify({ ...report, dry_run: true }, null, 2));
    return;
  }

  const result = await workflow.persistEligibility(APPLICATION_ID);
  if (result.outcome !== 'eligible') {
    throw new Error(`إعادة الحساب لم تنتج مؤهل: ${JSON.stringify(result)}`);
  }

  const after = await prisma.field_training_applications.findUnique({
    where: { id: APPLICATION_ID },
    select: {
      completion_eligibility_status: true,
      training_status: true,
      attendance_percentage: true,
      completed_training_hours: true,
      post_assessment_score: true,
      eligibility_reason: true,
    },
  });

  await recordAudit({
    userId: await findSuperAdminId(),
    actionType: OPERATION_ID,
    entityType: 'field_training_application',
    entityId: APPLICATION_ID,
    oldValues: report.before,
    newValues: after,
  });

  console.log(JSON.stringify({ ...report, after, persist: result }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
