'use strict';

/**
 * Export full Tafila Field Training eligibility report (remote + onsite).
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { prisma } = require('../src/config/db');

const OPPORTUNITIES = [
  {
    id: '4d9466cb-127b-42f2-ac08-88e7fcc7c7df',
    modeAr: 'عن بعد',
    modeEn: 'remote',
  },
  {
    id: '01666ebc-bfc1-4948-87a5-2add3f641c65',
    modeAr: 'وجاهي',
    modeEn: 'onsite',
  },
];

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function statusAr(status) {
  if (status === 'eligible') return 'مؤهل';
  if (status === 'ineligible') return 'غير مؤهل';
  if (status === 'needs_review') return 'قيد المراجعة';
  return status || '—';
}

function scoreOf(app) {
  const details = app.eligibility_reason?.details || {};
  const approved = details.approvedEvaluationResult;
  if (approved && approved.approvedFinalScore != null) return approved.approvedFinalScore;
  if (details.displayFinalScore != null) return details.displayFinalScore;
  if (details.finalScore != null) return details.finalScore;
  return null;
}

function reasonsOf(app) {
  const labels = app.eligibility_reason?.labelsAr;
  if (Array.isArray(labels) && labels.length) return labels.filter(Boolean).join(' | ');
  const reasons = app.eligibility_reason?.reasons;
  if (Array.isArray(reasons) && reasons.length) return reasons.filter(Boolean).join(' | ');
  return '';
}

function tasksOf(app) {
  const details = app.eligibility_reason?.details || {};
  const tasks = details.required_tasks || details.scoreComponents?.tasks;
  if (!tasks) return '';
  const accepted = tasks.accepted ?? tasks.acceptedCount;
  const required = tasks.required ?? tasks.requiredCount;
  if (accepted == null || required == null) return '';
  return `${accepted}/${required}`;
}

(async () => {
  const rows = [];

  for (const oppMeta of OPPORTUNITIES) {
    const opp = await prisma.field_training_opportunities.findUnique({
      where: { id: oppMeta.id },
      select: { id: true, title: true, training_mode: true, status: true },
    });
    const apps = await prisma.field_training_applications.findMany({
      where: { opportunity_id: oppMeta.id, status: 'approved' },
      select: {
        id: true,
        student_id: true,
        completion_eligibility_status: true,
        eligibility_reason: true,
        training_status: true,
        attendance_percentage: true,
        post_assessment_score: true,
        completed_training_hours: true,
        academic_supervisor_name: true,
      },
      orderBy: { created_at: 'asc' },
    });
    const userIds = apps.map((a) => a.student_id);
    const users = await prisma.users.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        full_name: true,
        email: true,
        university_student_number: true,
        university_specialty: {
          select: { name_ar: true, name_en: true },
        },
        specialties: {
          select: { name_ar: true, name_en: true },
        },
      },
    });
    const userById = Object.fromEntries(users.map((u) => [u.id, u]));

    for (const app of apps) {
      const user = userById[app.student_id] || {};
      const specialty =
        user.university_specialty?.name_ar ||
        user.university_specialty?.name_en ||
        user.specialties?.name_ar ||
        user.specialties?.name_en ||
        '';
      const score = scoreOf(app);
      rows.push({
        modeAr: oppMeta.modeAr,
        modeEn: opp?.training_mode || oppMeta.modeEn,
        opportunityId: oppMeta.id,
        opportunityTitle: opp?.title || '',
        studentName: user.full_name || '',
        universityNumber: user.university_student_number || '',
        email: user.email || '',
        specialty,
        supervisor: app.academic_supervisor_name || '',
        eligibilityStatus: app.completion_eligibility_status || '',
        eligibilityStatusAr: statusAr(app.completion_eligibility_status),
        approvedScore: score,
        tasks: tasksOf(app),
        attendancePercent:
          app.attendance_percentage != null ? Number(app.attendance_percentage) : '',
        postAssessment:
          app.post_assessment_score != null ? Number(app.post_assessment_score) : '',
        completedHours:
          app.completed_training_hours != null ? Number(app.completed_training_hours) : '',
        trainingStatus: app.training_status || '',
        reasons: reasonsOf(app),
        source: app.eligibility_reason?.details?.approvedEvaluationResult?.source || '',
      });
    }
  }

  rows.sort((a, b) => {
    if (a.modeAr !== b.modeAr) return a.modeAr === 'عن بعد' ? -1 : 1;
    if (a.eligibilityStatus !== b.eligibilityStatus) {
      return a.eligibilityStatus === 'eligible' ? -1 : 1;
    }
    return String(a.studentName).localeCompare(String(b.studentName), 'ar');
  });

  const headers = [
    '#',
    'نمط_التدريب',
    'الفرصة',
    'اسم_الطالب',
    'الرقم_الجامعي',
    'البريد',
    'التخصص',
    'المشرف_الأكاديمي',
    'الحالة',
    'العلامة_المعتمدة',
    'التاسكات',
    'الحضور_%',
    'التقييم_البعدي',
    'الساعات',
    'حالة_التدريب',
    'الأسباب',
    'مصدر_النتيجة',
    'معرّف_الفرصة',
  ];

  const csvLines = [headers.join(',')];
  rows.forEach((r, i) => {
    csvLines.push(
      [
        i + 1,
        r.modeAr,
        r.opportunityTitle,
        r.studentName,
        r.universityNumber,
        r.email,
        r.specialty,
        r.supervisor,
        r.eligibilityStatusAr,
        r.approvedScore != null && r.approvedScore !== '' ? r.approvedScore : '—',
        r.tasks || '—',
        r.attendancePercent !== '' ? r.attendancePercent : '—',
        r.postAssessment !== '' ? r.postAssessment : '—',
        r.completedHours !== '' ? r.completedHours : '—',
        r.trainingStatus || '—',
        r.reasons || (r.eligibilityStatus === 'eligible' ? 'مؤهل وفق النتيجة المعتمدة' : ''),
        r.source || '—',
        r.opportunityId,
      ]
        .map(csvEscape)
        .join(',')
    );
  });

  const outCsv = path.join(
    __dirname,
    '..',
    '..',
    'BATTECHNO_LMS_TAFILA_ALL_STUDENTS_ELIGIBILITY_REPORT.csv'
  );
  fs.writeFileSync(outCsv, `\uFEFF${csvLines.join('\n')}`, 'utf8');

  const summary = {
    generatedAt: new Date().toISOString(),
    total: rows.length,
    byMode: {},
    byStatus: { eligible: 0, ineligible: 0, other: 0 },
  };
  for (const r of rows) {
    if (!summary.byMode[r.modeAr]) {
      summary.byMode[r.modeAr] = { total: 0, eligible: 0, ineligible: 0 };
    }
    summary.byMode[r.modeAr].total += 1;
    if (r.eligibilityStatus === 'eligible') {
      summary.byMode[r.modeAr].eligible += 1;
      summary.byStatus.eligible += 1;
    } else if (r.eligibilityStatus === 'ineligible') {
      summary.byMode[r.modeAr].ineligible += 1;
      summary.byStatus.ineligible += 1;
    } else {
      summary.byStatus.other += 1;
    }
  }

  const listIneligible = (mode) =>
    rows
      .filter((r) => r.modeAr === mode && r.eligibilityStatus === 'ineligible')
      .map(
        (r, i) =>
          `${i + 1}. **${r.studentName}** (\`${r.universityNumber || '—'}\`) — العلامة: ${
            r.approvedScore ?? '—'
          } — ${r.reasons || 'غير مؤهل'}`
      )
      .join('\n') || '_لا يوجد_';

  const listEligible = (mode) =>
    rows
      .filter((r) => r.modeAr === mode && r.eligibilityStatus === 'eligible')
      .map(
        (r, i) =>
          `${i + 1}. ${r.studentName} | ${r.universityNumber || '—'} | ${r.approvedScore ?? '—'} /100 | ${r.specialty || '—'}`
      )
      .join('\n') || '_لا يوجد_';

  const md = `# تقرير أهلية طلاب جامعة الطفيلة التقنية — التدريب الميداني

**تاريخ التوليد:** ${summary.generatedAt}

## الملخص

| البند | العدد |
|---|---:|
| إجمالي الطلاب (طلبات معتمدة) | ${summary.total} |
| مؤهل | ${summary.byStatus.eligible} |
| غير مؤهل | ${summary.byStatus.ineligible} |

### حسب نمط التدريب

| النمط | الإجمالي | مؤهل | غير مؤهل |
|---|---:|---:|---:|
${Object.entries(summary.byMode)
  .map(([mode, s]) => `| ${mode} | ${s.total} | ${s.eligible} | ${s.ineligible} |`)
  .join('\n')}

### الفرص

| النمط | معرّف الفرصة |
|---|---|
| عن بعد (remote) | \`4d9466cb-127b-42f2-ac08-88e7fcc7c7df\` |
| وجاهي (onsite) | \`01666ebc-bfc1-4948-87a5-2add3f641c65\` |

الملف التفصيلي الكامل: \`BATTECHNO_LMS_TAFILA_ALL_STUDENTS_ELIGIBILITY_REPORT.csv\`

---

## 1) عن بعد — المؤهلون (${summary.byMode['عن بعد']?.eligible || 0})

| # | الاسم | الرقم الجامعي | العلامة | التخصص |
|---|---|---|---:|---|
${rows
  .filter((r) => r.modeAr === 'عن بعد' && r.eligibilityStatus === 'eligible')
  .map(
    (r, i) =>
      `| ${i + 1} | ${r.studentName} | ${r.universityNumber || '—'} | ${r.approvedScore ?? '—'} | ${r.specialty || '—'} |`
  )
  .join('\n')}

## 2) عن بعد — غير المؤهلين (${summary.byMode['عن بعد']?.ineligible || 0})

${listIneligible('عن بعد')}

## 3) وجاهي — المؤهلون (${summary.byMode['وجاهي']?.eligible || 0})

| # | الاسم | الرقم الجامعي | العلامة | التخصص |
|---|---|---|---:|---|
${rows
  .filter((r) => r.modeAr === 'وجاهي' && r.eligibilityStatus === 'eligible')
  .map(
    (r, i) =>
      `| ${i + 1} | ${r.studentName} | ${r.universityNumber || '—'} | ${r.approvedScore ?? '—'} | ${r.specialty || '—'} |`
  )
  .join('\n')}

## 4) وجاهي — غير المؤهلين (${summary.byMode['وجاهي']?.ineligible || 0})

${listIneligible('وجاهي')}
`;

  const outMd = path.join(
    __dirname,
    '..',
    '..',
    'BATTECHNO_LMS_TAFILA_ALL_STUDENTS_ELIGIBILITY_REPORT.md'
  );
  fs.writeFileSync(outMd, md, 'utf8');

  // Also refresh the older ineligible-only CSV for convenience
  const inelig = rows.filter((r) => r.eligibilityStatus === 'ineligible');
  const ineligCsv = [
    '#,نمط_التدريب,الاسم,الرقم_الجامعي,التخصص,الحالة,العلامة,التاسكات,اسباب_عدم_التاهيل',
    ...inelig.map((r, i) =>
      [
        i + 1,
        r.modeAr,
        r.studentName,
        r.universityNumber,
        r.specialty,
        'غير مؤهل',
        r.approvedScore != null ? r.approvedScore : '—',
        r.tasks || '—',
        r.reasons || '',
      ]
        .map(csvEscape)
        .join(',')
    ),
  ].join('\n');
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'BATTECHNO_LMS_TAFILA_INELIGIBLE_STUDENTS.csv'),
    `\uFEFF${ineligCsv}`,
    'utf8'
  );

  console.log(JSON.stringify({ outCsv, outMd, summary }, null, 2));
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
