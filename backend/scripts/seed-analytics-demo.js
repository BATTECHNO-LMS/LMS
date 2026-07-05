/**
 * DEV/STAGING ONLY — Analytics demo dataset for BATTECHNO LMS.
 *
 * Generates realistic interconnected data for dashboards, analytics, reports, and filters.
 * NEVER run on production. Use --reset-demo to remove prior demo records only.
 *
 * Usage:
 *   node scripts/seed-analytics-demo.js
 *   node scripts/seed-analytics-demo.js --reset-demo
 *
 * Demo marker: universities.notes contains "demo_analytics=true"
 * Demo emails: *@demo-uni-NN.analytics.lms
 */
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { prisma } = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

const DEMO_MARKER = 'demo_analytics=true';
const DEMO_PASSWORD = 'DemoAnalytics123!';
const RESET_FLAG = '--reset-demo';
const FORCE_FLAG = '--i-know-what-im-doing';

const COUNTS = {
  universities: 10,
  users: 520,
  tracks: 8,
  microCredentials: 36,
  cohorts: 72,
  enrollments: 1200,
  sessions: 360,
  attendanceTarget: 5500,
  assessments: 165,
  submissions: 1100,
  grades: 1100,
  certificates: 220,
  evidence: 120,
  qaReviews: 55,
  correctiveActions: 55,
  riskCases: 85,
  integrityCases: 55,
  recognitionRequests: 85,
  notifications: 350,
  auditLogs: 350,
  courses: 32,
  fieldOpportunities: 42,
};

const SPECIALTY_CATALOG = [
  { name_ar: 'الأمن السيبراني', name_en: 'Cybersecurity', code: 'CYB' },
  { name_ar: 'هندسة البرمجيات', name_en: 'Software Engineering', code: 'SWE' },
  { name_ar: 'الذكاء الاصطناعي', name_en: 'Artificial Intelligence', code: 'AI' },
  { name_ar: 'علم البيانات', name_en: 'Data Science', code: 'DS' },
  { name_ar: 'علم الحاسوب', name_en: 'Computer Science', code: 'CS' },
  { name_ar: 'تكنولوجيا المعلومات', name_en: 'Information Technology', code: 'IT' },
  { name_ar: 'الشبكات', name_en: 'Networks', code: 'NET' },
  { name_ar: 'نظم المعلومات الإدارية', name_en: 'Business Information Systems', code: 'BIS' },
];

const STATS = {};

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[seed-analytics-demo] ${msg}`);
}

function logStat(label, value) {
  STATS[label] = value;
  log(`Created ${label}: ${value}`);
}

function uuid() {
  return crypto.randomUUID();
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Random date within last `months` months, weighted toward recent. */
function randomDate(months = 12) {
  const now = Date.now();
  const daysBack = randInt(0, months * 30);
  const recentBoost = Math.random() < 0.25 ? randInt(0, 7) : daysBack;
  return new Date(now - recentBoost * 24 * 60 * 60 * 1000 - randInt(0, 86400000));
}

function dateOnly(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function timeOnly(h, m = 0) {
  const d = new Date(Date.UTC(1970, 0, 1, h, m, 0));
  return d;
}

function assertSafeEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run: NODE_ENV=production. This script is development/staging only.');
  }
  const url = (process.env.DATABASE_URL || '').toLowerCase();
  const suspicious = [/prod(uction)?[./-]/i, /live[./-]/i, /\.rds\./i, /neon\.tech/i];
  if (suspicious.some((re) => re.test(url)) && !process.argv.includes(FORCE_FLAG)) {
    throw new Error(
      'DATABASE_URL looks like a production host. Aborting. Pass --i-know-what-im-doing only if you are certain.'
    );
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }
}

async function ensureRoles() {
  const roles = [
    { code: 'super_admin', name: 'Super Admin', scope: 'global' },
    { code: 'program_admin', name: 'Program Admin', scope: 'university' },
    { code: 'university_admin', name: 'University Admin', scope: 'university' },
    { code: 'academic_admin', name: 'Academic Admin', scope: 'university' },
    { code: 'qa_officer', name: 'QA Officer', scope: 'university' },
    { code: 'instructor', name: 'Instructor', scope: 'university' },
    { code: 'student', name: 'Student', scope: 'university' },
    { code: 'university_reviewer', name: 'University Reviewer', scope: 'university' },
  ];
  for (const r of roles) {
    await prisma.roles.upsert({
      where: { code: r.code },
      update: { name: r.name, scope: r.scope },
      create: { name: r.name, code: r.code, scope: r.scope, description: r.name },
    });
  }
  const rows = await prisma.roles.findMany({ select: { id: true, code: true } });
  return new Map(rows.map((r) => [r.code, r.id]));
}

async function findDemoUniversityIds() {
  const rows = await prisma.universities.findMany({
    where: { notes: { contains: DEMO_MARKER } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function deleteDemoData() {
  const demoUniIds = await findDemoUniversityIds();
  if (!demoUniIds.length) {
    log('No prior demo universities found — nothing to reset.');
    return;
  }

  const demoUsers = await prisma.users.findMany({
    where: {
      OR: [
        { primary_university_id: { in: demoUniIds } },
        { email: { endsWith: '.analytics.lms' } },
      ],
    },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((u) => u.id);

  const demoCohorts = await prisma.cohorts.findMany({
    where: { university_id: { in: demoUniIds } },
    select: { id: true },
  });
  const cohortIds = demoCohorts.map((c) => c.id);

  const demoMc = await prisma.micro_credentials.findMany({
    where: { code: { startsWith: 'DA-MC-' } },
    select: { id: true },
  });
  const mcIds = demoMc.map((m) => m.id);

  const demoCourses = await prisma.courses.findMany({
    where: { slug: { startsWith: 'demo-analytics-' } },
    select: { id: true },
  });
  const courseIds = demoCourses.map((c) => c.id);

  const demoFt = await prisma.field_training_opportunities.findMany({
    where: { slug: { startsWith: 'demo-analytics-ft-' } },
    select: { id: true },
  });
  const ftIds = demoFt.map((f) => f.id);

  const demoTracks = await prisma.tracks.findMany({
    where: { code: { startsWith: 'DA-TRK-' } },
    select: { id: true },
  });
  const trackIds = demoTracks.map((t) => t.id);

  log(`Resetting demo data (${demoUniIds.length} universities, ${demoUserIds.length} users)…`);

  const cohortIdList = cohortIds;
  const assessmentIds = cohortIdList.length
    ? (await prisma.assessments.findMany({ where: { cohort_id: { in: cohortIdList } }, select: { id: true } })).map((a) => a.id)
    : [];
  const sessionIds = cohortIdList.length
    ? (await prisma.sessions.findMany({ where: { cohort_id: { in: cohortIdList } }, select: { id: true } })).map((s) => s.id)
    : [];
  const qaIds = cohortIdList.length
    ? (await prisma.qa_reviews.findMany({ where: { cohort_id: { in: cohortIdList } }, select: { id: true } })).map((q) => q.id)
    : [];
  const recIds = cohortIdList.length
    ? (await prisma.recognition_requests.findMany({ where: { cohort_id: { in: cohortIdList } }, select: { id: true } })).map((r) => r.id)
    : [];
  const moduleIds = mcIds.length
    ? (await prisma.modules.findMany({ where: { micro_credential_id: { in: mcIds } }, select: { id: true } })).map((m) => m.id)
    : [];
  const lessonIds = courseIds.length
    ? (await prisma.course_lessons.findMany({ where: { course_id: { in: courseIds } }, select: { id: true } })).map((l) => l.id)
    : [];

  if (ftIds.length) {
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
    await prisma.field_training_opportunities.deleteMany({ where: { id: { in: ftIds } } });
  }

  if (courseIds.length) {
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
    await prisma.courses.deleteMany({ where: { id: { in: courseIds } } });
  }

  if (demoUserIds.length) {
    await prisma.notifications.deleteMany({ where: { user_id: { in: demoUserIds } } });
  }
  await prisma.audit_logs.deleteMany({ where: { university_id: { in: demoUniIds } } });

  if (cohortIdList.length) {
    if (assessmentIds.length) {
      await prisma.grades.deleteMany({ where: { assessment_id: { in: assessmentIds } } });
      await prisma.submissions.deleteMany({ where: { assessment_id: { in: assessmentIds } } });
    }
    if (sessionIds.length) {
      await prisma.attendance_records.deleteMany({ where: { session_id: { in: sessionIds } } });
    }
    await prisma.evidence_files.deleteMany({ where: { cohort_id: { in: cohortIdList } } });
    await prisma.integrity_cases.deleteMany({ where: { cohort_id: { in: cohortIdList } } });
    await prisma.risk_cases.deleteMany({ where: { cohort_id: { in: cohortIdList } } });
    await prisma.certificates.deleteMany({ where: { cohort_id: { in: cohortIdList } } });
    await prisma.enrollments.deleteMany({ where: { cohort_id: { in: cohortIdList } } });
    if (qaIds.length) await prisma.corrective_actions.deleteMany({ where: { qa_review_id: { in: qaIds } } });
    await prisma.qa_reviews.deleteMany({ where: { cohort_id: { in: cohortIdList } } });
    if (recIds.length) await prisma.recognition_documents.deleteMany({ where: { recognition_request_id: { in: recIds } } });
    await prisma.recognition_requests.deleteMany({ where: { cohort_id: { in: cohortIdList } } });
    await prisma.sessions.deleteMany({ where: { cohort_id: { in: cohortIdList } } });
    await prisma.assessments.deleteMany({ where: { cohort_id: { in: cohortIdList } } });
    await prisma.cohorts.deleteMany({ where: { id: { in: cohortIdList } } });
  }

  if (mcIds.length) {
    if (moduleIds.length) {
      await prisma.contents.deleteMany({ where: { module_id: { in: moduleIds } } });
    }
    await prisma.modules.deleteMany({ where: { micro_credential_id: { in: mcIds } } });
    await prisma.learning_outcomes.deleteMany({ where: { micro_credential_id: { in: mcIds } } });
    await prisma.micro_credential_versions.deleteMany({ where: { micro_credential_id: { in: mcIds } } });
    await prisma.micro_credential_universities.deleteMany({ where: { micro_credential_id: { in: mcIds } } });
    await prisma.micro_credentials.deleteMany({ where: { id: { in: mcIds } } });
  }

  await prisma.rubrics.deleteMany({ where: { title: { startsWith: 'Demo Analytics Rubric' } } });

  if (trackIds.length) {
    await prisma.tracks.deleteMany({ where: { id: { in: trackIds } } });
  }

  if (demoUserIds.length) {
    await prisma.university_users.deleteMany({ where: { user_id: { in: demoUserIds } } });
    await prisma.user_roles.deleteMany({ where: { user_id: { in: demoUserIds } } });
    await prisma.users.deleteMany({ where: { id: { in: demoUserIds } } });
  }

  await prisma.university_email_domains.deleteMany({ where: { university_id: { in: demoUniIds } } });
  await prisma.universities.deleteMany({ where: { id: { in: demoUniIds } } });

  log('Demo reset complete.');
}

async function createManyBatched(model, data, batchSize = 500) {
  let total = 0;
  for (const part of chunk(data, batchSize)) {
    const r = await model.createMany({ data: part, skipDuplicates: true });
    total += r.count;
  }
  return total;
}

async function seedUniversities() {
  const rows = [];
  const domains = [];
  for (let i = 1; i <= COUNTS.universities; i += 1) {
    const id = uuid();
    const nn = String(i).padStart(2, '0');
    rows.push({
      id,
      name: `Demo Analytics University ${nn}`,
      type: 'University',
      contact_person: `Demo Contact ${nn}`,
      contact_email: `contact${nn}@demo-uni-${nn}.analytics.lms`,
      contact_phone: `+9627${randInt(10000000, 99999999)}`,
      status: pick(['active', 'active', 'active', 'inactive']),
      partnership_state: pick(['active', 'active', 'pending']),
      notes: `${DEMO_MARKER} | Synthetic dataset for analytics QA`,
      created_at: randomDate(10),
      updated_at: new Date(),
    });
    domains.push({
      id: uuid(),
      university_id: id,
      domain: `demo-uni-${nn}.analytics.lms`,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
  await prisma.universities.createMany({ data: rows });
  await prisma.university_email_domains.createMany({ data: domains });
  logStat('universities', rows.length);
  return rows;
}

async function seedSpecialties() {
  const rows = SPECIALTY_CATALOG.map((spec) => ({
    id: uuid(),
    name_ar: spec.name_ar,
    name_en: spec.name_en,
    code: spec.code,
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  }));
  await createManyBatched(prisma.specialties, rows);
  logStat('specialties', rows.length);
  return rows;
}

function specialtyMapByCode(specialties) {
  return new Map(specialties.map((row) => [row.code, row]));
}

async function seedUsers(universities, roleByCode, specialties) {
  const byCode = specialtyMapByCode(specialties);
  const specialtyCodes = [...byCode.keys()];
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const rolePlan = [
    { code: 'student', count: 370 },
    { code: 'instructor', count: 48 },
    { code: 'academic_admin', count: 28 },
    { code: 'qa_officer', count: 24 },
    { code: 'university_reviewer', count: 20 },
    { code: 'university_admin', count: 20 },
    { code: 'program_admin', count: 10 },
  ];
  const users = [];
  const userRoles = [];
  const uniUsers = [];
  let idx = 0;

  for (const plan of rolePlan) {
    for (let n = 0; n < plan.count; n += 1) {
      const uni = universities[idx % universities.length];
      const uniNum = universities.indexOf(uni) + 1;
      const nn = String(uniNum).padStart(2, '0');
      const id = uuid();
      const status = plan.code === 'student' && Math.random() < 0.08 ? 'inactive' : pick(['active', 'active', 'active', 'active', 'suspended']);
      const email = `demo.${plan.code}.${idx + 1}@demo-uni-${nn}.analytics.lms`;
      const uniSpecialties = specialtyCodes.length ? specialtyCodes : [];
      const specialtyId =
        plan.code === 'student' && uniSpecialties.length
          ? byCode.get(pick(uniSpecialties)).id
          : null;
      users.push({
        id,
        full_name: `Demo ${plan.code.replace(/_/g, ' ')} ${idx + 1}`,
        email,
        password_hash: passwordHash,
        phone: null,
        status,
        primary_university_id: uni.id,
        specialty_id: specialtyId,
        activated_at: status === 'active' ? randomDate(8) : null,
        last_login_at: Math.random() < 0.7 ? randomDate(3) : null,
        created_at: randomDate(11),
        updated_at: new Date(),
      });
      userRoles.push({ id: uuid(), user_id: id, role_id: roleByCode.get(plan.code), created_at: new Date() });
      uniUsers.push({
        id: uuid(),
        university_id: uni.id,
        user_id: id,
        relationship_type: plan.code === 'student' ? 'student' : plan.code === 'instructor' ? 'instructor' : plan.code === 'university_reviewer' ? 'reviewer' : 'staff',
        created_at: new Date(),
        updated_at: new Date(),
      });
      idx += 1;
    }
  }

  for (const part of chunk(users, 100)) {
    await prisma.users.createMany({ data: part });
  }
  await createManyBatched(prisma.user_roles, userRoles);
  await createManyBatched(prisma.university_users, uniUsers);
  logStat('users', users.length);
  return users;
}

async function seedTracks() {
  const tracks = [];
  const names = [
    'Data Science', 'Cyber Security', 'Software Engineering', 'AI & ML',
    'Digital Education', 'Quality Assurance', 'Business Analytics', 'Cloud Computing',
  ];
  for (let i = 0; i < COUNTS.tracks; i += 1) {
    tracks.push({
      id: uuid(),
      name: `Demo Analytics Track — ${names[i]}`,
      code: `DA-TRK-${String(i + 1).padStart(3, '0')}`,
      description: 'Synthetic track for analytics demo',
      status: pick(['active', 'active', 'inactive', 'archived']),
      created_at: randomDate(10),
      updated_at: new Date(),
    });
  }
  await prisma.tracks.createMany({ data: tracks });
  logStat('tracks', tracks.length);
  return tracks;
}

async function seedMicroCredentials(tracks) {
  const deliveryModes = ['online', 'onsite', 'hybrid', 'self_paced'];
  const mcStatuses = ['draft', 'under_review', 'approved', 'active', 'active', 'archived'];
  const mcs = [];
  for (let i = 0; i < COUNTS.microCredentials; i += 1) {
    const track = tracks[i % tracks.length];
    mcs.push({
      id: uuid(),
      track_id: track.id,
      title: `Demo Micro-Credential ${i + 1}`,
      code: `DA-MC-${String(i + 1).padStart(4, '0')}`,
      description: 'Demo micro-credential for analytics testing',
      level: pick(['Foundation', 'Intermediate', 'Advanced']),
      duration_hours: randInt(20, 120),
      delivery_mode: pick(deliveryModes),
      prerequisites: null,
      passing_policy: '60% minimum',
      attendance_policy: '75% minimum',
      internal_approval_status: pick(['not_started', 'in_review', 'approved', 'rejected']),
      status: pick(mcStatuses),
      created_at: randomDate(10),
      updated_at: new Date(),
    });
  }
  await prisma.micro_credentials.createMany({ data: mcs });
  logStat('micro-credentials', mcs.length);
  return mcs;
}

async function seedMcUniversityLinks(mcs, universities) {
  const links = [];
  for (const mc of mcs) {
    const howMany = randInt(2, 4);
    const picked = new Set();
    for (let j = 0; j < howMany; j += 1) {
      const uni = pick(universities);
      if (picked.has(uni.id)) continue;
      picked.add(uni.id);
      links.push({
        id: uuid(),
        micro_credential_id: mc.id,
        university_id: uni.id,
        created_at: randomDate(9),
      });
    }
  }
  await createManyBatched(prisma.micro_credential_universities, links);
  return links;
}

async function seedLearningOutcomesAndModules(mcs) {
  const outcomes = [];
  const modules = [];
  const contents = [];
  for (const mc of mcs) {
    const modCount = randInt(2, 4);
    for (let m = 0; m < modCount; m += 1) {
      const modId = uuid();
      modules.push({
        id: modId,
        micro_credential_id: mc.id,
        title: `Module ${m + 1} — ${mc.title}`,
        description: 'Demo module',
        sequence_no: m + 1,
        is_published: Math.random() < 0.75,
        created_at: randomDate(8),
        updated_at: new Date(),
      });
      for (let c = 0; c < randInt(2, 5); c += 1) {
        contents.push({
          id: uuid(),
          module_id: modId,
          title: `Content ${c + 1}`,
          content_type: pick(['lesson', 'pdf', 'video', 'external_link', 'lab_guide']),
          file_url: null,
          external_url: `https://demo.analytics.lms/content/${c}`,
          sequence_no: c + 1,
          publish_at: randomDate(6),
          created_at: randomDate(7),
          updated_at: new Date(),
        });
      }
    }
    for (let o = 0; o < randInt(2, 4); o += 1) {
      outcomes.push({
        id: uuid(),
        micro_credential_id: mc.id,
        outcome_code: `LO-${o + 1}`,
        outcome_text: `Learning outcome ${o + 1} for ${mc.code}`,
        outcome_type: pick(['knowledge', 'skill', 'competency']),
        created_at: randomDate(8),
        updated_at: new Date(),
      });
    }
  }
  await createManyBatched(prisma.learning_outcomes, outcomes);
  await createManyBatched(prisma.modules, modules);
  await createManyBatched(prisma.contents, contents);
  logStat('learning-outcomes', outcomes.length);
  logStat('modules', modules.length);
  logStat('contents', contents.length);
  return { modules };
}

async function seedCohorts(mcs, universities, users) {
  const instructors = users.filter((u) => u.email.includes('.instructor.'));
  const cohortStatuses = ['planned', 'open_for_enrollment', 'active', 'active', 'completed', 'closed', 'cancelled'];
  const cohorts = [];
  for (let i = 0; i < COUNTS.cohorts; i += 1) {
    const mc = mcs[i % mcs.length];
    const uni = universities[i % universities.length];
    const start = randomDate(10);
    const end = new Date(start.getTime() + randInt(60, 180) * 86400000);
    cohorts.push({
      id: uuid(),
      micro_credential_id: mc.id,
      university_id: uni.id,
      instructor_id: pick(instructors).id,
      title: `Demo Cohort ${i + 1} — ${mc.code}`,
      start_date: dateOnly(start),
      end_date: dateOnly(end),
      capacity: randInt(20, 60),
      status: pick(cohortStatuses),
      created_at: randomDate(9),
      updated_at: new Date(),
    });
  }
  await prisma.cohorts.createMany({ data: cohorts });
  logStat('cohorts', cohorts.length);
  return cohorts;
}

async function seedEnrollments(cohorts, users) {
  const students = users.filter((u) => u.email.includes('.student.'));
  const enrollStatuses = ['pending', 'enrolled', 'enrolled', 'enrolled', 'completed', 'rejected', 'withdrawn', 'cancelled'];
  const finalStatuses = ['in_progress', 'passed', 'failed', 'withdrawn', 'incomplete'];
  const enrollments = [];
  const used = new Set();

  while (enrollments.length < COUNTS.enrollments) {
    const cohort = pick(cohorts);
    const student = pick(students);
    const key = `${cohort.id}:${student.id}`;
    if (used.has(key)) continue;
    used.add(key);
    const es = pick(enrollStatuses);
    enrollments.push({
      id: uuid(),
      cohort_id: cohort.id,
      student_id: student.id,
      enrollment_status: es,
      final_status: pick(finalStatuses),
      final_grade: es === 'completed' ? randInt(55, 98) : null,
      attendance_percentage: randInt(40, 100),
      enrolled_at: randomDate(10),
      completion_date: es === 'completed' ? dateOnly(randomDate(4)) : null,
      certificate_issued_at: null,
      recognition_eligibility_status: pick(['unknown', 'eligible', 'not_eligible', 'under_review']),
      approved_by: null,
      approved_at: es === 'enrolled' ? randomDate(8) : null,
      rejection_reason: es === 'rejected' ? 'Demo rejection' : null,
      created_at: randomDate(10),
      updated_at: new Date(),
    });
  }
  await createManyBatched(prisma.enrollments, enrollments);
  logStat('enrollments', enrollments.length);
  return enrollments;
}

async function seedSessions(cohorts, modules) {
  const sessionTypes = ['lecture', 'lab', 'workshop', 'review', 'assessment', 'other'];
  const docStatuses = ['pending', 'documented', 'incomplete'];
  const sessions = [];
  const perCohort = Math.ceil(COUNTS.sessions / cohorts.length);
  for (const cohort of cohorts) {
    const count = randInt(Math.max(3, perCohort - 2), perCohort + 2);
    const cohortModules = modules.filter((m) => {
      return true;
    });
    for (let s = 0; s < count && sessions.length < COUNTS.sessions; s += 1) {
      const day = randomDate(10);
      sessions.push({
        id: uuid(),
        cohort_id: cohort.id,
        module_id: cohortModules.length ? pick(cohortModules).id : null,
        title: `Session ${s + 1} — ${cohort.title.slice(0, 40)}`,
        session_date: dateOnly(day),
        start_time: timeOnly(randInt(8, 14)),
        end_time: timeOnly(randInt(15, 18)),
        session_type: pick(sessionTypes),
        notes: 'Demo session',
        documentation_status: pick(docStatuses),
        created_at: randomDate(9),
        updated_at: new Date(),
      });
    }
  }
  await prisma.sessions.createMany({ data: sessions });
  logStat('sessions', sessions.length);
  return sessions;
}

async function seedAttendance(sessions, enrollments) {
  const attStatuses = ['present', 'present', 'present', 'late', 'absent', 'excused'];
  const enrollByCohort = new Map();
  for (const e of enrollments) {
    if (!['enrolled', 'completed', 'pending'].includes(e.enrollment_status)) continue;
    const list = enrollByCohort.get(e.cohort_id) || [];
    list.push(e.student_id);
    enrollByCohort.set(e.cohort_id, list);
  }

  const records = [];
  const usedKeys = new Set();
  const sessionCohort = new Map(sessions.map((s) => [s.id, s.cohort_id]));

  for (const session of sessions) {
    const studentIds = enrollByCohort.get(sessionCohort.get(session.id)) || [];
    if (!studentIds.length) continue;
    const take = Math.min(studentIds.length, randInt(12, 22));
    for (let i = 0; i < take; i += 1) {
      const studentId = studentIds[i % studentIds.length];
      const key = `${session.id}:${studentId}`;
      if (usedKeys.has(key)) continue;
      usedKeys.add(key);
      records.push({
        id: uuid(),
        session_id: session.id,
        student_id: studentId,
        attendance_status: pick(attStatuses),
        notes: null,
        created_at: randomDate(8),
        updated_at: new Date(),
      });
      if (records.length >= COUNTS.attendanceTarget) break;
    }
    if (records.length >= COUNTS.attendanceTarget) break;
  }

  // Top up if below target
  let guard = 0;
  while (records.length < COUNTS.attendanceTarget && guard < COUNTS.attendanceTarget * 2) {
    guard += 1;
    const session = sessions[guard % sessions.length];
    const studentIds = enrollByCohort.get(sessionCohort.get(session.id)) || [];
    if (!studentIds.length) continue;
    const studentId = studentIds[guard % studentIds.length];
    const key = `${session.id}:${studentId}`;
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    records.push({
      id: uuid(),
      session_id: session.id,
      student_id: studentId,
      attendance_status: pick(attStatuses),
      notes: null,
      created_at: randomDate(8),
      updated_at: new Date(),
    });
  }

  await createManyBatched(prisma.attendance_records, records);
  logStat('attendance records', records.length);
  return records;
}

async function seedRubricsAndAssessments(cohorts, mcs) {
  const rubrics = [];
  for (let i = 0; i < 20; i += 1) {
    rubrics.push({
      id: uuid(),
      title: `Demo Analytics Rubric ${i + 1}`,
      description: 'Demo rubric',
      status: 'active',
      created_at: randomDate(8),
      updated_at: new Date(),
    });
  }
  await prisma.rubrics.createMany({ data: rubrics });

  const aTypes = ['quiz', 'assignment', 'lab', 'practical_exam', 'milestone', 'capstone_project', 'presentation'];
  const aStatuses = ['draft', 'published', 'open', 'open', 'closed', 'archived'];
  const assessments = [];
  let ai = 0;
  for (const cohort of cohorts) {
    const mc = mcs.find((m) => m.id === cohort.micro_credential_id) || mcs[0];
    const n = randInt(1, 3);
    for (let j = 0; j < n && ai < COUNTS.assessments; j += 1) {
      const due = randomDate(8);
      assessments.push({
        id: uuid(),
        cohort_id: cohort.id,
        micro_credential_id: mc.id,
        title: `Assessment ${ai + 1}`,
        assessment_type: pick(aTypes),
        weight: randInt(5, 30),
        open_at: randomDate(9),
        due_date: due,
        linked_outcome_id: null,
        rubric_id: pick(rubrics).id,
        instructions: 'Complete the demo assessment.',
        time_limit_minutes: Math.random() < 0.3 ? randInt(30, 120) : null,
        max_attempts: randInt(1, 3),
        shuffle_questions: Math.random() < 0.5,
        question_bank_ref: null,
        preferred_submission_type: pick(['file', 'repo_url', 'text_response', 'mixed']),
        status: pick(aStatuses),
        created_at: randomDate(9),
        updated_at: new Date(),
      });
      ai += 1;
    }
  }
  await prisma.assessments.createMany({ data: assessments });
  logStat('assessments', assessments.length);
  logStat('rubrics', rubrics.length);
  return assessments;
}

async function seedSubmissionsAndGrades(assessments, enrollments, users) {
  const instructors = users.filter((u) => u.email.includes('.instructor.'));
  const subTypes = ['file', 'repo_url', 'text_response', 'mixed'];
  const subStatuses = ['submitted', 'submitted', 'late', 'resubmitted', 'graded', 'returned'];
  const submissions = [];
  const grades = [];
  const enrollByCohort = new Map();
  for (const e of enrollments) {
    if (!['enrolled', 'completed'].includes(e.enrollment_status)) continue;
    const list = enrollByCohort.get(e.cohort_id) || [];
    list.push(e.student_id);
    enrollByCohort.set(e.cohort_id, list);
  }

  const usedGrade = new Set();
  let si = 0;
  for (const assessment of assessments) {
    const students = enrollByCohort.get(assessment.cohort_id) || [];
    if (!students.length) continue;
    const take = students.slice(0, randInt(3, Math.min(12, students.length)));
    for (const studentId of take) {
      if (si >= COUNTS.submissions) break;
      const subId = uuid();
      const status = pick(subStatuses);
      submissions.push({
        id: subId,
        assessment_id: assessment.id,
        student_id: studentId,
        attempt_id: null,
        submission_type: pick(subTypes),
        file_url: Math.random() < 0.4 ? `uploads/demo/sub-${si}.pdf` : null,
        repo_url: Math.random() < 0.2 ? `https://github.com/demo/repo-${si}` : null,
        text_response: Math.random() < 0.5 ? `Demo submission text ${si}` : null,
        submitted_at: randomDate(7),
        status,
        created_at: randomDate(7),
        updated_at: new Date(),
      });
      si += 1;

      const gKey = `${assessment.id}:${studentId}`;
      if (!usedGrade.has(gKey) && grades.length < COUNTS.grades) {
        usedGrade.add(gKey);
        grades.push({
          id: uuid(),
          assessment_id: assessment.id,
          student_id: studentId,
          grader_id: pick(instructors).id,
          score: randInt(40, 100),
          feedback: 'Demo feedback',
          graded_at: randomDate(5),
          is_final: true,
          created_at: randomDate(6),
          updated_at: new Date(),
        });
      }
    }
  }

  await createManyBatched(prisma.submissions, submissions);
  await createManyBatched(prisma.grades, grades);
  logStat('submissions', submissions.length);
  logStat('grades', grades.length);
  return { submissions, grades };
}

async function seedCertificates(cohorts, enrollments, mcs) {
  const certs = [];
  const used = new Set();
  const certStatuses = ['issued', 'issued', 'issued', 'revoked', 'superseded'];
  let ci = 0;
  for (const e of enrollments) {
    if (ci >= COUNTS.certificates) break;
    if (!['enrolled', 'completed'].includes(e.enrollment_status)) continue;
    if (Math.random() > 0.35) continue;
    const cohort = cohorts.find((c) => c.id === e.cohort_id);
    if (!cohort) continue;
    const key = `${e.student_id}:${cohort.id}`;
    if (used.has(key)) continue;
    used.add(key);
    certs.push({
      id: uuid(),
      student_id: e.student_id,
      cohort_id: cohort.id,
      micro_credential_id: cohort.micro_credential_id,
      certificate_no: `DEMO-CERT-${String(ci + 1).padStart(6, '0')}`,
      verification_code: `DEMO-VC-${crypto.randomBytes(8).toString('hex')}`,
      qr_code_url: null,
      status: pick(certStatuses),
      issued_at: randomDate(6),
      created_at: randomDate(6),
      updated_at: new Date(),
    });
    ci += 1;
  }
  await prisma.certificates.createMany({ data: certs });
  logStat('certificates', certs.length);
  return certs;
}

async function seedEvidence(cohorts, mcs, users, assessments) {
  const students = users.filter((u) => u.email.includes('.student.'));
  const files = [];
  for (let i = 0; i < COUNTS.evidence; i += 1) {
    const cohort = pick(cohorts);
    const assessment = pick(assessments);
    files.push({
      id: uuid(),
      micro_credential_id: cohort.micro_credential_id,
      cohort_id: cohort.id,
      student_id: pick(students).id,
      assessment_id: assessment?.id ?? null,
      session_id: null,
      evidence_type: pick(['assignment', 'attendance', 'project', 'report']),
      file_url: `uploads/demo/evidence-${i}.pdf`,
      title: `Demo Evidence ${i + 1}`,
      uploaded_by: pick(users).id,
      created_at: randomDate(7),
      updated_at: new Date(),
    });
  }
  await createManyBatched(prisma.evidence_files, files);
  logStat('evidence files', files.length);
}

async function seedQaAndCorrective(cohorts, users) {
  const qaStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  const caStatuses = ['open', 'in_progress', 'resolved', 'closed', 'overdue'];
  const reviews = [];
  const actions = [];
  for (let i = 0; i < COUNTS.qaReviews; i += 1) {
    const id = uuid();
    const cohort = pick(cohorts);
    reviews.push({
      id,
      cohort_id: cohort.id,
      reviewer_id: pick(users).id,
      review_date: dateOnly(randomDate(8)),
      review_type: pick(['scheduled', 'periodic', 'pre_closure', 'special']),
      findings: 'Demo QA findings',
      action_required: Math.random() < 0.6 ? 'Follow-up required' : null,
      status: pick(qaStatuses),
      created_at: randomDate(8),
      updated_at: new Date(),
    });
    if (actions.length < COUNTS.correctiveActions) {
      actions.push({
        id: uuid(),
        qa_review_id: id,
        assigned_to: pick(users).id,
        action_text: `Corrective action ${i + 1}`,
        due_date: dateOnly(randomDate(4)),
        status: pick(caStatuses),
        closed_at: Math.random() < 0.3 ? randomDate(3) : null,
        created_at: randomDate(7),
        updated_at: new Date(),
      });
    }
  }
  await prisma.qa_reviews.createMany({ data: reviews });
  await prisma.corrective_actions.createMany({ data: actions });
  logStat('QA reviews', reviews.length);
  logStat('corrective actions', actions.length);
  return reviews;
}

async function seedRiskAndIntegrity(cohorts, users) {
  const students = users.filter((u) => u.email.includes('.student.'));
  const risks = [];
  const integrity = [];
  for (let i = 0; i < COUNTS.riskCases; i += 1) {
    risks.push({
      id: uuid(),
      cohort_id: pick(cohorts).id,
      student_id: pick(students).id,
      risk_type: pick(['low_attendance', 'assessment_failure', 'missing_project', 'continuous_decline', 'other']),
      risk_level: pick(['low', 'medium', 'high', 'critical']),
      opened_by: pick(users).id,
      action_plan: 'Demo risk mitigation plan',
      status: pick(['open', 'in_progress', 'resolved', 'closed', 'escalated']),
      created_at: randomDate(8),
      updated_at: new Date(),
    });
  }
  for (let i = 0; i < COUNTS.integrityCases; i += 1) {
    integrity.push({
      id: uuid(),
      cohort_id: pick(cohorts).id,
      student_id: pick(students).id,
      assessment_id: null,
      reported_by: pick(users).id,
      case_type: pick(['cheating', 'plagiarism', 'non_original_submission', 'attendance_manipulation', 'unauthorized_tools', 'other']),
      evidence_notes: 'Demo integrity notes',
      decision: Math.random() < 0.5 ? 'Under review' : null,
      status: pick(['reported', 'under_investigation', 'resolved', 'closed']),
      created_at: randomDate(8),
      updated_at: new Date(),
    });
  }
  await createManyBatched(prisma.risk_cases, risks);
  await createManyBatched(prisma.integrity_cases, integrity);
  logStat('risk cases', risks.length);
  logStat('integrity cases', integrity.length);
}

async function seedRecognition(cohorts, universities, mcs, users) {
  const recStatuses = ['draft', 'in_preparation', 'ready_for_submission', 'submitted', 'under_review', 'approved', 'rejected', 'needs_revision'];
  const requests = [];
  for (let i = 0; i < COUNTS.recognitionRequests; i += 1) {
    const cohort = pick(cohorts);
    requests.push({
      id: uuid(),
      university_id: cohort.university_id,
      micro_credential_id: cohort.micro_credential_id,
      cohort_id: cohort.id,
      created_by: pick(users).id,
      status: pick(recStatuses),
      submitted_at: Math.random() < 0.6 ? randomDate(6) : null,
      reviewed_at: Math.random() < 0.4 ? randomDate(4) : null,
      decision_notes: Math.random() < 0.3 ? 'Demo decision notes' : null,
      created_at: randomDate(8),
      updated_at: new Date(),
    });
  }
  await prisma.recognition_requests.createMany({ data: requests });
  logStat('recognition requests', requests.length);
}

async function seedCourses(cohorts, users) {
  const students = users.filter((u) => u.email.includes('.student.'));
  const courseStatuses = ['draft', 'published', 'published', 'archived'];
  const courses = [];
  const sections = [];
  const lessons = [];
  const courseEnrollments = [];
  const progress = [];

  for (let i = 0; i < COUNTS.courses; i += 1) {
    const courseId = uuid();
    const status = pick(courseStatuses);
    courses.push({
      id: courseId,
      title: `Demo Analytics Course ${i + 1}`,
      slug: `demo-analytics-course-${String(i + 1).padStart(3, '0')}`,
      short_description: 'Demo course for analytics',
      description: 'Full demo course description',
      cover_image_url: null,
      category: pick(['Technology', 'Education', 'Business']),
      level: pick(['beginner', 'intermediate', 'advanced', 'all_levels']),
      status,
      estimated_duration_minutes: randInt(60, 600),
      created_by_id: pick(users).id,
      published_at: status === 'published' ? randomDate(6) : null,
      created_at: randomDate(8),
      updated_at: new Date(),
    });
    const sectionId = uuid();
    sections.push({
      id: sectionId,
      course_id: courseId,
      title: 'Main section',
      sort_order: 0,
      created_at: randomDate(7),
      updated_at: new Date(),
    });
    const lessonIds = [];
    for (let l = 0; l < randInt(3, 6); l += 1) {
      const lessonId = uuid();
      lessonIds.push(lessonId);
      lessons.push({
        id: lessonId,
        course_id: courseId,
        section_id: sectionId,
        title: `Lesson ${l + 1}`,
        description: 'Demo lesson',
        type: pick(['video', 'text', 'link', 'file']),
        video_url: l % 2 === 0 ? 'https://example.com/demo-video' : null,
        content: 'Demo lesson content',
        resource_url: null,
        duration_minutes: randInt(10, 45),
        sort_order: l,
        is_preview: l === 0,
        is_required: true,
        status: pick(['draft', 'published', 'published']),
        created_at: randomDate(7),
        updated_at: new Date(),
      });
    }
    const enrolled = students.slice(i * 5, i * 5 + randInt(8, 15));
    for (const student of enrolled) {
      if (!student) continue;
      courseEnrollments.push({
        id: uuid(),
        course_id: courseId,
        student_id: student.id,
        status: pick(['active', 'active', 'completed']),
        started_at: randomDate(6),
        completed_at: Math.random() < 0.2 ? randomDate(3) : null,
        created_at: randomDate(6),
        updated_at: new Date(),
      });
      for (const lessonId of lessonIds.slice(0, randInt(1, lessonIds.length))) {
        progress.push({
          id: uuid(),
          course_id: courseId,
          lesson_id: lessonId,
          student_id: student.id,
          is_completed: Math.random() < 0.6,
          completed_at: Math.random() < 0.6 ? randomDate(4) : null,
          created_at: randomDate(5),
          updated_at: new Date(),
        });
      }
    }
  }

  await prisma.courses.createMany({ data: courses });
  await prisma.course_sections.createMany({ data: sections });
  await prisma.course_lessons.createMany({ data: lessons });
  await createManyBatched(prisma.course_enrollments, courseEnrollments);
  await createManyBatched(prisma.course_lesson_progress, progress);

  const courseCohortLinks = [];
  for (let i = 0; i < Math.min(courses.length, cohorts.length, 15); i += 1) {
    courseCohortLinks.push({
      course_id: courses[i].id,
      cohort_id: cohorts[i].id,
      created_at: randomDate(5),
    });
  }
  await prisma.course_cohorts.createMany({ data: courseCohortLinks, skipDuplicates: true });

  logStat('courses', courses.length);
  logStat('course sections', sections.length);
  logStat('course lessons', lessons.length);
  logStat('course enrollments', courseEnrollments.length);
  logStat('course lesson progress', progress.length);
}

async function seedFieldTraining(universities, users, specialties) {
  const students = users.filter((u) => u.email.includes('.student.'));
  const byCode = specialtyMapByCode(specialties);
  const ftStatuses = ['draft', 'published', 'published', 'archived'];
  const appStatuses = ['pending', 'approved', 'approved', 'rejected', 'cancelled'];
  const opportunities = [];
  const applications = [];
  const tasks = [];
  const taskSubs = [];

  for (let i = 0; i < COUNTS.fieldOpportunities; i += 1) {
    const specialty = byCode.get(pick([...byCode.keys()]));
    const status = pick(ftStatuses);
    const oppId = uuid();
    opportunities.push({
      id: oppId,
      title: `Demo Field Training ${i + 1}`,
      slug: `demo-analytics-ft-${String(i + 1).padStart(3, '0')}`,
      organization_name: null,
      university_id: null,
      specialty_id: specialty?.id ?? null,
      location: pick(['Amman', 'Irbid', 'Aqaba', 'Remote']),
      training_mode: pick(['onsite', 'remote', 'hybrid']),
      short_description: 'Demo field training opportunity',
      description: 'Detailed demo field training description',
      requirements: 'Demo requirements',
      benefits: 'Demo benefits',
      seats_limit: randInt(10, 40),
      start_date: dateOnly(randomDate(8)),
      end_date: dateOnly(randomDate(4)),
      application_deadline: dateOnly(randomDate(5)),
      status,
      created_by_id: pick(users).id,
      published_at: status === 'published' ? randomDate(7) : null,
      created_at: randomDate(9),
      updated_at: new Date(),
    });

    if (status !== 'published') continue;

    const applicantCount = randInt(3, 8);
    const eligibleStudents = students.filter(
      (student) => student.specialty_id === specialty?.id
    );
    const pickedStudents = eligibleStudents.slice(i * 3, i * 3 + applicantCount);
    const oppApps = [];
    for (const student of pickedStudents) {
      if (!student) continue;
      const appId = uuid();
      const appStatus = pick(appStatuses);
      const app = {
        id: appId,
        opportunity_id: oppId,
        student_id: student.id,
        status: appStatus,
        student_message: 'Demo application message',
        admin_note: appStatus === 'rejected' ? 'Demo rejection note' : null,
        reviewed_by_id: appStatus !== 'pending' ? pick(users).id : null,
        reviewed_at: appStatus !== 'pending' ? randomDate(5) : null,
        created_at: randomDate(7),
        updated_at: new Date(),
      };
      applications.push(app);
      oppApps.push(app);
    }

    const taskCount = randInt(2, 4);
    const oppTasks = [];
    for (let t = 0; t < taskCount; t += 1) {
      const taskId = uuid();
      const task = {
        id: taskId,
        opportunity_id: oppId,
        title: `Task ${t + 1}`,
        description: 'Demo field training task',
        sort_order: t,
        due_date: dateOnly(randomDate(5)),
        created_at: randomDate(6),
        updated_at: new Date(),
      };
      tasks.push(task);
      oppTasks.push(task);
    }

    for (const app of oppApps.filter((a) => a.status === 'approved')) {
      for (const task of oppTasks.slice(0, randInt(1, oppTasks.length))) {
        taskSubs.push({
          id: uuid(),
          task_id: task.id,
          application_id: app.id,
          student_id: app.student_id,
          file_path: `uploads/demo/ft-sub-${taskSubs.length}.pdf`,
          file_name: `submission-${taskSubs.length}.pdf`,
          mime_type: 'application/pdf',
          submitted_at: randomDate(4),
          created_at: randomDate(4),
          updated_at: new Date(),
        });
      }
    }
  }

  await prisma.field_training_opportunities.createMany({ data: opportunities });
  await createManyBatched(prisma.field_training_applications, applications);
  await createManyBatched(prisma.field_training_tasks, tasks);
  await createManyBatched(prisma.field_training_task_submissions, taskSubs);
  logStat('field training opportunities', opportunities.length);
  logStat('field training applications', applications.length);
  logStat('field training tasks', tasks.length);
  logStat('field training task submissions', taskSubs.length);
}

async function seedNotificationsAndAudit(users, universities) {
  const types = ['info', 'success', 'warning', 'danger', 'system', 'action_required', 'enrollment_approved', 'enrollment_rejected'];
  const notifications = [];
  for (let i = 0; i < COUNTS.notifications; i += 1) {
    notifications.push({
      id: uuid(),
      user_id: pick(users).id,
      title: `Demo notification ${i + 1}`,
      body: 'Synthetic notification for analytics demo',
      type: pick(types),
      action_url: '/student/notifications',
      is_read: Math.random() < 0.45,
      created_at: randomDate(6),
      updated_at: new Date(),
    });
  }
  await createManyBatched(prisma.notifications, notifications);
  logStat('notifications', notifications.length);

  const auditLogs = [];
  const actions = ['USER_REGISTERED', 'USER_ACTIVATED', 'enrollment.approve', 'certificate.issue', 'report.read', 'FIELD_TRAINING_OPPORTUNITY_PUBLISHED'];
  for (let i = 0; i < COUNTS.auditLogs; i += 1) {
    auditLogs.push({
      id: uuid(),
      user_id: pick(users).id,
      university_id: pick(universities).id,
      action_type: pick(actions),
      entity_type: pick(['user', 'enrollment', 'certificate', 'cohort', 'field_training_opportunity']),
      entity_id: uuid(),
      old_values: null,
      new_values: { demo: true },
      ip_address: '127.0.0.1',
      created_at: randomDate(10),
    });
  }
  await createManyBatched(prisma.audit_logs, auditLogs);
  logStat('audit logs', auditLogs.length);
}

async function main() {
  log('⚠️  DEVELOPMENT/STAGING ONLY — analytics demo seed');
  assertSafeEnvironment();

  const existing = await findDemoUniversityIds();
  if (existing.length && !process.argv.includes(RESET_FLAG)) {
    throw new Error(
      `Demo data already exists (${existing.length} universities). Re-run with ${RESET_FLAG} to replace demo data only.`
    );
  }

  if (process.argv.includes(RESET_FLAG)) {
    await deleteDemoData();
  }

  await ensureRoles();
  const roleRows = await prisma.roles.findMany({ select: { id: true, code: true } });
  const roleByCode = new Map(roleRows.map((r) => [r.code, r.id]));

  const universities = await seedUniversities();
  const specialties = await seedSpecialties();
  const users = await seedUsers(universities, roleByCode, specialties);
  const tracks = await seedTracks();
  const mcs = await seedMicroCredentials(tracks);
  await seedMcUniversityLinks(mcs, universities);
  const { modules } = await seedLearningOutcomesAndModules(mcs);
  const cohorts = await seedCohorts(mcs, universities, users);
  const enrollments = await seedEnrollments(cohorts, users);
  const sessions = await seedSessions(cohorts, modules);
  await seedAttendance(sessions, enrollments);
  const assessments = await seedRubricsAndAssessments(cohorts, mcs);
  await seedSubmissionsAndGrades(assessments, enrollments, users);
  await seedCertificates(cohorts, enrollments, mcs);
  await seedEvidence(cohorts, mcs, users, assessments);
  await seedQaAndCorrective(cohorts, users);
  await seedRiskAndIntegrity(cohorts, users);
  await seedRecognition(cohorts, universities, mcs, users);
  await seedCourses(cohorts, users);
  await seedFieldTraining(universities, users, specialties);
  await seedNotificationsAndAudit(users, universities);

  log('—'.repeat(48));
  log('Done. Demo login password for all demo users:');
  log(`  ${DEMO_PASSWORD}`);
  log('Example super admin (existing seed): superadmin@batuni.edu / 12345678');
  log('Demo student example: demo.student.1@demo-uni-01.analytics.lms');
  log(`Summary: ${JSON.stringify(STATS, null, 2)}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-analytics-demo] FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
