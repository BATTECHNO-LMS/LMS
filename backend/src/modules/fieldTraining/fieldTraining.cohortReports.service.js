'use strict';

/**
 * Opportunity-scoped final + comprehensive cohort reports + Excel/PDF export.
 * Uses canonical approved evaluation results (no independent score recalculation).
 * Task submission counts come from LMS submissions only.
 */

const ExcelJS = require('exceljs');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const repo = require('./fieldTraining.repository');
const ftAccess = require('./fieldTraining.access');
const { renderHtmlToPdf } = require('../analytics/pdfRenderer');
const {
  resolveFieldTrainingApprovedResult,
  sourceLabelAr,
  SOURCE_AR,
  PRIMARY_TAFILA_OPPORTUNITY_ID,
} = require('./fieldTraining.tafilaApprovedResult.service');
const { LOGIN_ACTION } = require('./fieldTraining.activityTranslate');
const { ACCEPTED_TASK_STATUSES } = require('./fieldTrainingEvaluation.constants');

const TAFILA_ONLINE_EXPECTED = Object.freeze({
  opportunityId: PRIMARY_TAFILA_OPPORTUNITY_ID,
  students: 151,
  eligible: 146,
  notEligible: 5,
});

function round1(n) {
  if (n == null || !Number.isFinite(Number(n))) return null;
  return Math.round(Number(n) * 10) / 10;
}

function statusAr(status) {
  if (status === 'eligible' || status === 'ELIGIBLE') return 'مؤهل';
  if (status === 'ineligible' || status === 'NOT_ELIGIBLE') return 'غير مؤهل';
  return status || 'غير متوفر';
}

function humanSourceAr(source) {
  if (!source) return 'غير متوفر';
  const MAP = {
    AUTHORIZED_MANUAL_REVIEW: 'مراجعة واعتماد نهائي',
    AUTHORIZED_MANUAL_REVIEW_LEGACY_TASK_COMPONENT: 'مراجعة واعتماد نهائي',
    AUTHORIZED_MANUAL_REVIEW_TASK_NORMALIZATION: 'مراجعة واعتماد نهائي',
    EXCEL_BASELINE: 'النتيجة النهائية المعتمدة',
    AUTHORIZED_ADMIN_ELIGIBILITY_OVERRIDE: 'قرار إداري معتمد',
    AUTHORIZED_GRADE_OVERRIDE: 'قرار إداري معتمد',
    VERIFIED_RECALCULATION_FROM_LMS_EVIDENCE: 'النتيجة النهائية المعتمدة',
  };
  if (MAP[source]) return MAP[source];
  if (SOURCE_AR[source]) return SOURCE_AR[source];
  return sourceLabelAr(source) || 'النتيجة النهائية المعتمدة';
}

function scoreBucket(score, status) {
  if (status === 'ineligible' || status === 'NOT_ELIGIBLE') return 'not_eligible';
  if (score == null) return 'incomplete';
  const n = Number(score);
  if (n >= 90) return '90_100';
  if (n >= 80) return '80_89';
  return 'below_80';
}

function sanitizeFilenamePart(value) {
  return String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}

function asciiDownloadSlug(value, fallback = 'report') {
  const raw = String(value || '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return raw || fallback;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function assertOpportunityAccess(user, opportunityId) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await ftAccess.assertManageOpportunityAccess(user, opp);
  return opp;
}

/**
 * Batch LMS submission counts for required tasks (no fabrication).
 */
async function loadLmsTaskSubmissionCounts(opportunityId, applicationIds) {
  const requiredTasks = await prisma.field_training_tasks.findMany({
    where: { opportunity_id: opportunityId, NOT: { is_required: false } },
    select: { id: true },
  });
  const requiredCount = requiredTasks.length;
  const requiredIds = requiredTasks.map((t) => t.id);
  const counts = Object.fromEntries(
    applicationIds.map((id) => [id, { submitted: 0, graded: 0, required: requiredCount }])
  );
  if (!applicationIds.length || !requiredIds.length) return counts;

  const subs = await prisma.field_training_task_submissions.findMany({
    where: {
      application_id: { in: applicationIds },
      task_id: { in: requiredIds },
    },
    select: { application_id: true, review_status: true },
  });
  for (const s of subs) {
    const row = counts[s.application_id];
    if (!row) continue;
    row.submitted += 1;
    if (ACCEPTED_TASK_STATUSES.includes(String(s.review_status))) row.graded += 1;
  }
  return counts;
}

function sortReportRows(rows) {
  return [...rows].sort((a, b) => {
    const ae = a.status === 'eligible' ? 0 : 1;
    const be = b.status === 'eligible' ? 0 : 1;
    if (ae !== be) return ae - be;
    return String(a.studentName || '').localeCompare(String(b.studentName || ''), 'ar');
  });
}

function staleEligibleFailureReason(labels = []) {
  return (labels || []).some(
    (x) =>
      String(x).includes('أقل من 80') ||
      String(x).includes('جميع التاسكات') ||
      String(x).includes('لم يستكمل جميع التاسكات')
  );
}

async function loadApprovedStudentRows(opportunityId, filters = {}) {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunityId, status: 'approved' },
    select: {
      id: true,
      student_id: true,
      completion_eligibility_status: true,
      eligibility_reason: true,
      attendance_percentage: true,
      completed_training_hours: true,
      post_assessment_score: true,
      pre_assessment_score: true,
      academic_supervisor_name: true,
      completion_letter_issued_at: true,
      training_status: true,
    },
  });
  const profiles = await repo.findStudentProfilesByIds(apps.map((a) => a.student_id));
  const byId = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const taskCounts = await loadLmsTaskSubmissionCounts(
    opportunityId,
    apps.map((a) => a.id)
  );

  let rows = apps.map((app) => {
    const profile = byId[app.student_id] || {};
    const details = app.eligibility_reason?.details || {};
    const approved = details.approvedEvaluationResult || null;
    const breakdown = approved?.scoreBreakdown || details.scoreBreakdown || null;
    const score =
      approved?.approvedFinalScore ?? details.displayFinalScore ?? details.finalScore ?? null;
    const status =
      approved?.approvedStatus === 'ELIGIBLE'
        ? 'eligible'
        : approved?.approvedStatus === 'NOT_ELIGIBLE'
          ? 'ineligible'
          : app.completion_eligibility_status;
    const tasks = taskCounts[app.id] || { submitted: 0, graded: 0, required: 0 };
    const labels = app.eligibility_reason?.labelsAr || [];
    return {
      applicationId: app.id,
      studentId: app.student_id,
      studentName: profile.full_name || '',
      universityNumber: profile.university_student_number || '',
      email: profile.email || '',
      specialty:
        profile.university_specialty?.name_ar ||
        profile.specialty?.name_ar ||
        profile.university_specialty_label ||
        '',
      academicSupervisor: app.academic_supervisor_name || '',
      status,
      statusAr: statusAr(status),
      approvedFinalScore: score == null ? null : round1(score),
      attendancePoints: breakdown?.attendancePoints ?? null,
      postAssessmentPoints: breakdown?.postAssessmentPoints ?? null,
      taskPoints: breakdown?.taskPoints ?? null,
      behaviorPoints: breakdown?.behaviorPoints ?? null,
      completedHours: app.completed_training_hours != null ? Number(app.completed_training_hours) : null,
      attendancePercent: app.attendance_percentage != null ? Number(app.attendance_percentage) : null,
      preAssessment: app.pre_assessment_score != null ? Number(app.pre_assessment_score) : null,
      postAssessment: app.post_assessment_score != null ? Number(app.post_assessment_score) : null,
      postAssessmentPercent:
        app.post_assessment_score != null ? Number(app.post_assessment_score) : null,
      submittedTaskCount: tasks.submitted,
      gradedTaskCount: tasks.graded,
      requiredTaskCount: tasks.required,
      tasksDisplay: `${tasks.submitted}/${tasks.required}`,
      reasons: labels,
      conciseNotEligibleReason:
        status === 'ineligible' ? (labels.filter(Boolean)[0] || 'غير مؤهل') : '',
      source: approved?.source || null,
      sourceLabelAr: humanSourceAr(approved?.source),
      approvedAt: approved?.approvedAt || null,
      completionLetterIssued: Boolean(app.completion_letter_issued_at),
      trainingStatus: app.training_status,
      scoreBreakdown: breakdown,
      opportunityId,
    };
  });

  if (filters.eligibility === 'eligible') rows = rows.filter((r) => r.status === 'eligible');
  if (filters.eligibility === 'ineligible') rows = rows.filter((r) => r.status === 'ineligible');
  if (filters.specialty) {
    const q = String(filters.specialty).trim();
    rows = rows.filter((r) => String(r.specialty || '').includes(q));
  }
  if (filters.supervisor) {
    const q = String(filters.supervisor).trim();
    rows = rows.filter((r) => String(r.academicSupervisor || '').includes(q));
  }
  if (filters.scoreMin != null) {
    rows = rows.filter((r) => r.approvedFinalScore != null && r.approvedFinalScore >= Number(filters.scoreMin));
  }
  if (filters.scoreMax != null) {
    rows = rows.filter((r) => r.approvedFinalScore != null && r.approvedFinalScore <= Number(filters.scoreMax));
  }

  return sortReportRows(rows);
}

function validateOpportunityReportDataset(opportunityId, students) {
  const checks = [];
  const eligible = students.filter((s) => s.status === 'eligible');
  const notEligible = students.filter((s) => s.status === 'ineligible');
  const isPrimary = opportunityId === PRIMARY_TAFILA_OPPORTUNITY_ID;

  const push = (name, ok, detail = null) => checks.push({ name, ok: Boolean(ok), detail });

  if (isPrimary) {
    push('students_151', students.length === TAFILA_ONLINE_EXPECTED.students, {
      expected: TAFILA_ONLINE_EXPECTED.students,
      actual: students.length,
    });
    push('eligible_146', eligible.length === TAFILA_ONLINE_EXPECTED.eligible, {
      expected: TAFILA_ONLINE_EXPECTED.eligible,
      actual: eligible.length,
    });
    push('not_eligible_5', notEligible.length === TAFILA_ONLINE_EXPECTED.notEligible, {
      expected: TAFILA_ONLINE_EXPECTED.notEligible,
      actual: notEligible.length,
    });
  } else {
    push('students_present', students.length > 0, { actual: students.length });
  }

  push(
    'eligible_below_80_zero',
    eligible.every((s) => s.approvedFinalScore != null && Number(s.approvedFinalScore) >= 80)
  );
  push(
    'eligible_null_zero',
    eligible.every((s) => s.approvedFinalScore != null)
  );
  push(
    'final_score_gt_100_zero',
    students.every((s) => s.approvedFinalScore == null || Number(s.approvedFinalScore) <= 100)
  );
  push(
    'final_score_lt_0_zero',
    students.every((s) => s.approvedFinalScore == null || Number(s.approvedFinalScore) >= 0)
  );

  let breakdownMismatch = 0;
  for (const s of students) {
    if (s.approvedFinalScore == null) continue;
    const sum =
      Number(s.attendancePoints || 0) +
      Number(s.postAssessmentPoints || 0) +
      Number(s.taskPoints || 0) +
      Number(s.behaviorPoints || 0);
    if (Math.abs(sum - Number(s.approvedFinalScore)) > 0.05) breakdownMismatch += 1;
  }
  push('score_breakdown_mismatch_zero', breakdownMismatch === 0, { count: breakdownMismatch });

  const stale = eligible.filter((s) => staleEligibleFailureReason(s.reasons)).length;
  push('eligible_stale_failure_reason_zero', stale === 0, { count: stale });

  const uniNums = students.map((s) => String(s.universityNumber || '').trim()).filter(Boolean);
  const dup = uniNums.length - new Set(uniNums).size;
  push('duplicate_university_number_zero', dup === 0, { count: dup });

  push(
    'opportunity_mismatch_zero',
    students.every((s) => !s.opportunityId || s.opportunityId === opportunityId)
  );

  const ready = checks.every((c) => c.ok);
  return {
    ready,
    statusAr: ready ? 'جاهز للإصدار' : 'يوجد تعارض في بيانات التقرير',
    checks,
    issues: checks.filter((c) => !c.ok),
    summary: {
      totalStudents: students.length,
      eligible: eligible.length,
      notEligible: notEligible.length,
      eligibleBelow80: eligible.filter(
        (s) => s.approvedFinalScore == null || Number(s.approvedFinalScore) < 80
      ).length,
      breakdownMismatch,
      staleFailureReasons: stale,
    },
  };
}

async function validateOpportunityReport(user, opportunityId, filters = {}) {
  const opp = await assertOpportunityAccess(user, opportunityId);
  // Official validation always uses full cohort (ignore UI filters).
  const students = await loadApprovedStudentRows(opportunityId, {});
  const validation = validateOpportunityReportDataset(opportunityId, students);
  return {
    opportunityId: opp.id,
    opportunityTitle: opp.title,
    trainingMode: opp.training_mode,
    trainingModeAr:
      opp.training_mode === 'remote' ? 'عن بعد' : opp.training_mode === 'onsite' ? 'وجاهي' : opp.training_mode,
    university: opp.universities?.name || opp.university_name || 'جامعة الطفيلة التقنية',
    generatedAt: new Date().toISOString(),
    filtersIgnoredForOfficialValidation: Boolean(filters && Object.keys(filters).length),
    ...validation,
  };
}

function buildSummary(opp, students) {
  const eligible = students.filter((s) => s.status === 'eligible');
  const notEligible = students.filter((s) => s.status === 'ineligible');
  const scores = eligible.map((s) => s.approvedFinalScore).filter((n) => n != null);
  const attendanceVals = students.map((s) => s.attendancePercent).filter((n) => n != null);
  const requiredHours = opp.required_training_hours != null ? Number(opp.required_training_hours) : null;
  const taskPointVals = students.map((s) => s.taskPoints).filter((n) => n != null);
  const submissionBuckets = { '4/4': 0, '3/4': 0, '2/4': 0, '1/4': 0, '0/4': 0, other: 0 };
  for (const s of students) {
    const key = `${s.submittedTaskCount}/${s.requiredTaskCount}`;
    if (submissionBuckets[key] != null) submissionBuckets[key] += 1;
    else submissionBuckets.other += 1;
  }
  return {
    totalStudents: students.length,
    eligible: eligible.length,
    notEligible: notEligible.length,
    eligibilityRatePercent: students.length
      ? round1((eligible.length / students.length) * 100)
      : null,
    averageApprovedFinalScore: scores.length
      ? round1(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
    highestScore: scores.length ? Math.max(...scores) : null,
    lowestScore: scores.length ? Math.min(...scores) : null,
    averageAttendance: attendanceVals.length
      ? round1(attendanceVals.reduce((a, b) => a + b, 0) / attendanceVals.length)
      : null,
    averageApprovedTaskPoints: taskPointVals.length
      ? round1(taskPointVals.reduce((a, b) => a + b, 0) / taskPointVals.length)
      : null,
    studentsCompletingRequiredHours: requiredHours
      ? students.filter((s) => s.completedHours != null && s.completedHours >= requiredHours).length
      : null,
    completionLettersIssued: students.filter((s) => s.completionLetterIssued).length,
    eligibleBelow80: eligible.filter(
      (s) => s.approvedFinalScore == null || s.approvedFinalScore < 80
    ).length,
    taskSubmissionBuckets: submissionBuckets,
  };
}

async function buildOpportunityFinalReport(user, opportunityId, filters = {}, options = {}) {
  const opp = await assertOpportunityAccess(user, opportunityId);
  const official = options.official === true;
  const students = await loadApprovedStudentRows(opportunityId, official ? {} : filters);
  const validation = validateOpportunityReportDataset(opportunityId, students);
  const summary = buildSummary(opp, students);
  const resultVersion =
    students
      .map((s) => s.approvedAt)
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || new Date().toISOString();

  return {
    reportType: 'final',
    companyName: 'BATMAN TECHNOLOGY',
    generatedAt: new Date().toISOString(),
    generatedBy: user?.userId || user?.id || null,
    resultVersion,
    opportunityId: opp.id,
    university: opp.universities?.name || opp.university_name || 'جامعة الطفيلة التقنية',
    opportunity: {
      id: opp.id,
      title: opp.title,
      trainingMode: opp.training_mode,
      trainingModeAr:
        opp.training_mode === 'remote' ? 'عن بعد' : opp.training_mode === 'onsite' ? 'وجاهي' : opp.training_mode,
    },
    validation,
    summary,
    students: students.map((s, index) => ({
      seq: index + 1,
      applicationId: s.applicationId,
      studentName: s.studentName,
      universityNumber: s.universityNumber,
      email: s.email,
      specialty: s.specialty,
      academicSupervisor: s.academicSupervisor,
      status: s.statusAr,
      statusCode: s.status,
      approvedFinalScore: s.approvedFinalScore,
      attendancePercent: s.attendancePercent,
      attendancePoints: s.attendancePoints,
      postAssessmentPercent: s.postAssessmentPercent,
      postAssessmentPoints: s.postAssessmentPoints,
      submittedTasks: s.tasksDisplay,
      submittedTaskCount: s.submittedTaskCount,
      requiredTaskCount: s.requiredTaskCount,
      taskPoints: s.taskPoints,
      behaviorPoints: s.behaviorPoints,
      completedHours: s.completedHours,
      trainingStatus: s.trainingStatus,
      notEligibleReason: s.conciseNotEligibleReason,
      approvedResultSource: s.sourceLabelAr,
      approvedSourceCode: s.source,
      approvedAt: s.approvedAt,
    })),
  };
}

async function buildOpportunityComprehensiveReport(user, opportunityId, filters = {}, options = {}) {
  const finalReport = await buildOpportunityFinalReport(user, opportunityId, filters, options);
  const students = await loadApprovedStudentRows(opportunityId, options.official ? {} : filters);
  const studentIds = [...new Set(students.map((s) => s.studentId))];

  const distribution = {
    '90_100': 0,
    '80_89': 0,
    below_80: 0,
    not_eligible: 0,
    incomplete: 0,
  };
  for (const s of students) {
    distribution[scoreBucket(s.approvedFinalScore, s.status)] += 1;
  }

  const loginRows =
    studentIds.length === 0
      ? []
      : await prisma.audit_logs
          .groupBy({
            by: ['user_id'],
            where: { user_id: { in: studentIds }, action_type: LOGIN_ACTION },
            _count: { _all: true },
            _max: { created_at: true },
          })
          .catch(() => []);

  const loginByUser = Object.fromEntries(
    (loginRows || []).map((r) => [r.user_id, { count: r._count._all, lastAt: r._max.created_at }])
  );
  const studentsWithLogin = studentIds.filter((id) => loginByUser[id]?.count > 0).length;
  const totalLogins = Object.values(loginByUser).reduce((a, b) => a + (b.count || 0), 0);

  const notEligibleReasons = {};
  for (const s of students.filter((x) => x.status === 'ineligible')) {
    for (const reason of s.reasons || []) {
      notEligibleReasons[reason] = (notEligibleReasons[reason] || 0) + 1;
    }
  }

  const bySupervisor = {};
  for (const s of students) {
    const key = s.academicSupervisor || 'غير محدد';
    if (!bySupervisor[key]) bySupervisor[key] = { total: 0, eligible: 0, notEligible: 0 };
    bySupervisor[key].total += 1;
    if (s.status === 'eligible') bySupervisor[key].eligible += 1;
    else bySupervisor[key].notEligible += 1;
  }

  return {
    ...finalReport,
    reportType: 'comprehensive',
    distribution: {
      from90to100: distribution['90_100'],
      from80to89: distribution['80_89'],
      below80: distribution.below_80,
      notEligible: distribution.not_eligible,
      incomplete: distribution.incomplete,
    },
    activitySummary: {
      studentsWithAtLeastOneLogin: studentsWithLogin,
      studentsWithNoTrackedLogin: Math.max(0, studentIds.length - studentsWithLogin),
      totalSuccessfulLoginEvents: totalLogins,
      averageLoginsPerStudent: studentIds.length ? round1(totalLogins / studentIds.length) : 0,
      noteAr:
        studentsWithLogin === 0
          ? 'بيانات تسجيل الدخول التاريخية غير متاحة بالكامل'
          : 'إحصاءات تسجيل الدخول تعتمد على أحداث USER_LOGIN_SUCCESS المسجّلة؛ القيم التاريخية قبل التتبع قد تكون غير متاحة.',
    },
    notEligibleReasonCounts: notEligibleReasons,
    academicSupervisorGrouping: bySupervisor,
    assessmentStats: {
      preCompleted: students.filter((s) => s.preAssessment != null).length,
      postCompleted: students.filter((s) => s.postAssessment != null).length,
    },
    taskAnalytics: {
      source: 'LMS_SUBMISSIONS',
      buckets: finalReport.summary.taskSubmissionBuckets,
      averageApprovedTaskPoints: finalReport.summary.averageApprovedTaskPoints,
    },
    isPrimaryTafilaOnline: opportunityId === PRIMARY_TAFILA_OPPORTUNITY_ID,
  };
}

function renderFinalReportHtml(report) {
  const s = report.summary || {};
  const rows = (report.students || [])
    .map(
      (st) => `<tr>
      <td>${esc(st.seq)}</td>
      <td>${esc(st.studentName)}</td>
      <td>${esc(st.universityNumber)}</td>
      <td>${esc(st.specialty)}</td>
      <td>${esc(st.attendancePoints ?? 'غير متوفر')}</td>
      <td>${esc(st.postAssessmentPoints ?? 'غير متوفر')}</td>
      <td>${esc(st.taskPoints ?? 'غير متوفر')}</td>
      <td>${esc(st.behaviorPoints ?? 'غير متوفر')}</td>
      <td>${esc(st.approvedFinalScore ?? 'غير متوفر')}</td>
      <td>${esc(st.status)}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>تقرير التدريب الميداني النهائي</title>
<style>
  body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;color:#111;margin:28px}
  h1{font-size:22px;margin:0 0 4px}
  h2{font-size:15px;margin:22px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
  .brand{font-size:13px;color:#444;margin-bottom:12px}
  .meta{font-size:13px;line-height:1.7;margin-bottom:14px}
  .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 18px}
  .card{border:1px solid #e5e7eb;border-radius:8px;padding:10px}
  .card strong{display:block;font-size:18px}
  .card span{color:#666;font-size:12px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border:1px solid #ccc;padding:5px 6px;text-align:right}
  th{background:#f3f4f6}
</style>
</head>
<body>
  <div class="brand"><strong>BATMAN TECHNOLOGY</strong></div>
  <h1>تقرير التدريب الميداني النهائي</h1>
  <div class="meta">
    <div>${esc(report.university)}</div>
    <div>اسم الفرصة: ${esc(report.opportunity?.title)}</div>
    <div>نمط التدريب: ${esc(report.opportunity?.trainingModeAr)}</div>
  </div>
  <div class="cards">
    <div class="card"><span>عدد الطلبة</span><strong>${esc(s.totalStudents)}</strong></div>
    <div class="card"><span>المؤهلون</span><strong>${esc(s.eligible)}</strong></div>
    <div class="card"><span>غير المؤهلين</span><strong>${esc(s.notEligible)}</strong></div>
    <div class="card"><span>متوسط العلامة</span><strong>${esc(s.averageApprovedFinalScore ?? 'غير متوفر')}</strong></div>
  </div>
  <div class="meta">
    نسبة التأهيل: ${esc(s.eligibilityRatePercent ?? 'غير متوفر')}% ·
    أعلى علامة: ${esc(s.highestScore ?? 'غير متوفر')} ·
    أدنى علامة: ${esc(s.lowestScore ?? 'غير متوفر')} ·
    متوسط الحضور: ${esc(s.averageAttendance ?? 'غير متوفر')}% ·
    أكملوا الساعات: ${esc(s.studentsCompletingRequiredHours ?? 'غير متوفر')}
  </div>
  <h2>قائمة الطلبة</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>اسم الطالب</th><th>الرقم الجامعي</th><th>التخصص</th>
        <th>الحضور /20</th><th>البعدي /20</th><th>التاسكات /40</th><th>السلوك والالتزام /20</th>
        <th>النهائية /100</th><th>الحالة</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function renderComprehensiveReportHtml(report) {
  const finalHtml = renderFinalReportHtml(report);
  const dist = report.distribution || {};
  const act = report.activitySummary || {};
  const buckets = report.taskAnalytics?.buckets || {};
  const extra = `
  <h2>توزيع العلامات</h2>
  <div class="meta">
    90 إلى 100: ${esc(dist.from90to100)} ·
    80 إلى 89.9: ${esc(dist.from80to89)} ·
    أقل من 80: ${esc(dist.below80)} ·
    غير مؤهل: ${esc(dist.notEligible)} ·
    غير مكتمل: ${esc(dist.incomplete)}
  </div>
  <h2>تحليل التاسكات</h2>
  <div class="meta">
    4 من 4: ${esc(buckets['4/4'] || 0)} ·
    3 من 4: ${esc(buckets['3/4'] || 0)} ·
    2 من 4: ${esc(buckets['2/4'] || 0)} ·
    1 من 4: ${esc(buckets['1/4'] || 0)} ·
    0 من 4: ${esc(buckets['0/4'] || 0)} ·
    متوسط مكون التاسكات: ${esc(report.taskAnalytics?.averageApprovedTaskPoints ?? 'غير متوفر')} /40
  </div>
  <h2>نشاط المنصة</h2>
  <div class="meta">${esc(act.noteAr || '')}<br/>
    طلاب لديهم تسجيل دخول: ${esc(act.studentsWithAtLeastOneLogin)} ·
    إجمالي تسجيلات الدخول: ${esc(act.totalSuccessfulLoginEvents)} ·
    المتوسط: ${esc(act.averageLoginsPerStudent)}
  </div>`;
  return finalHtml.replace('</body>', `${extra}</body>`);
}

async function exportOpportunityFinalReportPdf(user, opportunityId, filters = {}) {
  const report = await buildOpportunityFinalReport(user, opportunityId, filters, { official: true });
  if (!report.validation?.ready) {
    throw new ApiError(409, report.validation.statusAr || 'يوجد تعارض في بيانات التقرير', {
      issues: report.validation.issues,
    }, 'REPORT_VALIDATION_FAILED');
  }
  const buffer = await renderHtmlToPdf(renderFinalReportHtml(report), {
    lang: 'ar',
    footerLeft: 'BATMAN TECHNOLOGY · تقرير التدريب الميداني النهائي',
    footerNote: report.generatedAt,
  });
  return {
    buffer,
    contentType: 'application/pdf',
    filename: `Tafila_Field_Training_Final_Report_2025_2026.pdf`,
    report,
  };
}

async function exportOpportunityComprehensiveReportPdf(user, opportunityId, filters = {}) {
  const report = await buildOpportunityComprehensiveReport(user, opportunityId, filters, {
    official: true,
  });
  if (!report.validation?.ready) {
    throw new ApiError(409, report.validation.statusAr || 'يوجد تعارض في بيانات التقرير', {
      issues: report.validation.issues,
    }, 'REPORT_VALIDATION_FAILED');
  }
  const buffer = await renderHtmlToPdf(renderComprehensiveReportHtml(report), {
    lang: 'ar',
    footerLeft: 'BATMAN TECHNOLOGY · التقرير الشامل للتدريب الميداني',
    footerNote: report.generatedAt,
  });
  return {
    buffer,
    contentType: 'application/pdf',
    filename: `Tafila_Field_Training_Comprehensive_Report_2025_2026.pdf`,
    report,
  };
}

async function exportOpportunityOfficialExcel(user, opportunityId, filters = {}) {
  const report = await buildOpportunityFinalReport(user, opportunityId, filters, { official: true });
  if (!report.validation?.ready) {
    throw new ApiError(409, report.validation.statusAr || 'يوجد تعارض في بيانات التقرير', {
      issues: report.validation.issues,
    }, 'REPORT_VALIDATION_FAILED');
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'BATMAN TECHNOLOGY';
  wb.created = new Date();
  const ws = wb.addWorksheet('الطلاب', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  const headers = [
    '#',
    'اسم_الطالب',
    'الرقم_الجامعي',
    'البريد',
    'التخصص',
    'المشرف_الأكاديمي',
    'نمط_التدريب',
    'الحالة',
    'العلامة_النهائية_المعتمدة',
    'الحضور_%',
    'الحضور_من_20',
    'التقييم_البعدي_%',
    'التقييم_البعدي_من_20',
    'التاسكات_المسلمة',
    'علامة_التاسكات_من_40',
    'علامة_السلوك_من_20',
    'الساعات',
    'حالة_التدريب',
    'سبب_عدم_التأهيل',
    'مصدر_النتيجة',
  ];
  ws.addRow(headers);
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  const modeAr = report.opportunity?.trainingModeAr || '';
  for (const s of report.students) {
    ws.addRow([
      s.seq,
      s.studentName,
      s.universityNumber,
      s.email,
      s.specialty,
      s.academicSupervisor,
      modeAr,
      s.status,
      s.approvedFinalScore,
      s.attendancePercent,
      s.attendancePoints,
      s.postAssessmentPercent,
      s.postAssessmentPoints,
      s.submittedTasks,
      s.taskPoints,
      s.behaviorPoints,
      s.completedHours,
      s.trainingStatus,
      s.notEligibleReason || '',
      s.approvedResultSource,
    ]);
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  ws.columns = headers.map((h) => ({
    width: Math.min(28, Math.max(12, String(h).length + 4)),
  }));
  ws.getColumn(19).width = 42;
  ws.getColumn(19).alignment = { wrapText: true, vertical: 'middle' };

  const audit = wb.addWorksheet('بيانات_التدقيق', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
  });
  audit.addRow([
    'application_id',
    'opportunity_id',
    'approved_source',
    'approved_source_ar',
    'approved_at',
    'result_version',
  ]);
  audit.getRow(1).font = { bold: true };
  for (const s of report.students) {
    audit.addRow([
      s.applicationId,
      report.opportunityId,
      s.approvedSourceCode,
      s.approvedResultSource,
      s.approvedAt,
      report.resultVersion,
    ]);
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `Tafila_Field_Training_Students_2025_2026.xlsx`,
    report,
  };
}

async function getStudentApprovedSnapshot(applicationId) {
  return resolveFieldTrainingApprovedResult(applicationId);
}

module.exports = {
  TAFILA_ONLINE_EXPECTED,
  PRIMARY_TAFILA_OPPORTUNITY_ID,
  buildOpportunityFinalReport,
  buildOpportunityComprehensiveReport,
  validateOpportunityReport,
  validateOpportunityReportDataset,
  exportOpportunityFinalReportPdf,
  exportOpportunityComprehensiveReportPdf,
  exportOpportunityOfficialExcel,
  getStudentApprovedSnapshot,
  loadApprovedStudentRows,
  loadLmsTaskSubmissionCounts,
  humanSourceAr,
  sortReportRows,
  sanitizeFilenamePart,
  asciiDownloadSlug,
};
