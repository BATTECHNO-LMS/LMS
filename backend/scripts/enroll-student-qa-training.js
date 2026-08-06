/**
 * One-off QA helper: enroll student@batuni.edu in an active field training
 * using raw SQL so missing newer columns on production don't block enrollment.
 *
 * Usage: node scripts/enroll-student-qa-training.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Prisma } = require('@prisma/client');
const { prisma } = require('../src/config/db');

const STUDENT_EMAIL = 'student@batuni.edu';

async function main() {
  const students = await prisma.$queryRaw`
    SELECT id, full_name, email, primary_university_id, specialty_id, university_specialty_id, status
    FROM users
    WHERE email = ${STUDENT_EMAIL}
    LIMIT 1
  `;
  const student = students[0];
  if (!student) throw new Error(`User not found: ${STUDENT_EMAIL}`);
  console.log('[enroll] student', student);

  const existingApps = await prisma.$queryRaw`
    SELECT a.id, a.status::text AS status, a.training_status::text AS training_status,
           a.opportunity_id, o.title
    FROM field_training_applications a
    JOIN field_training_opportunities o ON o.id = a.opportunity_id
    WHERE a.student_id = ${student.id}::uuid
      AND a.status IN ('pending', 'approved')
    ORDER BY a.created_at DESC
  `;
  console.log('[enroll] existing apps', existingApps);

  let opportunities = await prisma.$queryRaw`
    SELECT id, title, status::text AS status, university_id
    FROM field_training_opportunities
    WHERE status IN ('published', 'in_progress')
      AND (university_id = ${student.primary_university_id}::uuid OR university_id IS NULL)
    ORDER BY updated_at DESC
    LIMIT 5
  `;
  if (!opportunities.length) {
    opportunities = await prisma.$queryRaw`
      SELECT id, title, status::text AS status, university_id
      FROM field_training_opportunities
      WHERE status IN ('published', 'in_progress', 'draft')
      ORDER BY updated_at DESC
      LIMIT 5
    `;
  }

  let opportunity = opportunities[0];
  const admins = await prisma.$queryRaw`
    SELECT id, email FROM users
    WHERE email IN (
      'university.admin@batuni.edu',
      'academic.admin@batuni.edu',
      'superadmin@batuni.edu'
    )
    LIMIT 1
  `;
  const adminId = admins[0]?.id ?? null;

  if (!opportunity) {
    const slug = `qa-mobile-ft-${Date.now()}`;
    const created = await prisma.$queryRaw`
      INSERT INTO field_training_opportunities (
        title, slug, organization_name, university_id, specialty_id,
        location, training_mode, short_description, description,
        seats_limit, status, published_at, created_by_id,
        requires_pre_assessment, requires_post_assessment, requires_final_task,
        start_date, end_date
      ) VALUES (
        ${'تدريب ميداني للفحص — BATUNI Student'},
        ${slug},
        ${'BATUNI'},
        ${student.primary_university_id}::uuid,
        ${student.specialty_id}::uuid,
        ${'عمّان'},
        'hybrid'::field_training_mode,
        ${'فرصة فحص لواجهة الجوال'},
        ${'هذا التدريب الميداني للفحص فقط لكي اذا رأه احد من المستخدمين'},
        10,
        'published'::field_training_opportunity_status,
        NOW(),
        ${adminId}::uuid,
        true, true, true,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '90 days'
      )
      RETURNING id, title, status::text AS status, university_id
    `;
    opportunity = created[0];
    console.log('[enroll] created opportunity', opportunity);
  } else {
    if (opportunity.status === 'draft') {
      await prisma.$executeRaw`
        UPDATE field_training_opportunities
        SET status = 'published'::field_training_opportunity_status,
            published_at = NOW(),
            updated_at = NOW()
        WHERE id = ${opportunity.id}::uuid
      `;
      opportunity.status = 'published';
    }
    console.log('[enroll] using opportunity', opportunity);
  }

  if (student.primary_university_id && student.university_specialty_id) {
    await prisma.$executeRaw`
      INSERT INTO field_training_opportunity_eligibility (
        opportunity_id, university_id, university_specialty_id,
        canonical_specialty_id, is_active
      ) VALUES (
        ${opportunity.id}::uuid,
        ${student.primary_university_id}::uuid,
        ${student.university_specialty_id}::uuid,
        ${student.specialty_id}::uuid,
        true
      )
      ON CONFLICT DO NOTHING
    `;
  }

  const upserted = await prisma.$queryRaw`
    INSERT INTO field_training_applications (
      opportunity_id, student_id, status, training_status,
      student_message, admin_note, reviewed_by_id, reviewed_at,
      training_started_at
    ) VALUES (
      ${opportunity.id}::uuid,
      ${student.id}::uuid,
      'approved'::field_training_application_status,
      'in_training'::field_training_training_status,
      ${'تسجيل فحص للواجهة — QA'},
      ${'Approved for mobile QA testing'},
      ${adminId}::uuid,
      NOW(),
      NOW()
    )
    ON CONFLICT (opportunity_id, student_id)
    DO UPDATE SET
      status = 'approved'::field_training_application_status,
      training_status = 'in_training'::field_training_training_status,
      admin_note = EXCLUDED.admin_note,
      reviewed_by_id = EXCLUDED.reviewed_by_id,
      reviewed_at = NOW(),
      training_started_at = COALESCE(field_training_applications.training_started_at, NOW()),
      expelled_at = NULL,
      expulsion_reason = NULL,
      updated_at = NOW()
    RETURNING id, status::text AS status, training_status::text AS training_status, opportunity_id
  `;
  const app = upserted[0];

  const sessionCount = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM field_training_sessions
    WHERE opportunity_id = ${opportunity.id}::uuid
  `;
  if ((sessionCount[0]?.count ?? 0) === 0) {
    await prisma.$executeRaw`
      INSERT INTO field_training_sessions (
        opportunity_id, title, description, session_date, start_time, end_time, created_by_id
      ) VALUES
        (
          ${opportunity.id}::uuid,
          ${'جلسة افتتاحية — فحص'},
          ${'جلسة فحص للواجهة'},
          CURRENT_DATE,
          '09:00',
          '12:00',
          ${adminId}::uuid
        ),
        (
          ${opportunity.id}::uuid,
          ${'جلسة ميدانية — فحص'},
          ${'جلسة فحص للواجهة'},
          CURRENT_DATE + INTERVAL '7 days',
          '10:00',
          '13:00',
          ${adminId}::uuid
        )
    `;
    console.log('[enroll] created 2 QA sessions');
  }

  for (const type of ['pre', 'post']) {
    await prisma.$executeRaw`
      INSERT INTO field_training_assessments (
        opportunity_id, type, title, description, status, passing_score, created_by_id
      ) VALUES (
        ${opportunity.id}::uuid,
        ${type}::field_training_assessment_type,
        ${type === 'pre' ? 'اختبار قبلي — فحص' : 'اختبار بعدي — فحص'},
        ${'تقييم فحص للواجهة'},
        'published'::field_training_assessment_status,
        50,
        ${adminId}::uuid
      )
      ON CONFLICT (opportunity_id, type) DO UPDATE
      SET status = 'published'::field_training_assessment_status,
          updated_at = NOW()
    `;
  }
  console.log('[enroll] assessments ensured');

  console.log('[enroll] DONE', {
    student: student.email,
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    applicationId: app.id,
    status: app.status,
    training_status: app.training_status,
  });
}

main()
  .catch((err) => {
    console.error('[enroll] FAILED', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
