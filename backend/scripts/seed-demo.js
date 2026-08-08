/**
 * Demo database reset: keeps BATTECHNO university + its users, deletes all other data,
 * then seeds Tafila Technical University with 4 tracks, 4 micro-credentials, 4 cohorts,
 * and optional demo users.
 *
 * Requirements: DATABASE_URL, bcrypt-compatible password hashing (same as app).
 * Run: node scripts/seed-demo.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Prisma } = require('@prisma/client');
const { prisma } = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

const DEMO_PASSWORD = '12345678';

const TAFILA = {
  name: 'Tafila Technical University',
  nameAr: 'جامعة الطفيلة التقنية',
  domain: 'ttu.edu.jo',
  contactEmail: 'info@ttu.edu.jo',
};

const TRACKS = [
  { name: 'Artificial Intelligence', code: 'TTU-TRK-AI' },
  { name: 'Cyber Security', code: 'TTU-TRK-SEC' },
  { name: 'Software Development', code: 'TTU-TRK-DEV' },
  { name: 'Data Science', code: 'TTU-TRK-DS' },
];

const MICS = [
  {
    title: 'أساسيات الذكاء الاصطناعي',
    titleEn: 'Foundations of Artificial Intelligence',
    code: 'TTU-MC-AI-2026',
  },
  {
    title: 'أساسيات الأمن السيبراني',
    titleEn: 'Foundations of Cyber Security',
    code: 'TTU-MC-SEC-2026',
  },
  {
    title: 'تطوير البرمجيات',
    titleEn: 'Software Development',
    code: 'TTU-MC-DEV-2026',
  },
  {
    title: 'تحليل البيانات',
    titleEn: 'Data Analysis',
    code: 'TTU-MC-DS-2026',
  },
];

const COHORT_TITLES = [
  'دفعة الذكاء الاصطناعي 2026',
  'دفعة الأمن السيبراني 2026',
  'دفعة تطوير البرمجيات 2026',
  'دفعة تحليل البيانات 2026',
];

const DEMO_USERS = [
  // Canonical five-role model — no legacy university_admin / university_reviewer.
  { full_name: 'Tafila Admin', email: 'admin@ttu.edu.jo', role: 'admin' },
  { full_name: 'Tafila Academic Reviewer', email: 'reviewer@ttu.edu.jo', role: 'reviewer' },
  { full_name: 'Tafila Student One', email: 'student1@ttu.edu.jo', role: 'student' },
  { full_name: 'Tafila Student Two', email: 'student2@ttu.edu.jo', role: 'student' },
];

function logStep(msg) {
  // eslint-disable-next-line no-console
  console.log(`[seed-demo] ${msg}`);
}

async function findBattechnoUniversityId() {
  const exact = await prisma.universities.findFirst({
    where: { name: 'BATTECHNO University' },
    select: { id: true, name: true },
  });
  if (exact) {
    logStep(`Found BATTECHNO by exact name: ${exact.name} (${exact.id})`);
    return exact.id;
  }
  const fuzzy = await prisma.universities.findFirst({
    where: {
      OR: [
        { name: { contains: 'BATTECHNO', mode: 'insensitive' } },
        { name: { contains: 'Battechno', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true },
  });
  if (fuzzy) {
    logStep(`Found BATTECHNO by fuzzy match: ${fuzzy.name} (${fuzzy.id})`);
    return fuzzy.id;
  }
  throw new Error(
    'Could not find BATTECHNO university. Expected name like "BATTECHNO University" or containing BATTECHNO.'
  );
}

async function resolveKeptUserIds(battechnoUniversityId) {
  const [fromPrimary, membershipRows] = await Promise.all([
    prisma.users.findMany({
      where: { primary_university_id: battechnoUniversityId },
      select: { id: true },
    }),
    prisma.university_users.findMany({
      where: { university_id: battechnoUniversityId },
      select: { user_id: true },
    }),
  ]);
  const idSet = new Set([
    ...fromPrimary.map((u) => u.id),
    ...membershipRows.map((m) => m.user_id),
  ]);
  if (idSet.size === 0) return [];
  return prisma.users.findMany({
    where: { id: { in: [...idSet] } },
    select: { id: true, email: true },
  });
}

function relationshipTypeForRole(roleCode) {
  if (roleCode === 'student') return 'student';
  if (roleCode === 'instructor') return 'instructor';
  if (roleCode === 'reviewer') return 'reviewer';
  if (roleCode === 'admin') return 'admin';
  return 'staff';
}

async function deleteAllDomainData(tx) {
  const steps = [
    () => tx.notifications.deleteMany(),
    () => tx.audit_logs.deleteMany(),
    () => tx.grades.deleteMany(),
    () => tx.submissions.deleteMany(),
    () => tx.attendance_records.deleteMany(),
    () => tx.evidence_files.deleteMany(),
    () => tx.integrity_cases.deleteMany(),
    () => tx.risk_cases.deleteMany(),
    () => tx.certificates.deleteMany(),
    () => tx.enrollments.deleteMany(),
    () => tx.corrective_actions.deleteMany(),
    () => tx.recognition_documents.deleteMany(),
    () => tx.recognition_requests.deleteMany(),
    () => tx.qa_reviews.deleteMany(),
    () => tx.sessions.deleteMany(),
    () => tx.assessments.deleteMany(),
    () => tx.cohorts.deleteMany(),
    () => tx.contents.deleteMany(),
    () => tx.modules.deleteMany(),
    () => tx.learning_outcomes.deleteMany(),
    () => tx.micro_credential_versions.deleteMany(),
    () => tx.micro_credential_universities.deleteMany(),
    () => tx.micro_credentials.deleteMany(),
    () => tx.rubrics.deleteMany(),
    () => tx.tracks.deleteMany(),
  ];

  for (let i = 0; i < steps.length; i += 1) {
    const label = [
      'notifications',
      'audit_logs',
      'grades',
      'submissions',
      'attendance_records',
      'evidence_files',
      'integrity_cases',
      'risk_cases',
      'certificates',
      'enrollments',
      'corrective_actions',
      'recognition_documents',
      'recognition_requests',
      'qa_reviews',
      'sessions',
      'assessments',
      'cohorts',
      'contents',
      'modules',
      'learning_outcomes',
      'micro_credential_versions',
      'micro_credential_universities',
      'micro_credentials',
      'rubrics',
      'tracks',
    ][i];
    const r = await steps[i]();
    logStep(`Deleted ${label}: ${r.count ?? 0} row(s)`);
  }
}

async function cleanupUsersAndUniversities(tx, battechnoUniversityId, keptUserIds) {
  if (keptUserIds.length === 0) {
    throw new Error('Refusing to continue: no users to keep (BATTECHNO staff would be deleted).');
  }

  const uu = await tx.university_users.deleteMany({
    where: {
      NOT: {
        AND: [{ user_id: { in: keptUserIds } }, { university_id: battechnoUniversityId }],
      },
    },
  });
  logStep(`Deleted university_users (except BATTECHNO links for kept users): ${uu.count}`);

  const ur = await tx.user_roles.deleteMany({
    where: { user_id: { notIn: keptUserIds } },
  });
  logStep(`Deleted user_roles for removed users: ${ur.count}`);

  const uDel = await tx.users.deleteMany({
    where: { id: { notIn: keptUserIds } },
  });
  logStep(`Deleted users not linked to BATTECHNO: ${uDel.count}`);

  const dom = await tx.university_email_domains.deleteMany({
    where: { university_id: { not: battechnoUniversityId } },
  });
  logStep(`Deleted university_email_domains (non-BATTECHNO): ${dom.count}`);

  const uni = await tx.universities.deleteMany({
    where: { id: { not: battechnoUniversityId } },
  });
  logStep(`Deleted universities (non-BATTECHNO): ${uni.count}`);
}

async function seedTafilaAndCurriculum(tx, passwordHash) {
  logStep('Creating Tafila Technical University…');
  const tafila = await tx.universities.create({
    data: {
      name: TAFILA.name,
      type: 'University',
      contact_email: TAFILA.contactEmail,
      status: 'active',
      partnership_state: 'active',
      notes: `${TAFILA.nameAr} — English: ${TAFILA.name}`,
    },
  });

  await tx.university_email_domains.create({
    data: {
      university_id: tafila.id,
      domain: TAFILA.domain,
      is_active: true,
    },
  });
  logStep(`Tafila university id: ${tafila.id}, domain: ${TAFILA.domain}`);

  const trackRows = [];
  for (const t of TRACKS) {
    const row = await tx.tracks.create({
      data: {
        name: t.name,
        code: t.code,
        description: `Track for ${t.name} (${TAFILA.name})`,
        status: 'active',
      },
    });
    trackRows.push(row);
    logStep(`Track: ${row.code} (${row.id})`);
  }

  const mcRows = [];
  for (let i = 0; i < MICS.length; i += 1) {
    const spec = MICS[i];
    const track = trackRows[i];
    const mc = await tx.micro_credentials.create({
      data: {
        track_id: track.id,
        title: spec.title,
        code: spec.code,
        description: spec.titleEn,
        level: 'beginner',
        duration_hours: new Prisma.Decimal('360'),
        delivery_mode: 'hybrid',
        internal_approval_status: 'approved',
        status: 'approved',
      },
    });
    await tx.micro_credential_universities.create({
      data: {
        micro_credential_id: mc.id,
        university_id: tafila.id,
      },
    });
    mcRows.push(mc);
    logStep(`Micro-credential: ${mc.code} (${mc.id})`);
  }

  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 14);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 3);

  for (let i = 0; i < COHORT_TITLES.length; i += 1) {
    const cohort = await tx.cohorts.create({
      data: {
        micro_credential_id: mcRows[i].id,
        university_id: tafila.id,
        title: COHORT_TITLES[i],
        start_date: start,
        end_date: end,
        capacity: 50,
        status: 'open_for_enrollment',
      },
    });
    logStep(`Cohort: ${cohort.title} (${cohort.id}) — open_for_enrollment, capacity 50`);
  }

  const roleByCode = new Map(
    (await tx.roles.findMany()).map((r) => [r.code, r])
  );

  for (const seed of DEMO_USERS) {
    const role = roleByCode.get(seed.role);
    if (!role) {
      logStep(`SKIP demo user ${seed.email}: role "${seed.role}" not found in DB`);
      // eslint-disable-next-line no-continue
      continue;
    }
    const user = await tx.users.upsert({
      where: { email: seed.email.toLowerCase() },
      update: {
        full_name: seed.full_name,
        password_hash: passwordHash,
        status: 'active',
        primary_university_id: tafila.id,
      },
      create: {
        full_name: seed.full_name,
        email: seed.email.toLowerCase(),
        password_hash: passwordHash,
        status: 'active',
        primary_university_id: tafila.id,
      },
    });

    const hasRole = await tx.user_roles.findFirst({
      where: { user_id: user.id, role_id: role.id },
    });
    if (!hasRole) {
      await tx.user_roles.create({
        data: { user_id: user.id, role_id: role.id },
      });
    }

    const uu = await tx.university_users.findFirst({
      where: { university_id: tafila.id, user_id: user.id },
    });
    if (!uu) {
      await tx.university_users.create({
        data: {
          university_id: tafila.id,
          user_id: user.id,
          relationship_type: relationshipTypeForRole(seed.role),
        },
      });
    }
    logStep(`Demo user ready: ${user.email} (${seed.role})`);
  }

  return { tafilaId: tafila.id };
}

async function printCounts() {
  const [universities, tracks, micros, cohortList] = await Promise.all([
    prisma.universities.count(),
    prisma.tracks.count(),
    prisma.micro_credentials.count(),
    prisma.cohorts.count(),
  ]);
  logStep('--- Counts ---');
  logStep(`universities: ${universities}`);
  logStep(`tracks: ${tracks}`);
  logStep(`micro_credentials: ${micros}`);
  logStep(`cohorts: ${cohortList}`);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run: seed-demo.js is for local/staging only. Do not run on production.');
  }
  logStep('⚠️  DEV/STAGING ONLY — TTU demo curriculum seed');
  logStep('Starting demo seed (transactional cleanup + seed)…');

  const battechnoUniversityId = await findBattechnoUniversityId();
  const kept = await resolveKeptUserIds(battechnoUniversityId);
  const keptUserIds = kept.map((u) => u.id);
  logStep(
    `Keeping BATTECHNO university ${battechnoUniversityId} and ${keptUserIds.length} user(s): ${kept.map((u) => u.email).join(', ')}`
  );

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await prisma.$transaction(
    async (tx) => {
      await deleteAllDomainData(tx);
      await cleanupUsersAndUniversities(tx, battechnoUniversityId, keptUserIds);
    },
    {
      maxWait: 60000,
      timeout: 120000,
    }
  );

  logStep('Cleanup committed. Seeding Tafila + curriculum…');

  await prisma.$transaction(
    async (tx) => {
      await seedTafilaAndCurriculum(tx, passwordHash);
    },
    {
      maxWait: 60000,
      timeout: 120000,
    }
  );

  await printCounts();
  logStep('Done. Demo password for ttu.edu.jo users (if created): ' + DEMO_PASSWORD);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed-demo] FAILED:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
