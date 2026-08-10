'use strict';

/**
 * Idempotent configure: update BATTECHNO Digital Operational Diploma + primary trainer.
 * Run:
 *   $env:BATTECHNO_TRAINER1_INITIAL_PASSWORD='…'; npm run seed:battechno-diploma-configure
 *
 * Password is read from env only (never hardcoded). Used solely when creating a new user.
 */

const { prisma } = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');
const { BATTECHNO_INSTITUTION } = require('../src/modules/organizations/institutionSeedData');

const COURSE_CODE = 'BATTECHNO-DIGITAL-OPERATIONAL-DIPLOMA';
const TRAINER_EMAIL = 'trainer1@battechno.com';
const TRAINER_TEMP_NAME = 'مدرب BATTECHNO 1';
const DOMAINS = Object.freeze(['كتابة المحتوى', 'التصميم', 'البرمجة']);
const FIELD_TEXT = 'كتابة المحتوى، التصميم، البرمجة';
const START_DATE = '2026-08-02';
const END_DATE = '2026-11-12';
const TIMEZONE = 'Asia/Amman';

class SeedConflictError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SeedConflictError';
    this.details = details;
  }
}

/** Store calendar dates without local-TZ shift (UTC date-only). */
function dateOnlyUtc(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function mergeSettings(existing) {
  const prev =
    existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  return {
    ...prev,
    domains: [...DOMAINS],
    timezone: TIMEZONE,
    titleAr: prev.titleAr || 'الدبلوم التشغيلي الرقمي',
    titleEn: prev.titleEn || 'Digital Operational Diploma',
  };
}

async function resolveOrganization() {
  const org = await prisma.organizations.findUnique({ where: { code: 'BATTECHNO' } });
  if (!org) {
    throw new SeedConflictError('BATTECHNO organization not found. Run npm run seed:battechno-diploma first.');
  }
  if (org.type !== 'INSTITUTION') {
    throw new SeedConflictError(`BATTECHNO organization type is ${org.type}, expected INSTITUTION.`, {
      id: org.id,
      type: org.type,
    });
  }
  return org;
}

async function resolveCourse(organizationId) {
  const rows = await prisma.training_programs.findMany({
    where: { code: COURSE_CODE },
  });
  if (rows.length > 1) {
    throw new SeedConflictError(`Multiple courses share code ${COURSE_CODE}.`, {
      ids: rows.map((r) => r.id),
    });
  }
  if (!rows.length) {
    throw new SeedConflictError(`Course ${COURSE_CODE} not found. Run npm run seed:battechno-diploma first.`);
  }
  const course = rows[0];
  if (course.organization_id !== organizationId) {
    throw new SeedConflictError('Course belongs to a different organization.', {
      courseId: course.id,
      organizationId: course.organization_id,
      expectedOrganizationId: organizationId,
    });
  }
  return course;
}

async function ensureTrainerRole(userId, tx) {
  const db = tx || prisma;
  const role = await db.roles.findUnique({ where: { code: 'trainer' } });
  if (!role) throw new SeedConflictError('Role trainer is not configured in roles table.');
  const link = await db.user_roles.findFirst({ where: { user_id: userId, role_id: role.id } });
  if (!link) {
    await db.user_roles.create({ data: { user_id: userId, role_id: role.id } });
  }
  return role;
}

async function resolveTrainerUser(tx, organizationId) {
  const db = tx || prisma;
  const email = TRAINER_EMAIL.toLowerCase();
  let user = await db.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });

  let action = 'reused';
  if (!user) {
    const initialPassword = process.env.BATTECHNO_TRAINER1_INITIAL_PASSWORD;
    if (!initialPassword || String(initialPassword).length < 8) {
      throw new SeedConflictError(
        'Missing BATTECHNO_TRAINER1_INITIAL_PASSWORD env (min 8 chars) required to create trainer account.'
      );
    }
    const password_hash = await hashPassword(String(initialPassword));
    const now = new Date();
    user = await db.users.create({
      data: {
        full_name: TRAINER_TEMP_NAME,
        email,
        password_hash,
        phone: null,
        status: 'active',
        email_verified_at: now,
        activated_at: now,
        preferred_organization_id: organizationId,
      },
    });
    action = 'created';
  } else {
    // Conflict if exclusive active assignment to another institution
    const otherInst = await db.user_organization_assignments.findFirst({
      where: {
        user_id: user.id,
        is_active: true,
        organization_id: { not: organizationId },
        organizations: { type: 'INSTITUTION' },
      },
      include: { organizations: { select: { id: true, code: true, name: true, type: true } } },
    });
    if (otherInst) {
      throw new SeedConflictError(
        'trainer1@battechno.com is actively assigned to another institution.',
        {
          userId: user.id,
          otherOrganization: otherInst.organizations,
        }
      );
    }

    // Ensure temporary name only if blank-like; do not invent other PII
    const patch = {
      preferred_organization_id: organizationId,
      status: 'active',
      updated_at: new Date(),
      ...(user.activated_at ? {} : { activated_at: new Date() }),
      ...(user.email_verified_at ? {} : { email_verified_at: new Date() }),
      ...(!user.full_name || !String(user.full_name).trim()
        ? { full_name: TRAINER_TEMP_NAME }
        : {}),
    };
    user = await db.users.update({ where: { id: user.id }, data: patch });
  }

  await ensureTrainerRole(user.id, db);

  // Do not promote to admin/super_admin — strip those roles if somehow present? User said don't silently overwrite.
  // Only ensure trainer role exists; leave other roles intact unless they're dangerous promotions we created.
  // Spec: Never promote to admin/super_admin. We simply never add those.

  let orgAssignment = await db.user_organization_assignments.findFirst({
    where: { user_id: user.id, organization_id: organizationId, role_code: 'trainer' },
  });
  if (orgAssignment) {
    orgAssignment = await db.user_organization_assignments.update({
      where: { id: orgAssignment.id },
      data: { is_active: true, updated_at: new Date() },
    });
  } else {
    // Deactivate other trainer assignments on this org with different roles? Keep other roles if any.
    orgAssignment = await db.user_organization_assignments.create({
      data: {
        user_id: user.id,
        organization_id: organizationId,
        role_code: 'trainer',
        is_active: true,
      },
    });
  }

  return { user, orgAssignment, action };
}

async function assignPrimaryTrainer(tx, { organizationId, programId, trainerUserId }) {
  const db = tx || prisma;

  // Clear lead flag on other active assignments for this program (additive safety for single primary).
  await db.training_trainer_assignments.updateMany({
    where: {
      training_program_id: programId,
      is_active: true,
      revoked_at: null,
      trainer_user_id: { not: trainerUserId },
      is_lead_trainer: true,
    },
    data: { is_lead_trainer: false, updated_at: new Date() },
  });

  const existing = await db.training_trainer_assignments.findFirst({
    where: {
      trainer_user_id: trainerUserId,
      training_program_id: programId,
      training_cohort_id: null,
      is_active: true,
      revoked_at: null,
    },
  });

  const permDefaults = {
    is_lead_trainer: true,
    can_manage_sessions: true,
    can_manage_attendance: true,
    can_manage_materials: true,
    can_manage_tasks: true,
    can_grade_tasks: true,
    can_manage_assessments: true,
    can_grade_assessments: true,
    can_view_trainees: true,
    can_view_progress: true,
    can_view_reports: true,
    can_finalize_training: true,
    can_send_course_announcements: true,
  };

  if (existing) {
    const updated = await db.training_trainer_assignments.update({
      where: { id: existing.id },
      data: { ...permDefaults, updated_at: new Date() },
    });
    return { assignment: updated, action: 'updated' };
  }

  const created = await db.training_trainer_assignments.create({
    data: {
      trainer_user_id: trainerUserId,
      organization_id: organizationId,
      training_program_id: programId,
      training_cohort_id: null,
      ...permDefaults,
    },
  });
  return { assignment: created, action: 'created' };
}

async function main() {
  const org = await resolveOrganization();
  const courseBefore = await resolveCourse(org.id);

  const result = await prisma.$transaction(async (tx) => {
    // Preserve published operational values; default capacity is 10 when previously unset.
    const capacity =
      courseBefore.max_participants != null ? courseBefore.max_participants : 10;
    const hours =
      courseBefore.required_hours != null ? courseBefore.required_hours : 110;
    const attendance =
      courseBefore.required_attendance_pct != null
        ? courseBefore.required_attendance_pct
        : 80;

    const course = await tx.training_programs.update({
      where: { id: courseBefore.id },
      data: {
        field: FIELD_TEXT,
        start_date: dateOnlyUtc(START_DATE),
        end_date: dateOnlyUtc(END_DATE),
        required_hours: hours,
        required_attendance_pct: attendance,
        max_participants: capacity,
        status: 'PUBLISHED',
        settings_json: mergeSettings(courseBefore.settings_json),
        updated_at: new Date(),
      },
    });

    const trainerResolved = await resolveTrainerUser(tx, org.id);
    const trainerAssign = await assignPrimaryTrainer(tx, {
      organizationId: org.id,
      programId: course.id,
      trainerUserId: trainerResolved.user.id,
    });

    return { course, trainerResolved, trainerAssign };
  });

  // Post-verify (outside tx)
  const verify = {
    orgCount: await prisma.organizations.count({ where: { code: 'BATTECHNO' } }),
    courseCount: await prisma.training_programs.count({ where: { code: COURSE_CODE } }),
    trainerCount: await prisma.users.count({
      where: { email: { equals: TRAINER_EMAIL, mode: 'insensitive' } },
    }),
    start: result.course.start_date,
    end: result.course.end_date,
    hours: result.course.required_hours,
    attendance: result.course.required_attendance_pct,
    capacity: result.course.max_participants,
    status: result.course.status,
    field: result.course.field,
    isLead: result.trainerAssign.assignment.is_lead_trainer,
    passwordIsHash: Boolean(result.trainerResolved.user.password_hash)
      && !String(result.trainerResolved.user.password_hash).includes('12345678'),
  };

  const roleLinks = await prisma.user_roles.findMany({
    where: { user_id: result.trainerResolved.user.id },
    select: { role_id: true },
  });
  const roleRows = roleLinks.length
    ? await prisma.roles.findMany({
        where: { id: { in: roleLinks.map((r) => r.role_id) } },
        select: { code: true },
      })
    : [];
  const roleCodes = roleRows.map((r) => r.code);

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        organization: {
          id: org.id,
          code: org.code,
          type: org.type,
          name: org.name,
          expectedName: BATTECHNO_INSTITUTION.name,
        },
        course: {
          id: result.course.id,
          code: result.course.code,
          title: result.course.title,
          status: result.course.status,
          startDate: START_DATE,
          endDate: END_DATE,
          requiredHours: Number(result.course.required_hours),
          requiredAttendancePct: Number(result.course.required_attendance_pct),
          maxParticipants: result.course.max_participants,
          field: result.course.field,
          domains: DOMAINS,
          timezone: TIMEZONE,
          level: result.course.level,
          language: result.course.language,
          deliveryMode: result.course.delivery_mode,
        },
        trainer: {
          action: result.trainerResolved.action,
          userId: result.trainerResolved.user.id,
          email: result.trainerResolved.user.email,
          fullName: result.trainerResolved.user.full_name,
          temporaryFullName: result.trainerResolved.user.full_name === TRAINER_TEMP_NAME,
          roleCodes,
          organizationAssignmentId: result.trainerResolved.orgAssignment.id,
          organizationRole: result.trainerResolved.orgAssignment.role_code,
          organizationAssignmentActive: result.trainerResolved.orgAssignment.is_active,
          primaryAssignmentId: result.trainerAssign.assignment.id,
          primaryAssignmentAction: result.trainerAssign.action,
          isLeadTrainer: result.trainerAssign.assignment.is_lead_trainer,
          passwordConfigured: result.trainerResolved.action === 'created',
          passwordHashing: 'bcrypt (src/utils/password.js, salt rounds 10)',
          forcePasswordChangeSupport: false,
        },
        verify,
        remainingUnconfigured: ['level', 'language', 'delivery_mode'].filter(
          (k) => result.course[k] == null
        ),
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    // Never print env password if present
    // eslint-disable-next-line no-console
    console.error(
      err instanceof SeedConflictError
        ? JSON.stringify({ ok: false, conflict: true, message: err.message, details: err.details }, null, 2)
        : err
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
