'use strict';

const metrics = require('./fieldTrainingReport.metrics');
const labels = require('./fieldTrainingReport.labels');
const hoursMod = require('./fieldTraining.hours');

const IN_TRAINING_STATUSES = new Set([
  'in_training',
  'task_pending',
  'task_submitted',
  'post_assessment_pending',
  'ready_for_training',
  'pre_assessment_completed',
]);

const COMPLETED_STATUSES = new Set(['completed', 'eligible_for_completion']);

function emptyUniversitySummary(eligibleOpportunities = 0) {
  return {
    eligible_opportunities: eligibleOpportunities,
    total_applicants: 0,
    pending_review: 0,
    accepted_students: 0,
    rejected_students: 0,
    expelled_students: 0,
    in_training_students: 0,
    completed_students: 0,
    not_completed_students: 0,
    eligible_students: 0,
    completion_letters_issued: 0,
    completion_rate: null,
    average_attendance: null,
    median_attendance: null,
    average_pre_assessment_score: null,
    average_post_assessment_score: null,
    average_assessment_score: null,
    tasks_submitted: 0,
    task_submission_rate: null,
    average_task_completion: null,
    total_training_hours: null,
    average_student_hours: null,
    active_training_organizations: 0,
    at_risk_students: 0,
    students_below_progress: 0,
  };
}

function summarizeApplications(apps, extras = {}) {
  const approved = apps.filter((app) => app.status === 'approved');
  const completed = approved.filter((app) => app.training_status === 'completed');
  const notCompleted = approved.filter((app) =>
    ['failed', 'expelled'].includes(app.training_status)
  );
  const attendanceValues = approved.map((app) => app.attendance_percentage);
  const preValues = approved.map((app) => app.pre_assessment_score);
  const postValues = approved.map((app) => app.post_assessment_score);
  const hoursValues = extras.hoursValues || [];
  return {
    eligible_opportunities: extras.eligibleOpportunities ?? 0,
    total_applicants: apps.length,
    pending_review: apps.filter((app) => app.status === 'pending').length,
    accepted_students: approved.length,
    rejected_students: apps.filter((app) => app.status === 'rejected').length,
    expelled_students: approved.filter((app) => app.training_status === 'expelled').length,
    in_training_students: approved.filter((app) => IN_TRAINING_STATUSES.has(app.training_status)).length,
    completed_students: completed.length,
    not_completed_students: notCompleted.length,
    eligible_students: approved.filter((app) => app.completion_eligibility_status === 'eligible').length,
    completion_letters_issued: approved.filter((app) => app.completion_letter_issued_at).length,
    completion_rate: metrics.rate(completed.length, approved.length),
    average_attendance: metrics.average(attendanceValues),
    median_attendance: metrics.median(attendanceValues),
    average_pre_assessment_score: metrics.average(preValues),
    average_post_assessment_score: metrics.average(postValues),
    average_assessment_score: metrics.average([...preValues, ...postValues]),
    tasks_submitted: extras.submissions ?? 0,
    task_submission_rate:
      extras.tasks > 0 && approved.length > 0
        ? metrics.rate(extras.submissions, extras.tasks * approved.length)
        : extras.taskRate ?? null,
    average_task_completion: extras.averageTaskCompletion ?? null,
    total_training_hours: metrics.sum(hoursValues),
    average_student_hours: metrics.average(hoursValues),
    active_training_organizations: extras.activeOrganizations ?? 0,
    at_risk_students: extras.atRisk ?? 0,
    students_below_progress: extras.belowProgress ?? 0,
  };
}

function enrollmentFunnel(apps) {
  const approved = apps.filter((a) => a.status === 'approved');
  const stages = metrics.withConversions([
    { key: 'applied', label: 'قدّم طلباً', count: apps.length },
    { key: 'pending', label: 'قيد المراجعة', count: apps.filter((a) => a.status === 'pending').length },
    { key: 'approved', label: 'مقبول', count: approved.length },
    { key: 'rejected', label: 'مرفوض', count: apps.filter((a) => a.status === 'rejected').length },
    { key: 'cancelled', label: 'ملغى', count: apps.filter((a) => a.status === 'cancelled').length },
    {
      key: 'in_training',
      label: 'قيد التدريب',
      count: approved.filter((a) => IN_TRAINING_STATUSES.has(a.training_status)).length,
    },
    {
      key: 'completed',
      label: 'مكتمل',
      count: approved.filter((a) => a.training_status === 'completed').length,
    },
    {
      key: 'failed',
      label: 'غير مكتمل',
      count: approved.filter((a) => a.training_status === 'failed').length,
    },
    {
      key: 'expelled',
      label: 'مستبعد',
      count: approved.filter((a) => a.training_status === 'expelled').length,
    },
  ]);
  return stages;
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const item of list || []) {
    const key = keyFn(item) ?? 'unknown';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function analyzeOpportunities({ opportunities, apps, students }) {
  const appsByOpp = groupBy(apps, (a) => a.opportunity_id);
  const studentsByOpp = groupBy(students, (s) => s.opportunity_id);
  const rows = (opportunities || []).map((opp) => {
    const oppApps = appsByOpp.get(opp.id) || [];
    const oppStudents = studentsByOpp.get(opp.id) || [];
    const approved = oppApps.filter((a) => a.status === 'approved');
    const accepted = approved.length;
    const capacity = opp.seats_limit != null ? Number(opp.seats_limit) : null;
    return {
      id: opp.id,
      title: opp.title,
      organization_name: opp.organization_name || null,
      field: opp.specialties?.name_ar || opp.specialties?.name_en || null,
      capacity,
      applications: oppApps.length,
      accepted_students: accepted,
      active_students: approved.filter((a) => IN_TRAINING_STATUSES.has(a.training_status)).length,
      completed_students: approved.filter((a) => a.training_status === 'completed').length,
      available_seats: capacity != null ? Math.max(0, capacity - accepted) : null,
      utilization_rate: capacity != null ? metrics.rate(accepted, capacity) : null,
      status: opp.status,
      status_label: labels.labelOf(labels.OPPORTUNITY_STATUS_AR, opp.status),
      start_date: opp.start_date,
      end_date: opp.end_date,
      average_attendance: metrics.average(oppStudents.map((s) => s.attendance_percentage)),
    };
  });
  const published = (opportunities || []).filter((o) => o.status === 'published' || o.status === 'in_progress');
  const closed = (opportunities || []).filter((o) => o.status === 'archived');
  const totalCapacity = metrics.sum(rows.map((r) => r.capacity));
  const totalAccepted = metrics.sum(rows.map((r) => r.accepted_students)) || 0;
  return {
    total: (opportunities || []).length,
    published: published.length,
    open: (opportunities || []).filter((o) => o.status === 'published').length,
    in_progress: (opportunities || []).filter((o) => o.status === 'in_progress').length,
    closed: closed.length,
    filled: rows.filter((r) => r.capacity != null && r.accepted_students >= r.capacity).length,
    total_capacity: totalCapacity,
    available_seats:
      totalCapacity != null ? Math.max(0, totalCapacity - totalAccepted) : null,
    applications_received: apps.length,
    approved_students: apps.filter((a) => a.status === 'approved').length,
    utilization_rate: totalCapacity != null ? metrics.rate(totalAccepted, totalCapacity) : null,
    rows,
  };
}

function analyzeOrganizations({ opportunities, students }) {
  const byName = groupBy(
    opportunities || [],
    (o) => String(o.organization_name || '').trim() || 'غير محدد'
  );
  const studentsByOrg = groupBy(students, (s) => String(s.training_organization || '').trim() || 'غير محدد');
  const rows = [...byName.entries()].map(([name, opps]) => {
    const hosted = studentsByOrg.get(name) || [];
    const approved = hosted.filter((s) => s.application_status === 'approved');
    const completed = approved.filter((s) => s.training_status === 'completed');
    return {
      name,
      opportunities: opps.length,
      hosted_students: hosted.length,
      active_students: approved.filter((s) => IN_TRAINING_STATUSES.has(s.training_status)).length,
      completed_students: completed.length,
      completion_rate: metrics.rate(completed.length, approved.length),
      average_attendance: metrics.average(approved.map((s) => s.attendance_percentage)),
      domains: [...new Set(opps.map((o) => o.specialties?.name_ar || o.specialties?.name_en).filter(Boolean))],
    };
  });
  return {
    total: rows.filter((r) => r.name !== 'غير محدد').length,
    rows,
  };
}

function analyzeAttendance({ students, attendanceRows, sessions, opportunities }) {
  const counts = metrics.countAttendanceStatuses(attendanceRows);
  const attendanceValues = students
    .filter((s) => s.application_status === 'approved')
    .map((s) => s.attendance_percentage);
  const withThreshold = students.filter(
    (s) => s.application_status === 'approved' && s.attendance_threshold != null && s.attendance_percentage != null
  );
  const below = withThreshold.filter((s) => Number(s.attendance_percentage) < Number(s.attendance_threshold));
  const meeting = withThreshold.filter((s) => Number(s.attendance_percentage) >= Number(s.attendance_threshold));
  const incompleteRecords = (attendanceRows || []).filter((r) => !r.status || r.status === 'unconfirmed').length;

  const bySpecialty = [...groupBy(students, (s) => s.university_specialty_label || 'غير محدد').entries()].map(
    ([label, list]) => {
      const approved = list.filter((s) => s.application_status === 'approved');
      const withT = approved.filter((s) => s.attendance_threshold != null && s.attendance_percentage != null);
      return {
        label,
        students: approved.length,
        average: metrics.average(approved.map((s) => s.attendance_percentage)),
        below_threshold: withT.filter((s) => Number(s.attendance_percentage) < Number(s.attendance_threshold)).length,
      };
    }
  );

  const byOpportunity = [...groupBy(students, (s) => s.opportunity_title || 'غير محدد').entries()].map(
    ([label, list]) => ({
      label,
      students: list.length,
      average: metrics.average(list.map((s) => s.attendance_percentage)),
    })
  );

  const byOrganization = [...groupBy(students, (s) => s.training_organization || 'غير محدد').entries()].map(
    ([label, list]) => ({
      label,
      students: list.length,
      average: metrics.average(list.map((s) => s.attendance_percentage)),
    })
  );

  const byInstructor = [...groupBy(students, (s) => s.instructor_name || 'غير معيّن').entries()].map(
    ([label, list]) => ({
      label,
      students: list.length,
      average: metrics.average(list.map((s) => s.attendance_percentage)),
    })
  );

  const byMonthMap = new Map();
  for (const row of attendanceRows || []) {
    const date = row.field_training_sessions?.session_date || row.session_date;
    if (!date) continue;
    const key = String(date).slice(0, 7);
    if (!byMonthMap.has(key)) byMonthMap.set(key, []);
    byMonthMap.get(key).push(row);
  }
  const byMonth = [...byMonthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, rows]) => {
      const c = metrics.countAttendanceStatuses(rows);
      const attended = c.present + c.late + c.excused;
      const total = rows.length;
      return { month, count: total, attendance_rate: metrics.rate(attended, total) };
    });

  return {
    average: metrics.average(attendanceValues),
    median: metrics.median(attendanceValues),
    meeting_threshold: meeting.length,
    below_threshold: below.length,
    threshold_sample: withThreshold.length,
    counts,
    incomplete_records: incompleteRecords,
    sessions_count: (sessions || []).length,
    by_specialty: bySpecialty,
    by_opportunity: byOpportunity,
    by_organization: byOrganization,
    by_instructor: byInstructor,
    by_month: byMonth,
    opportunities_count: (opportunities || []).length,
  };
}

function analyzeHours({ students }) {
  const approved = students.filter((s) => s.application_status === 'approved');
  const completedHours = approved.map((s) => s.completed_training_hours);
  const requiredHours = approved.map((s) => s.required_training_hours);
  const scheduledHours = approved.map((s) => s.scheduled_training_hours);
  const meeting = approved.filter(
    (s) => s.hours_completion_status === hoursMod.HOURS_STATUS.COMPLETED
  );
  const below = approved.filter(
    (s) =>
      s.required_training_hours != null &&
      s.hours_completion_status &&
      s.hours_completion_status !== hoursMod.HOURS_STATUS.COMPLETED
  );
  return {
    total_attended_hours: metrics.sum(completedHours),
    total_required_hours: metrics.sum(requiredHours),
    total_scheduled_hours: metrics.sum(scheduledHours),
    average_hours: metrics.average(completedHours),
    median_hours: metrics.median(completedHours),
    min_hours: metrics.minOf(completedHours),
    max_hours: metrics.maxOf(completedHours),
    meeting_required: meeting.length,
    below_required: below.length,
  };
}

function analyzeTasks({ tasks, submissions, students }) {
  const requiredTasks = (tasks || []).filter((t) => t.is_final_task);
  const onTime = (submissions || []).filter((s) => s.submitted_at && !s.is_late);
  const late = (submissions || []).filter((s) => s.is_late);
  const pending = (submissions || []).filter((s) =>
    ['pending', 'submitted', 'under_review'].includes(s.review_status)
  );
  const passed = (submissions || []).filter((s) => ['approved', 'graded'].includes(s.review_status));
  const revision = (submissions || []).filter((s) => s.review_status === 'needs_revision');
  const approvedStudents = students.filter((s) => s.application_status === 'approved');
  const expected = (tasks || []).length * approvedStudents.length;
  const missing = expected > 0 ? Math.max(0, expected - (submissions || []).length) : null;
  return {
    total_tasks: (tasks || []).length,
    required_tasks: requiredTasks.length || (tasks || []).length,
    published_tasks: (tasks || []).length,
    total_submissions: (submissions || []).length,
    on_time: onTime.length,
    late: late.length,
    pending_grading: pending.length,
    passed: passed.length,
    revision_required: revision.length,
    missing_submissions: missing,
    submission_rate: expected > 0 ? metrics.rate((submissions || []).length, expected) : null,
  };
}

function analyzeAssessments({ students, attempts }) {
  const approved = students.filter((s) => s.application_status === 'approved');
  const preScores = approved.map((s) => s.pre_assessment_score);
  const postScores = approved.map((s) => s.post_assessment_score);
  const attemptedPre = preScores.filter((s) => s != null).length;
  const attemptedPost = postScores.filter((s) => s != null).length;
  const pairs = approved.map((s) => ({ pre: s.pre_assessment_score, post: s.post_assessment_score }));
  const comparison = metrics.summarizePrePostPairs(pairs);
  const pending = (attempts || []).filter((a) => a.score == null).length;
  return {
    assessment_count: [...new Set((attempts || []).map((a) => a.assessment_id).filter(Boolean))].length,
    students_eligible: approved.length,
    students_attempted_pre: attemptedPre,
    students_attempted_post: attemptedPost,
    attempt_rate_pre: metrics.rate(attemptedPre, approved.length),
    attempt_rate_post: metrics.rate(attemptedPost, approved.length),
    average_pre: metrics.average(preScores),
    average_post: metrics.average(postScores),
    median_post: metrics.median(postScores),
    min_post: metrics.minOf(postScores),
    max_post: metrics.maxOf(postScores),
    pending_grading: pending,
    comparison,
  };
}

function analyzeProgress({ students }) {
  const approved = students.filter((s) => s.application_status === 'approved');
  const values = approved.map((s) => s.progress_percentage);
  const dist = metrics.progressDistribution(values);
  const completed = approved.filter((s) => s.training_status === 'completed').length;
  const near = approved.filter((s) => {
    const n = metrics.toNumber(s.progress_percentage);
    return n != null && n >= 75 && n < 100;
  }).length;
  const atRisk = approved.filter((s) => s.risk_severity).length;
  const missingReq = approved.filter((s) => s.eligibility_status === 'ineligible' || s.eligibility_status === 'not_eligible').length;
  return {
    average: metrics.average(values),
    median: metrics.median(values),
    distribution: dist,
    completed,
    near_completion: near,
    at_risk: atRisk,
    missing_requirements: missingReq,
  };
}

function analyzeCompletion({ students }) {
  const approved = students.filter((s) => s.application_status === 'approved');
  const completed = approved.filter((s) => s.training_status === 'completed');
  const inProgress = approved.filter((s) => IN_TRAINING_STATUSES.has(s.training_status) || s.training_status === 'eligible_for_completion');
  const withdrawn = students.filter((s) => s.application_status === 'cancelled');
  const notCompleted = approved.filter((s) => ['failed', 'expelled'].includes(s.training_status));
  const reasonCounts = new Map();
  for (const s of approved) {
    const reasons = s.eligibility_reasons || [];
    for (const reason of reasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }
  }
  const reasons = [...reasonCounts.entries()].map(([key, count]) => ({
    key,
    label: labels.labelOf(labels.REASON_AR, key, key),
    count,
  }));
  return {
    eligible: approved.filter((s) => s.eligibility_status === 'eligible').length,
    completed: completed.length,
    not_completed: notCompleted.length,
    in_progress: inProgress.length,
    withdrawn: withdrawn.length,
    completion_rate: metrics.rate(completed.length, approved.length),
    reasons,
  };
}

function analyzeCertificates({ students, letters }) {
  const approved = students.filter((s) => s.application_status === 'approved');
  const issued = approved.filter((s) => s.completion_letter_status === 'issued');
  const eligible = approved.filter((s) => s.eligibility_status === 'eligible' || s.training_status === 'completed');
  const pending = eligible.filter((s) => s.completion_letter_status !== 'issued');
  const notEligible = approved.filter(
    (s) => s.eligibility_status === 'ineligible' || s.eligibility_status === 'not_eligible'
  );
  return {
    eligible: eligible.length,
    issued: issued.length,
    pending: pending.length,
    not_eligible: notEligible.length,
    issue_rate: metrics.rate(issued.length, eligible.length),
    rows: (letters || []).map((letter) => ({
      letter_no: letter.letter_no,
      issued_at: letter.issued_at,
      status: letter.status,
      application_id: letter.application_id,
    })),
  };
}

function analyzeInstructors({ students, opportunities, submissions }) {
  const byId = groupBy(opportunities || [], (o) => o.assigned_instructor_id || 'none');
  const studentsByInstructor = groupBy(students, (s) => s.instructor_id || 'none');
  const pendingStatuses = new Set(['pending', 'submitted', 'under_review']);
  const rows = [...studentsByInstructor.entries()]
    .filter(([id]) => id !== 'none')
    .map(([id, list]) => {
      const approved = list.filter((s) => s.application_status === 'approved');
      const completed = approved.filter((s) => s.training_status === 'completed');
      const opps = byId.get(id) || [];
      const graded = (submissions || []).filter(
        (sub) => list.some((s) => s.application_id === sub.application_id) && sub.reviewed_at
      );
      const pending = (submissions || []).filter(
        (sub) => list.some((s) => s.application_id === sub.application_id) && pendingStatuses.has(sub.review_status)
      );
      const turnaroundHours = graded
        .map((sub) => {
          if (!sub.submitted_at || !sub.reviewed_at) return null;
          const ms = new Date(sub.reviewed_at) - new Date(sub.submitted_at);
          return Number.isFinite(ms) ? ms / 3600000 : null;
        })
        .filter((n) => n != null);
      return {
        instructor_id: id,
        name: list[0]?.instructor_name || '—',
        students_supervised: list.length,
        opportunities: opps.length,
        completion_rate: metrics.rate(completed.length, approved.length),
        average_progress: metrics.average(approved.map((s) => s.progress_percentage)),
        average_attendance: metrics.average(approved.map((s) => s.attendance_percentage)),
        tasks_graded: graded.length,
        pending_grading: pending.length,
        average_turnaround_hours: metrics.average(turnaroundHours),
      };
    });
  return { rows };
}

function analyzeSpecialties({ bySpecialty, students }) {
  const byLabel = groupBy(students, (s) => s.university_specialty_label || 'غير محدد');
  return (bySpecialty || []).map((row) => {
    const list = byLabel.get(row.label) || [];
    const approved = list.filter((s) => s.application_status === 'approved');
    const completed = approved.filter((s) => s.training_status === 'completed');
    return {
      ...row,
      students: list.length,
      active: approved.filter((s) => IN_TRAINING_STATUSES.has(s.training_status)).length,
      completed: completed.length,
      completion_pct: metrics.rate(completed.length, approved.length),
      average_hours: metrics.average(approved.map((s) => s.completed_training_hours)),
      average_assessment: metrics.average(approved.map((s) => s.post_assessment_score)),
      certificates: approved.filter((s) => s.completion_letter_status === 'issued').length,
    };
  });
}

function collectRiskCases({ students }) {
  const rows = [];
  for (const s of students) {
    if (s.application_status !== 'approved') continue;
    const issues = [];
    if (s.attendance_threshold != null && s.attendance_percentage != null && s.attendance_percentage < s.attendance_threshold) {
      issues.push({ issue: 'الحضور دون الحد الأدنى', severity: 'عالية', action: 'متابعة الغياب' });
    }
    if (
      s.required_training_hours != null &&
      s.hours_completion_status &&
      s.hours_completion_status !== hoursMod.HOURS_STATUS.COMPLETED
    ) {
      issues.push({ issue: 'الساعات المطلوبة غير مكتملة', severity: 'عالية', action: 'استكمال الساعات' });
    }
    if (s.eligibility_reasons?.includes('final_task_not_submitted')) {
      issues.push({ issue: 'مهمة مطلوبة غير مسلمة', severity: 'متوسطة', action: 'متابعة التسليم' });
    }
    if (s.eligibility_reasons?.includes('final_task_pending_review') || s.pending_grading) {
      issues.push({ issue: 'تقييم معلق', severity: 'متوسطة', action: 'إنهاء التقييم' });
    }
    if (s.eligibility_status === 'ineligible' || s.eligibility_status === 'not_eligible') {
      issues.push({ issue: 'الإكمال محجوب لنواقص المتطلبات', severity: 'عالية', action: 'معالجة المتطلبات الناقصة' });
    }
    if (s.eligibility_status === 'needs_review') {
      issues.push({ issue: 'بانتظار مراجعة إدارية', severity: 'متوسطة', action: 'مراجعة الملف' });
    }
    for (const item of issues) {
      rows.push({
        application_id: s.application_id,
        student_name: s.student_name,
        specialty: s.university_specialty_label,
        opportunity: s.opportunity_title,
        ...item,
      });
    }
  }
  return rows;
}

function dataQualityWarnings({ attendanceIncomplete, studentsMissingAttendance, studentsMissingHours }) {
  const warnings = [];
  if (attendanceIncomplete > 0) {
    warnings.push(`تنبيه جودة البيانات: يوجد ${attendanceIncomplete} سجلات حضور غير مكتملة.`);
  }
  if (studentsMissingAttendance > 0) {
    warnings.push(`تنبيه جودة البيانات: ${studentsMissingAttendance} طلاب بلا نسبة حضور مسجّلة.`);
  }
  if (studentsMissingHours > 0) {
    warnings.push(`تنبيه جودة البيانات: ${studentsMissingHours} طلاب بلا ساعات تدريبية محسوبة.`);
  }
  return warnings;
}

function buildChartsPayload({ funnel, attendance, hours, specialties, organizations, progress, completion, assessments }) {
  return {
    completion_donut: [
      { name: 'مكتمل', value: completion.completed },
      { name: 'قيد الإنجاز', value: completion.in_progress },
      { name: 'غير مكتمل', value: completion.not_completed },
    ].filter((d) => d.value > 0),
    enrollment_funnel: (funnel || []).map((s) => ({ name: s.label, value: s.count })),
    attendance_distribution: (progress?.distribution?.buckets || []).map((b) => ({
      name: b.label,
      value: b.count,
    })),
    hours_summary: [
      { name: 'منجزة', value: hours.total_attended_hours },
      { name: 'مطلوبة', value: hours.total_required_hours },
    ].filter((d) => d.value != null),
    students_by_specialty: (specialties || []).map((s) => ({ name: s.label, value: s.students })),
    students_by_organization: (organizations?.rows || []).map((s) => ({ name: s.name, value: s.hosted_students })),
    progress_distribution: (progress?.distribution?.buckets || []).map((b) => ({
      name: b.label,
      value: b.count,
    })),
    completion_by_specialty: (specialties || []).map((s) => ({
      name: s.label,
      completed: s.completed,
      total: s.students,
    })),
    pre_post: assessments?.comparison?.sample_size
      ? [
          { name: 'قبلي', value: assessments.comparison.average_pre },
          { name: 'بعدي', value: assessments.comparison.average_post },
        ]
      : [],
    non_completion_reasons: (completion.reasons || []).map((r) => ({ name: r.label, value: r.count })),
  };
}

function buildUniversityAnalytics(input) {
  const {
    apps,
    students,
    opportunities,
    attendanceRows,
    sessions,
    tasks,
    submissions,
    attempts,
    letters,
    bySpecialty,
    eligibleOpportunities,
  } = input;

  const hours = analyzeHours({ students });
  const attendance = analyzeAttendance({ students, attendanceRows, sessions, opportunities });
  const tasksA = analyzeTasks({ tasks, submissions, students });
  const assessments = analyzeAssessments({ students, attempts });
  const progress = analyzeProgress({ students });
  const completion = analyzeCompletion({ students });
  const certificates = analyzeCertificates({ students, letters });
  const instructors = analyzeInstructors({ students, opportunities, submissions });
  const specialties = analyzeSpecialties({ bySpecialty, students });
  const opportunityAnalysis = analyzeOpportunities({ opportunities, apps, students });
  const organizations = analyzeOrganizations({ opportunities, students });
  const funnel = enrollmentFunnel(apps);
  const risk = collectRiskCases({ students });
  const warnings = dataQualityWarnings({
    attendanceIncomplete: attendance.incomplete_records,
    studentsMissingAttendance: students.filter(
      (s) => s.application_status === 'approved' && s.attendance_percentage == null
    ).length,
    studentsMissingHours: students.filter(
      (s) => s.application_status === 'approved' && s.completed_training_hours == null
    ).length,
  });

  const summary = summarizeApplications(apps, {
    eligibleOpportunities,
    submissions: tasksA.total_submissions,
    tasks: tasksA.total_tasks,
    taskRate: tasksA.submission_rate,
    averageTaskCompletion: tasksA.submission_rate,
    hoursValues: students.map((s) => s.completed_training_hours),
    activeOrganizations: organizations.total,
    atRisk: risk.length,
    belowProgress: progress.missing_requirements,
  });

  const recommendations = metrics.buildUniversityRecommendations({
    specialtyAttendance: attendance.by_specialty,
    hoursBelow: hours.below_required,
    attendanceBelow: attendance.below_threshold,
    pendingGrading: tasksA.pending_grading,
    atRisk: risk.length,
    completionRate: summary.completion_rate,
    incompleteAttendanceRecords: attendance.incomplete_records,
  });

  return {
    summary,
    funnel,
    opportunities: opportunityAnalysis,
    organizations,
    attendance,
    hours,
    tasks: tasksA,
    assessments,
    progress,
    completion,
    certificates,
    instructors,
    by_specialty: specialties,
    risk,
    recommendations,
    data_quality_warnings: warnings,
    charts: buildChartsPayload({
      funnel,
      attendance,
      hours,
      specialties,
      organizations,
      progress,
      completion,
      assessments,
    }),
  };
}

module.exports = {
  IN_TRAINING_STATUSES,
  COMPLETED_STATUSES,
  emptyUniversitySummary,
  summarizeApplications,
  enrollmentFunnel,
  buildUniversityAnalytics,
  analyzeHours,
  analyzeTasks,
  analyzeAssessments,
  analyzeProgress,
  analyzeCompletion,
  analyzeCertificates,
};
