'use strict';

/**
 * Idempotent seed: BATTECHNO INSTITUTION + الدبلوم التشغيلي الرقمي (DRAFT).
 * Run: node scripts/seed-battechno-digital-operational-diploma.js
 *      npm run seed:battechno-diploma
 *
 * Does NOT create users, cohorts, trainers, assessments, or publish the course.
 */

const { prisma } = require('../src/config/db');
const { BATTECHNO_INSTITUTION } = require('../src/modules/organizations/institutionSeedData');

const COURSE_CODE = 'BATTECHNO-DIGITAL-OPERATIONAL-DIPLOMA';
const COURSE_TITLE_AR = 'الدبلوم التشغيلي الرقمي';
const COURSE_TITLE_EN = 'Digital Operational Diploma';

const DESCRIPTION =
  'الدبلوم التشغيلي الرقمي هو برنامج تدريبي يهدف إلى تطوير المهارات الرقمية والتطبيقية والمهنية للمتدربين، من خلال مسار تدريبي منظم يجمع بين التعلم، التطبيق العملي، الاختبارات، الأنشطة، وقياس التقدم، بما يدعم جاهزية المتدرب للاستفادة من المهارات الرقمية في سوق العمل.';

const OBJECTIVE =
  'تأهيل المتدربين بالمهارات الرقمية والتطبيقية اللازمة لتعزيز جاهزيتهم المهنية وقدرتهم على توظيف الأدوات والتقنيات الرقمية في بيئة العمل.';

const OUTCOMES = [
  'فهم المهارات الرقمية الأساسية المرتبطة ببيئة العمل الحديثة.',
  'استخدام الأدوات الرقمية بصورة أكثر كفاءة واحترافية.',
  'تطبيق المعرفة المكتسبة في أنشطة ومهام عملية.',
  'تطوير القدرة على حل المشكلات باستخدام الأدوات والتقنيات الرقمية.',
  'تعزيز الجاهزية المهنية والتعامل مع متطلبات سوق العمل الرقمي.',
];

const TARGET_AUDIENCE =
  'الأفراد الراغبون في تطوير مهاراتهم الرقمية والمهنية ورفع جاهزيتهم لسوق العمل.';

class SeedConflictError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SeedConflictError';
    this.details = details;
  }
}

function orgPayload() {
  return {
    type: 'INSTITUTION',
    name: BATTECHNO_INSTITUTION.name,
    name_en: BATTECHNO_INSTITUTION.nameEn,
    short_name: BATTECHNO_INSTITUTION.shortName,
    code: BATTECHNO_INSTITUTION.code,
    institution_kind: BATTECHNO_INSTITUTION.institutionKind,
    country: BATTECHNO_INSTITUTION.country,
    logo_url: BATTECHNO_INSTITUTION.logoUrl,
    status: 'active',
    allows_public_trainee_registration: BATTECHNO_INSTITUTION.allowsPublicTraineeRegistration,
    updated_at: new Date(),
  };
}

async function resolveOrganization(tx) {
  const db = tx || prisma;
  const byCode = await db.organizations.findUnique({
    where: { code: BATTECHNO_INSTITUTION.code },
  });

  if (byCode) {
    if (byCode.type !== 'INSTITUTION') {
      throw new SeedConflictError(
        `Organization code BATTECHNO exists but type is ${byCode.type} (expected INSTITUTION). Refusing to modify.`,
        { id: byCode.id, type: byCode.type, code: byCode.code, name: byCode.name }
      );
    }
    const updated = await db.organizations.update({
      where: { id: byCode.id },
      data: orgPayload(),
    });
    return { organization: updated, action: 'updated_by_code' };
  }

  const candidates = await db.organizations.findMany({
    where: {
      OR: [
        { code: BATTECHNO_INSTITUTION.code },
        { short_name: BATTECHNO_INSTITUTION.shortName },
        { name_en: BATTECHNO_INSTITUTION.nameEn },
        { name: BATTECHNO_INSTITUTION.name },
        { name: BATTECHNO_INSTITUTION.nameAr },
        { name: { contains: 'الرجل الوطواط للتكنولوجيا' } },
        { name: { contains: 'BATTECHNO', mode: 'insensitive' } },
        { name_en: { contains: 'BATTECHNO', mode: 'insensitive' } },
        { short_name: { contains: 'BATTECHNO', mode: 'insensitive' } },
      ],
    },
    orderBy: { created_at: 'asc' },
  });
  const nonCodeMatches = candidates.filter((c) => c.code !== BATTECHNO_INSTITUTION.code);

  for (const row of nonCodeMatches) {
    if (row.type === 'UNIVERSITY') {
      throw new SeedConflictError(
        'Found a UNIVERSITY organization matching BATTECHNO naming. Refusing to create a duplicate INSTITUTION or convert the university.',
        { id: row.id, type: row.type, code: row.code, name: row.name }
      );
    }
    if (row.code && row.code !== BATTECHNO_INSTITUTION.code) {
      throw new SeedConflictError(
        `Found existing BATTECHNO-like organization with a different stable code (${row.code}). Stopped to avoid a duplicate.`,
        { id: row.id, type: row.type, code: row.code, name: row.name, nameEn: row.name_en, shortName: row.short_name }
      );
    }
  }

  const reconcileTarget = nonCodeMatches.find(
    (row) =>
      row.type === 'INSTITUTION' &&
      (!row.code || row.code === BATTECHNO_INSTITUTION.code)
  );

  if (reconcileTarget) {
    const updated = await db.organizations.update({
      where: { id: reconcileTarget.id },
      data: orgPayload(),
    });
    return {
      organization: updated,
      action: 'reconciled_by_name',
      previousCode: reconcileTarget.code,
    };
  }

  const created = await db.organizations.create({
    data: {
      type: 'INSTITUTION',
      name: BATTECHNO_INSTITUTION.name,
      name_en: BATTECHNO_INSTITUTION.nameEn,
      short_name: BATTECHNO_INSTITUTION.shortName,
      code: BATTECHNO_INSTITUTION.code,
      institution_kind: BATTECHNO_INSTITUTION.institutionKind,
      country: BATTECHNO_INSTITUTION.country,
      logo_url: BATTECHNO_INSTITUTION.logoUrl,
      status: 'active',
      allows_public_trainee_registration: BATTECHNO_INSTITUTION.allowsPublicTraineeRegistration,
    },
  });
  return { organization: created, action: 'created' };
}

async function upsertBranches(tx, organizationId, branches) {
  const db = tx || prisma;
  const results = [];
  for (let i = 0; i < branches.length; i += 1) {
    const branch = branches[i];
    const existing = await db.organization_branches.findFirst({
      where: {
        organization_id: organizationId,
        OR: [{ code: branch.code }, { name: branch.name }],
      },
    });

    if (existing) {
      const updated = await db.organization_branches.update({
        where: { id: existing.id },
        data: {
          code: branch.code,
          name: branch.name,
          name_en: branch.nameEn || null,
          city: branch.city || null,
          address: branch.address || null,
          sort_order: i + 1,
          is_active: true,
          updated_at: new Date(),
        },
      });
      results.push({
        code: branch.code,
        action: existing.code === branch.code ? 'updated' : 'reconciled',
        id: updated.id,
      });
    } else {
      const created = await db.organization_branches.create({
        data: {
          organization_id: organizationId,
          code: branch.code,
          name: branch.name,
          name_en: branch.nameEn || null,
          city: branch.city || null,
          address: branch.address || null,
          sort_order: i + 1,
          is_active: true,
        },
      });
      results.push({ code: branch.code, action: 'created', id: created.id });
    }
  }
  return results;
}

function courseSettings(existingSettings) {
  const prev =
    existingSettings && typeof existingSettings === 'object' && !Array.isArray(existingSettings)
      ? existingSettings
      : {};
  return {
    ...prev,
    titleEn: COURSE_TITLE_EN,
    titleAr: COURSE_TITLE_AR,
    targetAudience: TARGET_AUDIENCE,
    shortDescription: DESCRIPTION.slice(0, 220),
    // Compatible with final-evaluation / completion engine later; not mandatory until configured.
    certificateEnabled: false,
    enrollment: {
      ...(prev.enrollment && typeof prev.enrollment === 'object' ? prev.enrollment : {}),
      institutionTraineesOnly: true,
      approvalRequired: true,
      publicRegistration: false,
      invitationAllowed: true,
    },
  };
}

async function resolveCourse(tx, organization) {
  const db = tx || prisma;
  const existing = await db.training_programs.findUnique({
    where: { code: COURSE_CODE },
  });

  const contentData = {
    organization_id: organization.id,
    type: 'TRAINING_COURSE',
    code: COURSE_CODE,
    title: COURSE_TITLE_AR,
    description: DESCRIPTION,
    objectives: OBJECTIVE,
    outcomes: OUTCOMES.map((o, i) => `${i + 1}. ${o}`).join('\n'),
    updated_at: new Date(),
  };

  if (existing) {
    if (existing.organization_id !== organization.id) {
      throw new SeedConflictError(
        `Course code ${COURSE_CODE} already belongs to another organization.`,
        {
          courseId: existing.id,
          courseCode: existing.code,
          organizationId: existing.organization_id,
          expectedOrganizationId: organization.id,
        }
      );
    }
    const updated = await db.training_programs.update({
      where: { id: existing.id },
      data: {
        ...contentData,
        // Do not force DRAFT over a later admin status; never invent operational fields on update.
        settings_json: courseSettings(existing.settings_json),
      },
    });
    return {
      program: updated,
      action: 'updated',
      preservedStatus: updated.status,
    };
  }

  const created = await db.training_programs.create({
    data: {
      ...contentData,
      status: 'DRAFT',
      // Intentionally unconfigured (null) — do not invent operational data.
      start_date: null,
      end_date: null,
      required_hours: null,
      delivery_mode: null,
      max_participants: null,
      required_attendance_pct: null,
      settings_json: courseSettings(null),
    },
  });
  return { program: created, action: 'created' };
}

async function verifyInvariants(organization, program, branchResults) {
  const orgCount = await prisma.organizations.count({
    where: { code: BATTECHNO_INSTITUTION.code },
  });
  const courseCount = await prisma.training_programs.count({
    where: { code: COURSE_CODE },
  });
  const ammanBranchCount = await prisma.organization_branches.count({
    where: {
      organization_id: organization.id,
      code: 'BATTECHNO_AMMAN',
      is_active: true,
    },
  });
  const cohorts = await prisma.training_cohorts.count({
    where: { program_id: program.id },
  });
  const trainers = await prisma.training_trainer_assignments.count({
    where: { training_program_id: program.id },
  });
  const enrollments = await prisma.training_enrollments.count({
    where: {
      training_cohorts: { program_id: program.id },
    },
  });

  const checks = {
    orgExistsOnce: orgCount === 1,
    orgCode: organization.code === 'BATTECHNO',
    orgType: organization.type === 'INSTITUTION',
    orgName: organization.name === BATTECHNO_INSTITUTION.name,
    courseExistsOnce: courseCount === 1,
    courseCode: program.code === COURSE_CODE,
    courseTitle: program.title === COURSE_TITLE_AR,
    courseType: program.type === 'TRAINING_COURSE',
    courseOrgLink: program.organization_id === organization.id,
    courseStatusDraftOrPreserved: Boolean(program.status),
    ammanBranchExists: ammanBranchCount === 1,
    expectedBranchesSeeded: Array.isArray(branchResults) && branchResults.length === BATTECHNO_INSTITUTION.branches.length,
  };

  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([k]) => k);

  return { checks, failed, cohorts, trainers, enrollments, ammanBranchCount };
}

async function main() {
  const report = {
    ok: false,
    organization: null,
    course: null,
    defaultsUsed: {
      organizationStatus: 'active',
      organizationCountry: BATTECHNO_INSTITUTION.country,
      institutionKind: BATTECHNO_INSTITUTION.institutionKind,
      allowsPublicTraineeRegistration: false,
      logoUrl: null,
      courseStatus: 'DRAFT',
      certificateEnabled: false,
    },
    intentionallyUnconfigured: [
      'start_date',
      'end_date',
      'required_hours',
      'delivery_mode',
      'max_participants',
      'required_attendance_pct',
      'cohort',
      'trainer',
      'pre_test',
      'post_test',
      'final_evaluation',
      'completion_requirements',
      'certificate_requirements',
    ],
    verification: null,
    migration: 'none (existing schema sufficient)',
  };

  const result = await prisma.$transaction(async (tx) => {
    const orgResolved = await resolveOrganization(tx);
    const branches = await upsertBranches(
      tx,
      orgResolved.organization.id,
      BATTECHNO_INSTITUTION.branches
    );
    const courseResolved = await resolveCourse(tx, orgResolved.organization);
    return { orgResolved, courseResolved, branches };
  });

  const { organization, action: orgAction, previousCode } = result.orgResolved;
  const { program, action: courseAction, preservedStatus } = result.courseResolved;
  const verification = await verifyInvariants(organization, program, result.branches);

  report.organization = {
    id: organization.id,
    code: organization.code,
    type: organization.type,
    name: organization.name,
    nameEn: organization.name_en,
    shortName: organization.short_name,
    status: organization.status,
    action: orgAction,
    previousCode: previousCode || null,
    existed: orgAction !== 'created',
  };
  report.branches = result.branches;
  report.course = {
    id: program.id,
    code: program.code,
    title: program.title,
    titleEn: COURSE_TITLE_EN,
    type: program.type,
    status: program.status,
    organizationId: program.organization_id,
    action: courseAction,
    preservedStatus: preservedStatus || null,
    existed: courseAction !== 'created',
  };
  report.verification = verification;
  report.ok = verification.failed.length === 0;

  if (!report.ok) {
    throw new Error(`Verification failed: ${verification.failed.join(', ')}`);
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(
      err instanceof SeedConflictError
        ? JSON.stringify({ ok: false, conflict: true, message: err.message, details: err.details }, null, 2)
        : err
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
