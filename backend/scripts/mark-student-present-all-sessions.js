'use strict';

/**
 * Mark one Tafila field-training student present in every session.
 *
 * Usage:
 *   node scripts/mark-student-present-all-sessions.js
 *   node scripts/mark-student-present-all-sessions.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const workflow = require('../src/modules/fieldTraining/fieldTraining.workflow');
const { recordAudit } = require('../src/utils/auditRecorder');

const APPLY = process.argv.includes('--apply');
const STUDENT_EMAIL = '320220603026@stu.ttu.edu.jo';
const STUDENT_NUMBER = '320220603026';
const REASON = 'تصحيح حضور الطالب تامر وائل نواف العلص في جميع المحاضرات بناءً على طلب الإدارة';
const OPERATION_ID = 'FIELD_TRAINING_MARK_STUDENT_PRESENT_ALL_SESSIONS_V1';

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
    where: {
      OR: [{ email: STUDENT_EMAIL }, { university_student_number: STUDENT_NUMBER }],
    },
    select: { id: true, full_name: true, email: true, university_student_number: true, status: true },
  });
  if (!student) {
    throw new Error(`لم يتم العثور على الطالب ${STUDENT_EMAIL}`);
  }

  const applications = await prisma.field_training_applications.findMany({
    where: { student_id: student.id, status: 'approved' },
    select: {
      id: true,
      opportunity_id: true,
      status: true,
      training_status: true,
      attendance_percentage: true,
      expelled_at: true,
    },
  });
  const opps = await prisma.field_training_opportunities.findMany({
    where: { id: { in: applications.map((row) => row.opportunity_id) } },
    select: { id: true, title: true, status: true },
  });
  const oppById = new Map(opps.map((row) => [row.id, row]));

  const report = {
    operation: OPERATION_ID,
    apply: APPLY,
    student,
    applications: [],
    created: 0,
    updated: 0,
    unchanged: 0,
  };

  const actorId = await findSuperAdminId();
  const now = new Date();

  for (const app of applications) {
    if (app.expelled_at || app.training_status === 'expelled') continue;
    const opportunity = oppById.get(app.opportunity_id);
    const sessions = await prisma.field_training_sessions.findMany({
      where: { opportunity_id: app.opportunity_id },
      select: { id: true, title: true, session_date: true, is_required: true },
      orderBy: [{ session_date: 'asc' }, { start_time: 'asc' }],
    });
    const attendance = await prisma.field_training_attendance.findMany({
      where: { application_id: app.id },
      select: { id: true, session_id: true, status: true },
    });
    const bySession = new Map(attendance.map((row) => [row.session_id, row]));
    const sessionPlan = sessions.map((session) => {
      const current = bySession.get(session.id);
      return {
        sessionId: session.id,
        title: session.title,
        date: session.session_date,
        required: session.is_required !== false,
        currentStatus: current?.status || null,
        action: current?.status === 'present' ? 'unchanged' : current ? 'updated' : 'created',
      };
    });
    report.applications.push({
      applicationId: app.id,
      opportunity: opportunity || { id: app.opportunity_id },
      currentAttendancePercentage: app.attendance_percentage,
      sessions: sessionPlan.length,
      alreadyPresent: sessionPlan.filter((row) => row.action === 'unchanged').length,
      toCreate: sessionPlan.filter((row) => row.action === 'created').length,
      toUpdate: sessionPlan.filter((row) => row.action === 'updated').length,
    });

    if (!APPLY) continue;

    for (const item of sessionPlan) {
      if (item.action === 'unchanged') {
        report.unchanged += 1;
        continue;
      }
      const existing = bySession.get(item.sessionId);
      await prisma.field_training_attendance.upsert({
        where: {
          session_id_application_id: {
            session_id: item.sessionId,
            application_id: app.id,
          },
        },
        create: {
          session_id: item.sessionId,
          application_id: app.id,
          student_id: student.id,
          status: 'present',
          method: 'manual',
          manual_reason: REASON,
          recorded_by_id: actorId,
          recorded_at: now,
          confirmed_at: now,
        },
        update: {
          status: 'present',
          method: 'manual',
          manual_reason: REASON,
          recorded_by_id: actorId,
          recorded_at: now,
          confirmed_at: now,
          updated_at: now,
        },
      });
      await recordAudit({
        userId: actorId,
        actionType: OPERATION_ID,
        entityType: 'field_training_attendance',
        entityId: app.id,
        oldValues: existing ? { status: existing.status, session_id: item.sessionId } : null,
        newValues: {
          status: 'present',
          method: 'manual',
          manual_reason: REASON,
          student_id: student.id,
          enrollment_id: app.id,
          session_id: item.sessionId,
          operation: OPERATION_ID,
        },
      });
      if (item.action === 'created') report.created += 1;
      else report.updated += 1;
    }

    const pct = await workflow.refreshAttendancePercentage(app.id);
    const last = report.applications[report.applications.length - 1];
    last.newAttendancePercentage = pct;
  }

  console.log(JSON.stringify(report, null, 2));
  if (!APPLY) console.error('\nمعاينة فقط. أعد التشغيل مع --apply للتنفيذ.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
