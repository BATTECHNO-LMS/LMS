const { prisma } = require('../../src/config/db');
const {
  REAL_BASELINE_MARKER,
  DEMO_ANALYTICS_MARKER,
  DEMO_UNIVERSITY_NAMES,
  DEMO_EMAIL_SUFFIXES,
  DEMO_TRACK_PREFIXES,
  DEMO_MC_PREFIXES,
  DEMO_COURSE_SLUG_PREFIX,
  DEMO_FT_SLUG_PREFIX,
} = require('./baselineCatalog');
const { TEST_ACCOUNTS_MARKER } = require('./testAccountsCatalog');

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[cleanup-demo] ${msg}`);
}

async function findProtectedUniversityIds() {
  const rows = await prisma.universities.findMany({
    where: {
      OR: [
        { notes: { contains: REAL_BASELINE_MARKER } },
        { notes: { contains: TEST_ACCOUNTS_MARKER } },
      ],
    },
    select: { id: true, name: true },
  });
  return rows;
}

async function findDemoUniversityIds() {
  const protectedIds = new Set((await findProtectedUniversityIds()).map((r) => r.id));

  const analytics = await prisma.universities.findMany({
    where: { notes: { contains: DEMO_ANALYTICS_MARKER } },
    select: { id: true, name: true },
  });

  const byName = DEMO_UNIVERSITY_NAMES.length
    ? await prisma.universities.findMany({
        where: { name: { in: DEMO_UNIVERSITY_NAMES } },
        select: { id: true, name: true },
      })
    : [];

  const demoNamed = await prisma.universities.findMany({
    where: {
      OR: [
        { name: { startsWith: 'Demo Analytics University', mode: 'insensitive' } },
        { name: { contains: 'Demo LMS', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });

  const map = new Map();
  for (const row of [...analytics, ...byName, ...demoNamed]) {
    if (protectedIds.has(row.id)) continue;
    map.set(row.id, row.name);
  }
  return [...map.entries()].map(([id, name]) => ({ id, name }));
}

async function findDemoUserIds(demoUniIds) {
  const emailOr = DEMO_EMAIL_SUFFIXES.map((suffix) => ({
    email: suffix.startsWith('@') ? { endsWith: suffix } : { endsWith: suffix },
  }));

  emailOr.push({ email: { contains: '.demo.', mode: 'insensitive' } });
  emailOr.push({ email: { startsWith: 'demo.', mode: 'insensitive' } });

  const users = await prisma.users.findMany({
    where: {
      OR: [
        ...(demoUniIds.length ? [{ primary_university_id: { in: demoUniIds } }] : []),
        ...emailOr,
      ],
    },
    select: { id: true, email: true },
  });

  return users;
}

async function findDemoTrackIds() {
  const or = DEMO_TRACK_PREFIXES.map((prefix) => ({ code: { startsWith: prefix } }));
  if (!or.length) return [];
  return prisma.tracks.findMany({ where: { OR: or }, select: { id: true, code: true } });
}

async function findDemoMicroCredentialIds() {
  const or = DEMO_MC_PREFIXES.map((prefix) => ({ code: { startsWith: prefix } }));
  if (!or.length) return [];
  return prisma.micro_credentials.findMany({ where: { OR: or }, select: { id: true, code: true } });
}

async function findDemoCourseIds() {
  return prisma.courses.findMany({
    where: { slug: { startsWith: DEMO_COURSE_SLUG_PREFIX } },
    select: { id: true, slug: true },
  });
}

async function findDemoFieldTrainingIds() {
  return prisma.field_training_opportunities.findMany({
    where: {
      OR: [
        { slug: { startsWith: DEMO_FT_SLUG_PREFIX } },
        { title: { startsWith: 'Demo Field Training', mode: 'insensitive' } },
      ],
    },
    select: { id: true, title: true },
  });
}

async function collectDemoCleanupPlan() {
  const demoUniversities = await findDemoUniversityIds();
  const demoUniIds = demoUniversities.map((u) => u.id);
  const demoUsers = await findDemoUserIds(demoUniIds);
  const demoUserIds = demoUsers.map((u) => u.id);

  const cohorts = demoUniIds.length
    ? await prisma.cohorts.findMany({ where: { university_id: { in: demoUniIds } }, select: { id: true } })
    : [];
  const tracks = await findDemoTrackIds();
  const microCredentials = await findDemoMicroCredentialIds();
  const courses = await findDemoCourseIds();
  const fieldTraining = await findDemoFieldTrainingIds();

  const rubrics = await prisma.rubrics.findMany({
    where: { title: { startsWith: 'Demo Analytics Rubric', mode: 'insensitive' } },
    select: { id: true },
  });

  return {
    demoUniversities,
    demoUsers,
    counts: {
      universities: demoUniversities.length,
      users: demoUsers.length,
      cohorts: cohorts.length,
      tracks: tracks.length,
      microCredentials: microCredentials.length,
      courses: courses.length,
      fieldTraining: fieldTraining.length,
      rubrics: rubrics.length,
    },
    ids: {
      demoUniIds,
      demoUserIds,
      cohortIds: cohorts.map((c) => c.id),
      trackIds: tracks.map((t) => t.id),
      mcIds: microCredentials.map((m) => m.id),
      courseIds: courses.map((c) => c.id),
      ftIds: fieldTraining.map((f) => f.id),
      rubricIds: rubrics.map((r) => r.id),
    },
  };
}

async function deleteFieldTrainingByIds(ftIds) {
  if (!ftIds.length) return 0;
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: { in: ftIds } },
    select: { id: true },
  });
  const appIds = apps.map((a) => a.id);
  if (appIds.length) {
    await prisma.field_training_task_submissions.deleteMany({ where: { application_id: { in: appIds } } });
  }
  await prisma.field_training_tasks.deleteMany({ where: { opportunity_id: { in: ftIds } } });
  await prisma.field_training_applications.deleteMany({ where: { opportunity_id: { in: ftIds } } });
  const r = await prisma.field_training_opportunities.deleteMany({ where: { id: { in: ftIds } } });
  return r.count;
}

async function deleteCoursesByIds(courseIds) {
  if (!courseIds.length) return 0;
  const lessonIds = (
    await prisma.course_lessons.findMany({ where: { course_id: { in: courseIds } }, select: { id: true } })
  ).map((l) => l.id);

  await prisma.course_lesson_student_workflow.deleteMany({ where: { course_id: { in: courseIds } } });
  if (lessonIds.length) {
    await prisma.course_lesson_questions.deleteMany({ where: { lesson_id: { in: lessonIds } } });
    await prisma.course_lesson_training.deleteMany({ where: { lesson_id: { in: lessonIds } } });
  }
  await prisma.course_lesson_progress.deleteMany({ where: { course_id: { in: courseIds } } });
  await prisma.course_enrollments.deleteMany({ where: { course_id: { in: courseIds } } });
  await prisma.course_lessons.deleteMany({ where: { course_id: { in: courseIds } } });
  await prisma.course_sections.deleteMany({ where: { course_id: { in: courseIds } } });
  await prisma.course_cohorts.deleteMany({ where: { course_id: { in: courseIds } } });
  const r = await prisma.courses.deleteMany({ where: { id: { in: courseIds } } });
  return r.count;
}

async function deleteCohortScopedData(cohortIds, demoUniIds, demoUserIds) {
  if (!cohortIds.length) return {};

  const assessmentIds = (
    await prisma.assessments.findMany({ where: { cohort_id: { in: cohortIds } }, select: { id: true } })
  ).map((a) => a.id);
  const sessionIds = (
    await prisma.sessions.findMany({ where: { cohort_id: { in: cohortIds } }, select: { id: true } })
  ).map((s) => s.id);
  const qaIds = (
    await prisma.qa_reviews.findMany({ where: { cohort_id: { in: cohortIds } }, select: { id: true } })
  ).map((q) => q.id);
  const recIds = (
    await prisma.recognition_requests.findMany({ where: { cohort_id: { in: cohortIds } }, select: { id: true } })
  ).map((r) => r.id);

  const stats = {};

  if (assessmentIds.length) {
    stats.grades = (await prisma.grades.deleteMany({ where: { assessment_id: { in: assessmentIds } } })).count;
    stats.submissions = (
      await prisma.submissions.deleteMany({ where: { assessment_id: { in: assessmentIds } } })
    ).count;
  }
  if (sessionIds.length) {
    stats.attendance = (
      await prisma.attendance_records.deleteMany({ where: { session_id: { in: sessionIds } } })
    ).count;
  }

  stats.evidence = (await prisma.evidence_files.deleteMany({ where: { cohort_id: { in: cohortIds } } })).count;
  stats.integrity = (await prisma.integrity_cases.deleteMany({ where: { cohort_id: { in: cohortIds } } })).count;
  stats.risk = (await prisma.risk_cases.deleteMany({ where: { cohort_id: { in: cohortIds } } })).count;
  stats.certificates = (await prisma.certificates.deleteMany({ where: { cohort_id: { in: cohortIds } } })).count;
  stats.enrollments = (await prisma.enrollments.deleteMany({ where: { cohort_id: { in: cohortIds } } })).count;

  if (qaIds.length) {
    stats.corrective = (
      await prisma.corrective_actions.deleteMany({ where: { qa_review_id: { in: qaIds } } })
    ).count;
  }
  stats.qa = (await prisma.qa_reviews.deleteMany({ where: { cohort_id: { in: cohortIds } } })).count;

  if (recIds.length) {
    stats.recognitionDocs = (
      await prisma.recognition_documents.deleteMany({ where: { recognition_request_id: { in: recIds } } })
    ).count;
  }
  stats.recognition = (
    await prisma.recognition_requests.deleteMany({ where: { cohort_id: { in: cohortIds } } })
  ).count;
  stats.sessions = (await prisma.sessions.deleteMany({ where: { cohort_id: { in: cohortIds } } })).count;
  stats.assessments = (await prisma.assessments.deleteMany({ where: { cohort_id: { in: cohortIds } } })).count;
  stats.cohorts = (await prisma.cohorts.deleteMany({ where: { id: { in: cohortIds } } })).count;

  if (demoUserIds.length) {
    stats.notifications = (
      await prisma.notifications.deleteMany({ where: { user_id: { in: demoUserIds } } })
    ).count;
  }
  if (demoUniIds.length) {
    stats.auditLogs = (await prisma.audit_logs.deleteMany({ where: { university_id: { in: demoUniIds } } })).count;
  }

  return stats;
}

async function deleteMicroCredentialsByIds(mcIds) {
  if (!mcIds.length) return 0;
  const moduleIds = (
    await prisma.modules.findMany({ where: { micro_credential_id: { in: mcIds } }, select: { id: true } })
  ).map((m) => m.id);

  if (moduleIds.length) {
    await prisma.contents.deleteMany({ where: { module_id: { in: moduleIds } } });
  }
  await prisma.modules.deleteMany({ where: { micro_credential_id: { in: mcIds } } });
  await prisma.learning_outcomes.deleteMany({ where: { micro_credential_id: { in: mcIds } } });
  await prisma.micro_credential_versions.deleteMany({ where: { micro_credential_id: { in: mcIds } } });
  await prisma.micro_credential_universities.deleteMany({ where: { micro_credential_id: { in: mcIds } } });
  const r = await prisma.micro_credentials.deleteMany({ where: { id: { in: mcIds } } });
  return r.count;
}

async function deleteDemoEmailOtps(demoUserIds) {
  if (!demoUserIds.length) return 0;
  if (!prisma.email_verification_otps) return 0;
  const r = await prisma.email_verification_otps.deleteMany({ where: { user_id: { in: demoUserIds } } });
  return r.count;
}

async function executeDemoCleanup(plan) {
  const deleted = {};
  const { ids, demoUniversities, demoUsers } = plan;

  deleted.fieldTraining = await deleteFieldTrainingByIds(ids.ftIds);
  deleted.courses = await deleteCoursesByIds(ids.courseIds);
  Object.assign(deleted, await deleteCohortScopedData(ids.cohortIds, ids.demoUniIds, ids.demoUserIds));
  deleted.microCredentials = await deleteMicroCredentialsByIds(ids.mcIds);

  if (ids.rubricIds.length) {
    deleted.rubrics = (await prisma.rubrics.deleteMany({ where: { id: { in: ids.rubricIds } } })).count;
  }
  if (ids.trackIds.length) {
    deleted.tracks = (await prisma.tracks.deleteMany({ where: { id: { in: ids.trackIds } } })).count;
  }

  if (ids.demoUserIds.length) {
    deleted.emailOtps = await deleteDemoEmailOtps(ids.demoUserIds);
    deleted.universityUsers = (
      await prisma.university_users.deleteMany({ where: { user_id: { in: ids.demoUserIds } } })
    ).count;
    deleted.userRoles = (await prisma.user_roles.deleteMany({ where: { user_id: { in: ids.demoUserIds } } })).count;
    deleted.users = (await prisma.users.deleteMany({ where: { id: { in: ids.demoUserIds } } })).count;
  }

  if (ids.demoUniIds.length) {
    deleted.domains = (
      await prisma.university_email_domains.deleteMany({ where: { university_id: { in: ids.demoUniIds } } })
    ).count;
    deleted.universities = (await prisma.universities.deleteMany({ where: { id: { in: ids.demoUniIds } } })).count;
  }

  return { deleted, demoUniversities, demoUsers };
}

async function previewDemoCleanup() {
  const plan = await collectDemoCleanupPlan();
  const protectedUniversities = await findProtectedUniversityIds();
  return { plan, protectedUniversities };
}

async function runDemoCleanup() {
  const { plan } = await previewDemoCleanup();
  if (
    !plan.counts.universities
    && !plan.counts.users
    && !plan.counts.courses
    && !plan.counts.fieldTraining
    && !plan.counts.tracks
    && !plan.counts.microCredentials
  ) {
    log('No clearly identified demo data found — nothing deleted.');
    return { deleted: {}, plan };
  }
  const result = await executeDemoCleanup(plan);
  return result;
}

module.exports = { previewDemoCleanup, runDemoCleanup, log };
