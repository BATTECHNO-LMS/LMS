'use strict';

const crypto = require('crypto');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const evaluationService = require('./trainingEvaluation.service');
const {
  REPORT_TYPES,
  REPORT_TYPE_TITLES_AR,
  NA,
  round2,
  average,
  pct,
  computeAttendanceBreakdown,
  computeImprovement,
  computeNps,
  summarizeNumeric,
  buildEnrollmentFunnel,
  buildIndividualRecommendation,
  privacySafeGroup,
} = require('./trainingReportMetrics.service');

async function loadProgramContext(programId, { cohortId } = {}) {
  const program = await prisma.training_programs.findUnique({
    where: { id: programId },
    include: {
      organizations: { select: { id: true, name: true, name_en: true, short_name: true, logo_url: true, code: true } },
    },
  });
  if (!program || program.type !== 'TRAINING_COURSE') {
    throw new ApiError(404, 'الدورة التدريبية غير موجودة', null, 'TRAINING_PROGRAM_NOT_FOUND');
  }

  const cohorts = await prisma.training_cohorts.findMany({
    where: { program_id: programId, ...(cohortId ? { id: cohortId } : {}) },
    include: {
      organization_branches: { select: { id: true, name: true } },
      training_cohort_instructors: true,
    },
  });

  const assignments = await prisma.training_trainer_assignments.findMany({
    where: {
      training_program_id: programId,
      is_active: true,
      ...(cohortId ? { OR: [{ training_cohort_id: null }, { training_cohort_id: cohortId }] } : {}),
    },
  });
  const trainerIds = [...new Set(assignments.map((a) => a.trainer_user_id).filter(Boolean))];
  const trainers = trainerIds.length
    ? await prisma.users.findMany({
        where: { id: { in: trainerIds } },
        select: { id: true, full_name: true, email: true },
      })
    : [];

  const branches = [
    ...new Map(
      cohorts
        .filter((c) => c.organization_branches)
        .map((c) => [c.organization_branches.id, c.organization_branches])
    ).values(),
  ];

  return {
    program,
    organization: program.organizations,
    cohorts,
    trainers,
    branches,
    branding: {
      platformName: 'BATTECHNO LMS',
      platformNameAr: 'شركة الرجل الوطواط للتكنولوجيا',
      institutionName: program.organizations?.name || null,
      institutionCode: program.organizations?.code || null,
      institutionLogoUrl:
        program.organizations?.code === 'BATTECHNO' ? null : program.organizations?.logo_url || null,
      singleBrand: program.organizations?.code === 'BATTECHNO',
      reportTitle: null,
    },
  };
}

function formatDateAr(value) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
  } catch {
    return String(value).slice(0, 10);
  }
}

function metaCover(ctx, reportType, extras = {}) {
  const { program, organization, cohorts, trainers, branches } = ctx;
  const singleBrand = organization?.code === 'BATTECHNO';
  return {
    reportType,
    reportTitle: REPORT_TYPE_TITLES_AR[reportType] || reportType,
    courseName: program.title,
    courseCode: program.code || null,
    institutionName: organization?.name || null,
    institutionCode: organization?.code || null,
    institutionLogoUrl: singleBrand ? null : organization?.logo_url || null,
    singleBrand,
    platformName: 'BATTECHNO LMS',
    platformNameAr: 'شركة الرجل الوطواط للتكنولوجيا',
    branches: branches.map((b) => b.name),
    cohorts: cohorts.map((c) => ({ id: c.id, name: c.name, code: c.code })),
    trainers: trainers.map((t) => ({ id: t.id, fullName: t.full_name })),
    trainingDates: {
      start: program.start_date,
      end: program.end_date,
      startLabel: formatDateAr(program.start_date),
      endLabel: formatDateAr(program.end_date),
    },
    totalHours: program.required_hours != null ? Number(program.required_hours) : null,
    deliveryMode: program.delivery_mode || null,
    language: program.language || null,
    level: program.level || null,
    field: program.field || null,
    objectives: program.objectives || null,
    generatedAt: new Date().toISOString(),
    generatedAtLabel: formatDateAr(new Date()),
    confidentiality: 'سري — للاستخدام المؤسسي المعتمد',
    ...extras,
  };
}

async function loadEnrollmentBundle(enrollmentId) {
  const enrollment = await prisma.training_enrollments.findUnique({
    where: { id: enrollmentId },
    include: {
      training_cohorts: {
        include: {
          training_programs: { include: { organizations: true } },
          organization_branches: { select: { id: true, name: true } },
        },
      },
      training_progress: true,
    },
  });
  if (!enrollment) throw new ApiError(404, 'التسجيل غير موجود', null, 'ENROLLMENT_NOT_FOUND');
  return enrollment;
}

/**
 * Full individual trainee report snapshot (sections 1–11).
 */
async function buildIndividualTrainingReportData(enrollmentId) {
  const enrollment = await loadEnrollmentBundle(enrollmentId);
  const program = enrollment.training_cohorts.training_programs;
  const cohort = enrollment.training_cohorts;
  const org = program.organizations;

  const [user, sessions, attendanceRecords, tasks, submissions, assessments, evaluationAssignment, certificate, requirements] =
    await Promise.all([
      prisma.users.findUnique({
        where: { id: enrollment.user_id },
        select: { id: true, full_name: true, email: true, phone: true, status: true },
      }),
      prisma.training_sessions.findMany({ where: { cohort_id: enrollment.cohort_id }, orderBy: { starts_at: 'asc' } }),
      prisma.training_attendance_records.findMany({ where: { enrollment_id: enrollmentId } }),
      prisma.training_tasks.findMany({ where: { program_id: program.id }, orderBy: { created_at: 'asc' } }),
      prisma.training_task_submissions.findMany({ where: { enrollment_id: enrollmentId } }),
      prisma.training_assessments.findMany({
        where: { program_id: program.id, kind: { in: ['PRE_TEST', 'POST_TEST'] } },
        include: {
          training_assessment_attempts: { where: { enrollment_id: enrollmentId }, orderBy: { attempt_no: 'asc' } },
          _count: { select: { training_assessment_questions: true } },
        },
      }),
      prisma.training_evaluation_assignments.findUnique({ where: { enrollment_id: enrollmentId } }),
      prisma.training_certificates.findFirst({
        where: { enrollment_id: enrollmentId },
        orderBy: { issued_at: 'desc' },
      }),
      prisma.training_requirements.findMany({ where: { program_id: program.id } }),
    ]);

  const attendance = computeAttendanceBreakdown(sessions, attendanceRecords);
  const sessionRows = sessions.map((s) => {
    const rec = attendanceRecords.find((a) => a.session_id === s.id);
    return {
      sessionId: s.id,
      title: s.title || 'جلسة',
      date: s.starts_at,
      dateLabel: formatDateAr(s.starts_at),
      startTime: s.starts_at,
      endTime: s.ends_at,
      durationHours: s.hours != null ? Number(s.hours) : null,
      status: rec?.status || 'unconfirmed',
      confirmationMethod: rec?.marked_via || null,
      notes: rec?.reason || null,
    };
  });

  function mapAssessmentDetail(assessment) {
    if (!assessment) return { required: false, status: 'not_required', label: NA.NOT_REQUIRED };
    const attempts = assessment.training_assessment_attempts || [];
    const graded = attempts.filter((a) => a.status === 'GRADED');
    const best = graded.length ? graded.reduce((a, b) => (Number(a.score) >= Number(b.score) ? a : b)) : null;
    const pendingManual = attempts.some((a) => a.status === 'SUBMITTED' || a.status === 'PENDING_REVIEW');
    const score = best ? Number(best.score) : null;
    const maxScore = 100;
    const passScore = assessment.pass_score != null ? Number(assessment.pass_score) : null;
    const passed = score != null && passScore != null ? score >= passScore : null;
    return {
      required: true,
      assessmentId: assessment.id,
      title: assessment.title,
      kind: assessment.kind,
      questionCount: assessment._count?.training_assessment_questions ?? null,
      attemptCount: attempts.length,
      attemptNumber: best?.attempt_no ?? (attempts.length || null),
      submissionDate: best?.submitted_at || best?.graded_at || null,
      score,
      maxScore,
      percentage: score,
      durationUsedSeconds: null,
      passScore,
      passFailStatus:
        passed == null
          ? pendingManual
            ? 'pending_review'
            : score == null
              ? 'not_attempted'
              : 'scored'
          : passed
            ? 'passed'
            : 'failed',
      manualGradingPending: pendingManual,
      statusLabel:
        score == null
          ? pendingManual
            ? NA.PENDING_REVIEW
            : attempts.length
              ? NA.NOT_RECORDED
              : NA.UNAVAILABLE
          : `${score}%`,
    };
  }

  const preTest = mapAssessmentDetail(assessments.find((a) => a.kind === 'PRE_TEST'));
  const postTest = mapAssessmentDetail(assessments.find((a) => a.kind === 'POST_TEST'));
  const improvement = computeImprovement(preTest.score, postTest.score);

  const requiredTasks = tasks.filter((t) => t.is_required);
  const accepted = submissions.filter((s) => ['ACCEPTED', 'GRADED'].includes(s.status));
  const needsRevision = submissions.filter((s) => s.status === 'NEEDS_REVISION' || s.status === 'RETURNED');
  const late = submissions.filter((s) => {
    const task = tasks.find((t) => t.id === s.task_id);
    return task?.due_at && s.submitted_at && new Date(s.submitted_at) > new Date(task.due_at);
  });
  const finalTask = tasks.find((t) => t.is_final_task);
  const finalSubmission = finalTask ? submissions.find((s) => s.task_id === finalTask.id) : null;
  const grades = accepted.map((s) => (s.score != null ? Number(s.score) : null)).filter((v) => v != null);

  const taskRows = tasks.map((t) => {
    const sub = submissions.find((s) => s.task_id === t.id);
    return {
      taskId: t.id,
      title: t.title,
      deadline: t.due_at,
      submissionDate: sub?.submitted_at || null,
      status: sub?.status || 'NOT_SUBMITTED',
      grade: sub?.score != null ? Number(sub.score) : null,
      attempts: sub?.attempt_no ?? (sub ? 1 : 0),
      trainerFeedback: sub?.feedback || null,
      isRequired: t.is_required,
      isFinal: t.is_final_task,
    };
  });

  const progressJson = enrollment.training_progress?.requirements_json;
  const progressReqs = progressJson && typeof progressJson === 'object' ? progressJson : {};

  const requirementRows = (requirements.length
    ? requirements
    : Object.keys(progressReqs).map((k) => ({ code: k, label: k }))
  ).map((req) => {
    const code = req.code || req.requirement_key || req.label;
    const snap = progressReqs[code] || progressReqs[req.id] || {};
    let state = 'incomplete';
    if (snap.notRequired || snap.status === 'NOT_REQUIRED') state = 'not_required';
    else if (snap.completed || snap.status === 'COMPLETED' || snap.met === true) state = 'completed';
    else if (snap.status === 'PENDING_REVIEW') state = 'pending_review';
    return {
      code,
      title: req.label || req.title || code,
      state,
      label:
        state === 'completed'
          ? 'مكتمل'
          : state === 'not_required'
            ? NA.NOT_REQUIRED
            : state === 'pending_review'
              ? NA.PENDING_REVIEW
              : 'غير مكتمل',
    };
  });

  // Fallback requirement rows from known progress fields when no configured requirements
  if (!requirementRows.length) {
    const fallback = [
      { code: 'attendance', title: 'متطلب الحضور', met: attendance.attendancePct != null && (program.required_attendance_pct == null || attendance.attendancePct >= Number(program.required_attendance_pct)) },
      { code: 'hours', title: 'الساعات المطلوبة', met: program.required_hours == null || attendance.hoursCompleted >= Number(program.required_hours) },
      { code: 'pre_test', title: 'الاختبار القبلي', met: preTest.score != null || !preTest.required },
      { code: 'post_test', title: 'الاختبار البعدي', met: postTest.passFailStatus === 'passed' || postTest.score != null },
      { code: 'tasks', title: 'المهمات المطلوبة', met: !requiredTasks.length || accepted.length >= requiredTasks.length },
      { code: 'evaluation', title: 'التقييم النهائي', met: evaluationAssignment?.status === 'SUBMITTED' },
    ];
    for (const f of fallback) {
      requirementRows.push({
        code: f.code,
        title: f.title,
        state: f.met ? 'completed' : 'incomplete',
        label: f.met ? 'مكتمل' : 'غير مكتمل',
      });
    }
  }

  const missingRequirements = requirementRows.filter((r) => r.state === 'incomplete').map((r) => r.title);
  const completedAll = missingRequirements.length === 0 && enrollment.status === 'COMPLETED';
  const evaluationSubmitted = evaluationAssignment?.status === 'SUBMITTED';

  const certificateInfo = {
    eligible: enrollment.status === 'COMPLETED' || Boolean(certificate && certificate.status === 'ISSUED'),
    status: certificate?.status || (enrollment.status === 'COMPLETED' ? 'PENDING' : 'INELIGIBLE'),
    certificateNumber: certificate?.certificate_number || null,
    issueDate: certificate?.issued_at || null,
    verificationCode: certificate?.verification_code || null,
    verificationUrl: certificate?.verification_code
      ? `/api/v1/training/certificates/verify/${certificate.verification_code}`
      : null,
    ineligibilityReason:
      certificate?.status === 'ISSUED'
        ? null
        : enrollment.status !== 'COMPLETED'
          ? 'لم يُعتمد إكمال المتدرب بعد'
          : 'الشهادة بانتظار الإصدار',
  };

  const recommendation = buildIndividualRecommendation({
    improvement,
    attendancePct: attendance.attendancePct,
    completedAllRequirements: completedAll || enrollment.status === 'COMPLETED',
    certificateIssued: certificate?.status === 'ISSUED',
    missingRequirements,
  });

  const ctx = {
    program,
    organization: org,
    cohorts: [cohort],
    trainers: [],
    branches: cohort.organization_branches ? [cohort.organization_branches] : [],
  };

  return {
    meta: metaCover(ctx, REPORT_TYPES.INDIVIDUAL, {
      cohortName: cohort.name,
      enrollmentId,
    }),
    identity: {
      fullName: user?.full_name || null,
      email: user?.email || null,
      institution: org?.name || null,
      branch: cohort.organization_branches?.name || null,
      cohort: cohort.name,
      course: program.title,
      trainers: [],
      enrollmentNumber: enrollment.id,
      accountStatus: user?.status || null,
      enrollmentStatus: enrollment.status,
      courseStart: program.start_date,
      courseEnd: program.end_date,
      reportGeneratedAt: new Date().toISOString(),
    },
    executiveSummary: {
      finalStatus: enrollment.status,
      attendancePct: attendance.attendancePct,
      hoursCompleted: attendance.hoursCompleted,
      hoursRequired: program.required_hours != null ? Number(program.required_hours) : null,
      preTestScore: preTest.score,
      postTestScore: postTest.score,
      improvementPp: improvement.percentagePointDifference,
      evaluationSubmitted,
      certificateStatus: certificateInfo.status,
    },
    attendance: {
      ...attendance,
      requiredAttendancePct: program.required_attendance_pct != null ? Number(program.required_attendance_pct) : null,
      hoursRequired: program.required_hours != null ? Number(program.required_hours) : null,
      sessions: sessionRows,
    },
    preTest,
    postTest,
    learningImprovement: improvement,
    tasks: {
      requiredCount: requiredTasks.length,
      submittedCount: submissions.length,
      acceptedCount: accepted.length,
      needsRevisionCount: needsRevision.length,
      lateCount: late.length,
      averageGrade: average(grades),
      finalTask: finalTask
        ? {
            title: finalTask.title,
            status: finalSubmission?.status || 'NOT_SUBMITTED',
            score: finalSubmission?.score != null ? Number(finalSubmission.score) : null,
          }
        : null,
      rows: taskRows,
    },
    requirements: requirementRows,
    completion: {
      status: enrollment.status,
      completedAt: enrollment.completed_at,
      finalizedBy: enrollment.training_progress?.approved_by || null,
      finalizationMode: null,
      missingRequirements,
      exceptionalReason: enrollment.status_reason || null,
      notes: enrollment.status_reason || null,
      isExceptional: Boolean(enrollment.status_reason && enrollment.status === 'COMPLETED'),
    },
    certificate: certificateInfo,
    recommendation,
    evaluation: { submitted: evaluationSubmitted, status: evaluationAssignment?.status || null },
    summary: recommendation,
    generatedAt: new Date().toISOString(),
  };
}

async function loadProgramEnrollments(programId, cohortId) {
  return prisma.training_enrollments.findMany({
    where: {
      training_cohorts: { program_id: programId, ...(cohortId ? { id: cohortId } : {}) },
    },
    include: {
      training_progress: true,
      training_cohorts: {
        select: {
          id: true,
          name: true,
          branch_id: true,
          organization_branches: { select: { id: true, name: true } },
        },
      },
    },
  });
}

async function collectAssessmentScores(programId, kind, enrollmentIds) {
  if (!enrollmentIds.length) return [];
  const assessments = await prisma.training_assessments.findMany({
    where: { program_id: programId, kind },
    include: {
      training_assessment_attempts: {
        where: { enrollment_id: { in: enrollmentIds }, status: 'GRADED' },
      },
    },
  });
  const scores = [];
  for (const a of assessments) {
    const byEnrollment = new Map();
    for (const att of a.training_assessment_attempts) {
      const score = Number(att.score);
      const prev = byEnrollment.get(att.enrollment_id);
      if (prev == null || score > prev) byEnrollment.set(att.enrollment_id, score);
    }
    for (const score of byEnrollment.values()) scores.push(score);
  }
  return scores;
}

async function buildPairedImprovements(programId, enrollmentIds) {
  if (!enrollmentIds.length) return [];
  const assessments = await prisma.training_assessments.findMany({
    where: { program_id: programId, kind: { in: ['PRE_TEST', 'POST_TEST'] } },
    include: {
      training_assessment_attempts: {
        where: { enrollment_id: { in: enrollmentIds }, status: 'GRADED' },
      },
    },
  });
  const preByEnr = new Map();
  const postByEnr = new Map();
  for (const a of assessments) {
    const target = a.kind === 'PRE_TEST' ? preByEnr : postByEnr;
    for (const att of a.training_assessment_attempts) {
      const score = Number(att.score);
      const prev = target.get(att.enrollment_id);
      if (prev == null || score > prev) target.set(att.enrollment_id, score);
    }
  }
  const pairs = [];
  for (const id of enrollmentIds) {
    if (preByEnr.has(id) && postByEnr.has(id)) {
      pairs.push(computeImprovement(preByEnr.get(id), postByEnr.get(id)));
    }
  }
  return pairs;
}

/**
 * Comprehensive course report snapshot (sections 1–18 summarized).
 */
async function buildCourseTrainingReportData(programId, { cohortId, mode, reason } = {}) {
  const ctx = await loadProgramContext(programId, { cohortId });
  const { program } = ctx;
  const enrollments = await loadProgramEnrollments(programId, cohortId);
  const enrollmentIds = enrollments.map((e) => e.id);
  const total = enrollments.length;
  const completed = enrollments.filter((e) => e.status === 'COMPLETED').length;
  const notCompleted = enrollments.filter((e) => e.status === 'NOT_COMPLETED').length;
  const withdrawn = enrollments.filter((e) => e.status === 'WITHDRAWN').length;
  const exceptional = enrollments.filter((e) => e.status === 'COMPLETED' && e.status_reason).length;

  const certificates = enrollmentIds.length
    ? await prisma.training_certificates.findMany({ where: { enrollment_id: { in: enrollmentIds } } })
    : [];
  const issuedCerts = certificates.filter((c) => c.status === 'ISSUED').length;

  const sessions = await prisma.training_sessions.findMany({
    where: { training_cohorts: { program_id: programId, ...(cohortId ? { id: cohortId } : {}) } },
  });
  const attendanceRecords = enrollmentIds.length
    ? await prisma.training_attendance_records.findMany({ where: { enrollment_id: { in: enrollmentIds } } })
    : [];

  const attendanceByEnrollment = enrollmentIds.map((id) => {
    const recs = attendanceRecords.filter((r) => r.enrollment_id === id);
    return computeAttendanceBreakdown(sessions, recs);
  });
  const attendancePcts = attendanceByEnrollment.map((a) => a.attendancePct).filter((v) => v != null);
  const avgAttendance = average(attendancePcts);
  const requiredAtt = program.required_attendance_pct != null ? Number(program.required_attendance_pct) : null;
  const belowThreshold = requiredAtt == null ? 0 : attendancePcts.filter((p) => p < requiredAtt).length;

  const preScores = await collectAssessmentScores(programId, 'PRE_TEST', enrollmentIds);
  const postScores = await collectAssessmentScores(programId, 'POST_TEST', enrollmentIds);
  const improvements = await buildPairedImprovements(programId, enrollmentIds);
  const improvementPps = improvements.map((i) => i.percentagePointDifference).filter((v) => v != null);

  const evaluationAggregates = await evaluationService.getEvaluationAggregates(programId);
  const npsFromAgg = evaluationAggregates.nps || {};
  const nps = {
    ...computeNps([]),
    promoters: npsFromAgg.promoters || 0,
    passives: npsFromAgg.passives || 0,
    detractors: npsFromAgg.detractors || 0,
    index: npsFromAgg.index,
    totalResponses: npsFromAgg.totalResponses || 0,
    promotersPct: npsFromAgg.totalResponses ? pct(npsFromAgg.promoters || 0, npsFromAgg.totalResponses) : null,
    passivesPct: npsFromAgg.totalResponses ? pct(npsFromAgg.passives || 0, npsFromAgg.totalResponses) : null,
    detractorsPct: npsFromAgg.totalResponses ? pct(npsFromAgg.detractors || 0, npsFromAgg.totalResponses) : null,
  };

  const nonCompletionReasons = {};
  for (const e of enrollments.filter((x) => x.status === 'NOT_COMPLETED')) {
    const reasonKey = e.status_reason || 'سبب غير محدد';
    nonCompletionReasons[reasonKey] = (nonCompletionReasons[reasonKey] || 0) + 1;
  }

  const recommendations = [];
  const pushRec = (finding, evidence, priority, action, role, deadline) => {
    recommendations.push({ finding, evidence, priority, recommendedAction: action, responsibleRole: role, suggestedDeadline: deadline });
  };
  if (avgAttendance != null && avgAttendance < 80) {
    pushRec(
      'نسبة الحضور أقل من المستوى المستهدف',
      `متوسط الحضور ${avgAttendance}%`,
      'High',
      'مراجعة جدولة الجلسات وآليات التذكير والتحفيز قبل الدفعة القادمة',
      'مسؤول المؤسسة / المدرب',
      'قبل الدفعة التالية'
    );
  }
  if (nps.index != null && nps.index < 0) {
    pushRec('مؤشر NPS سلبي', `NPS = ${nps.index}`, 'High', 'مراجعة تجربة المتدربين والتعليقات المفتوحة', 'مسؤول الجودة', 'خلال أسبوعين');
  }
  if (evaluationAggregates.averages?.trainer_score != null && evaluationAggregates.averages.trainer_score < 4) {
    pushRec(
      'تقييم المدرب دون المستوى المستهدف',
      `متوسط تقييم المدرب ${evaluationAggregates.averages.trainer_score}/5`,
      'Medium',
      'تزويد المدرب بتغذية راجعة ودعم قبل الدورة التالية',
      'مسؤول المؤسسة',
      'قبل الدفعة التالية'
    );
  }
  if (evaluationAggregates.averages?.content_score != null && evaluationAggregates.averages.content_score < 4) {
    pushRec(
      'تقييم المحتوى دون المستوى المستهدف',
      `متوسط تقييم المحتوى ${evaluationAggregates.averages.content_score}/5`,
      'Medium',
      'تحديث المادة العلمية وفق ملاحظات المتدربين',
      'مصمم المحتوى',
      'قبل الدفعة التالية'
    );
  }
  if (!recommendations.length) {
    pushRec('المؤشرات ضمن المستوى المستهدف', 'لا توجد انحرافات جوهرية في الحضور أو التقييم أو NPS', 'Low', 'الاستمرار بالممارسات الحالية مع مراقبة الدفعات القادمة', 'مسؤول المؤسسة', null);
  }

  const branchDist = {};
  for (const e of enrollments) {
    const name = e.training_cohorts?.organization_branches?.name || 'غير محدد';
    branchDist[name] = (branchDist[name] || 0) + 1;
  }
  const demographics = {
    byBranch: Object.entries(branchDist)
      .filter(([, count]) => privacySafeGroup(count) || count === enrollments.length)
      .map(([label, count]) => ({ label, count, percentage: pct(count, total) })),
    byCohort: ctx.cohorts.map((c) => {
      const count = enrollments.filter((e) => e.cohort_id === c.id || e.training_cohorts?.id === c.id).length;
      return { label: c.name, count, percentage: pct(count, total) };
    }),
    note: 'لا تُعرض التقسيمات الحساسة للمجموعات الصغيرة جدًا.',
  };

  return {
    meta: metaCover(ctx, REPORT_TYPES.COURSE, { finalizationMode: mode || null, finalizationReason: reason || null }),
    executiveSummary: {
      objective: program.objectives || null,
      organization: ctx.organization?.name,
      dates: metaCover(ctx, REPORT_TYPES.COURSE).trainingDates,
      hours: program.required_hours != null ? Number(program.required_hours) : null,
      traineeCount: total,
      completedCount: completed,
      completionRate: pct(completed, total),
      certificateRate: pct(issuedCerts, total),
      averageAttendance: avgAttendance,
      preTestAverage: average(preScores),
      postTestAverage: average(postScores),
      averageImprovementPp: average(improvementPps),
      evaluationResponseRate: evaluationAggregates.responseRate,
      overallSatisfaction: evaluationAggregates.averages?.overall_reaction_score ?? null,
      nps: nps.index,
      mainStrengths: recommendations.filter((r) => r.priority === 'Low').map((r) => r.finding),
      mainRisks: recommendations.filter((r) => r.priority === 'High').map((r) => r.finding),
      topRecommendations: recommendations.slice(0, 3).map((r) => r.recommendedAction),
    },
    courseInfo: {
      name: program.title,
      code: program.code,
      category: program.field,
      level: program.level,
      language: program.language,
      deliveryMode: program.delivery_mode,
      institution: ctx.organization?.name,
      branches: ctx.branches.map((b) => b.name),
      cohorts: ctx.cohorts.map((c) => c.name),
      trainers: ctx.trainers.map((t) => t.full_name),
      dates: { start: program.start_date, end: program.end_date },
      hours: program.required_hours != null ? Number(program.required_hours) : null,
      sessionCount: sessions.length,
      capacity: program.max_participants,
    },
    enrollmentFunnel: buildEnrollmentFunnel(enrollments),
    demographics,
    attendance: {
      average: avgAttendance,
      median: summarizeNumeric(attendancePcts).median,
      distribution: summarizeNumeric(attendancePcts),
      belowThreshold,
      totalDeliveredHours: round2(sessions.reduce((s, x) => s + Number(x.hours || 0), 0)),
      totalAttendedTraineeHours: round2(attendanceByEnrollment.reduce((s, a) => s + (a.hoursCompleted || 0), 0)),
    },
    preTest: { ...summarizeNumeric(preScores), eligible: total, attempted: preScores.length, responseRate: pct(preScores.length, total) },
    postTest: { ...summarizeNumeric(postScores), attempted: postScores.length, completionRate: pct(postScores.length, total) },
    learningImpact: {
      pairedCount: improvements.length,
      averagePre: average(improvements.map((i) => i.preTestScore)),
      averagePost: average(improvements.map((i) => i.postTestScore)),
      averagePp: average(improvementPps),
      medianPp: summarizeNumeric(improvementPps).median,
      maxPp: summarizeNumeric(improvementPps).max,
      improved: improvements.filter((i) => i.direction === 'improved').length,
      unchanged: improvements.filter((i) => i.direction === 'unchanged').length,
      decreased: improvements.filter((i) => i.direction === 'decreased').length,
      caveat: 'الفرق الملحوظ في الدرجات بعد التدريب لا يعني بالضرورة سببية مباشرة.',
    },
    evaluation: evaluationAggregates,
    nps,
    completion: {
      completionRate: pct(completed, total),
      completed,
      notCompleted,
      withdrawn,
      exceptional,
      reasons: Object.entries(nonCompletionReasons).map(([label, count]) => ({ label, count })),
    },
    certificates: {
      eligible: completed,
      ineligible: Math.max(0, total - completed),
      issued: issuedCerts,
      pending: Math.max(0, completed - issuedCerts),
      revoked: certificates.filter((c) => c.status === 'REVOKED').length,
    },
    recommendations,
    specializedReportLinks: Object.values(REPORT_TYPES)
      .filter((t) => t !== REPORT_TYPES.COURSE && t !== REPORT_TYPES.INDIVIDUAL)
      .map((t) => ({ type: t, title: REPORT_TYPE_TITLES_AR[t] })),
    counts: { total, completed, notCompleted, withdrawn, active: enrollments.filter((e) => ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED'].includes(e.status)).length },
    completionRate: pct(completed, total) || 0,
    dropoutRate: pct(withdrawn, total) || 0,
    averageAttendancePct: avgAttendance,
    generatedAt: new Date().toISOString(),
  };
}

async function buildCohortTrainingReportData(programId, cohortId) {
  if (!cohortId) throw new ApiError(400, 'معرّف الدفعة مطلوب', null, 'COHORT_ID_REQUIRED');
  const data = await buildCourseTrainingReportData(programId, { cohortId });
  data.meta.reportType = REPORT_TYPES.COHORT;
  data.meta.reportTitle = REPORT_TYPE_TITLES_AR.COHORT;
  return data;
}

async function buildTrainerPerformanceReportData(programId, { cohortId, trainerUserId } = {}) {
  const ctx = await loadProgramContext(programId, { cohortId });
  const course = await buildCourseTrainingReportData(programId, { cohortId });
  const trainer =
    ctx.trainers.find((t) => t.id === trainerUserId) ||
    ctx.trainers[0] ||
    null;
  return {
    meta: metaCover(ctx, REPORT_TYPES.TRAINER, { trainerName: trainer?.full_name || null }),
    trainer: trainer ? { id: trainer.id, fullName: trainer.full_name, email: trainer.email } : null,
    evaluationScores: {
      trainerAverage: course.evaluation?.averages?.trainer_score ?? null,
      responseRate: course.evaluation?.responseRate ?? null,
      totalResponses: course.evaluation?.totalSubmitted ?? null,
    },
    execution: {
      attendanceAverage: course.attendance?.average ?? null,
      completionRate: course.completion?.completionRate ?? null,
      learningImpactAveragePp: course.learningImpact?.averagePp ?? null,
    },
    note: 'مؤشرات الرضا منفصلة عن نواتج التعلّم؛ لا يُحسب أداء المدرب من الحضور أو الاختبارات وحدها.',
    recommendations: course.recommendations.filter((r) => /المدرب|trainer/i.test(`${r.finding} ${r.recommendedAction}`)),
    generatedAt: new Date().toISOString(),
  };
}

async function buildEvaluationReportData(programId, { cohortId } = {}) {
  const ctx = await loadProgramContext(programId, { cohortId });
  const aggregates = await evaluationService.getEvaluationAggregates(programId);
  const nps = {
    promoters: aggregates.nps?.promoters || 0,
    passives: aggregates.nps?.passives || 0,
    detractors: aggregates.nps?.detractors || 0,
    index: aggregates.nps?.index ?? null,
    totalResponses: aggregates.nps?.totalResponses || 0,
    promotersPct: aggregates.nps?.totalResponses ? pct(aggregates.nps.promoters || 0, aggregates.nps.totalResponses) : null,
    passivesPct: aggregates.nps?.totalResponses ? pct(aggregates.nps.passives || 0, aggregates.nps.totalResponses) : null,
    detractorsPct: aggregates.nps?.totalResponses ? pct(aggregates.nps.detractors || 0, aggregates.nps.totalResponses) : null,
    note: 'NPS = نسبة المروّجين − نسبة المنتقدين. لا يُعرض كمتوسط درجات.',
  };
  return {
    meta: metaCover(ctx, REPORT_TYPES.EVALUATION),
    responseRate: aggregates.responseRate,
    totalAssignments: aggregates.totalAssignments,
    totalSubmitted: aggregates.totalSubmitted,
    sections: aggregates.averages,
    nps,
    deliveryMode: ctx.program.delivery_mode,
    generatedAt: new Date().toISOString(),
  };
}

async function buildAttendanceReportData(programId, { cohortId } = {}) {
  const ctx = await loadProgramContext(programId, { cohortId });
  const course = await buildCourseTrainingReportData(programId, { cohortId });
  const enrollments = await loadProgramEnrollments(programId, cohortId);
  const sessions = await prisma.training_sessions.findMany({
    where: { training_cohorts: { program_id: programId, ...(cohortId ? { id: cohortId } : {}) } },
    orderBy: { starts_at: 'asc' },
  });
  const records = enrollments.length
    ? await prisma.training_attendance_records.findMany({ where: { enrollment_id: { in: enrollments.map((e) => e.id) } } })
    : [];

  const bySession = sessions.map((s) => {
    const sessionRecs = records.filter((r) => r.session_id === s.id);
    const presentLike = sessionRecs.filter((r) => ['present', 'late', 'excused'].includes(String(r.status || '').toLowerCase()));
    return {
      sessionId: s.id,
      title: s.title,
      date: s.starts_at,
      dateLabel: formatDateAr(s.starts_at),
      present: presentLike.length,
      total: enrollments.length,
      attendancePct: enrollments.length ? pct(presentLike.length, enrollments.length) : null,
    };
  });

  return {
    meta: metaCover(ctx, REPORT_TYPES.ATTENDANCE),
    summary: course.attendance,
    bySession,
    traineeCount: enrollments.length,
    sessionCount: sessions.length,
    generatedAt: new Date().toISOString(),
  };
}

async function buildLearningImpactReportData(programId, { cohortId } = {}) {
  const ctx = await loadProgramContext(programId, { cohortId });
  const course = await buildCourseTrainingReportData(programId, { cohortId });
  return {
    meta: metaCover(ctx, REPORT_TYPES.LEARNING_IMPACT),
    preTest: course.preTest,
    postTest: course.postTest,
    learningImpact: course.learningImpact,
    formulas: {
      percentagePointDifference: 'البعدي − القبلي (نقاط مئوية)',
      relativeImprovement: '((البعدي − القبلي) / القبلي) × 100 عندما يكون القبلي > 0',
    },
    caveat: course.learningImpact.caveat,
    generatedAt: new Date().toISOString(),
  };
}

async function buildCertificatesCompletionReportData(programId, { cohortId } = {}) {
  const ctx = await loadProgramContext(programId, { cohortId });
  const enrollments = await loadProgramEnrollments(programId, cohortId);
  const enrollmentIds = enrollments.map((e) => e.id);
  const certificates = enrollmentIds.length
    ? await prisma.training_certificates.findMany({ where: { enrollment_id: { in: enrollmentIds } } })
    : [];
  const users = enrollmentIds.length
    ? await prisma.users.findMany({
        where: { id: { in: [...new Set(enrollments.map((e) => e.user_id))] } },
        select: { id: true, full_name: true, email: true },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const certMap = new Map(certificates.map((c) => [c.enrollment_id, c]));

  const rows = enrollments.map((e) => {
    const cert = certMap.get(e.id);
    const user = userMap.get(e.user_id);
    return {
      enrollmentId: e.id,
      fullName: user?.full_name || null,
      email: user?.email || null,
      enrollmentStatus: e.status,
      completedAt: e.completed_at,
      certificateStatus: cert?.status || 'NONE',
      certificateNumber: cert?.certificate_number || null,
      issuedAt: cert?.issued_at || null,
      verificationCode: cert?.verification_code || null,
    };
  });

  const course = await buildCourseTrainingReportData(programId, { cohortId });
  return {
    meta: metaCover(ctx, REPORT_TYPES.CERTIFICATES),
    summary: course.certificates,
    completion: course.completion,
    rows,
    generatedAt: new Date().toISOString(),
  };
}

async function buildReportSnapshot(reportType, { programId, cohortId, enrollmentId, trainerUserId, mode, reason } = {}) {
  switch (reportType) {
    case REPORT_TYPES.INDIVIDUAL:
      return buildIndividualTrainingReportData(enrollmentId);
    case REPORT_TYPES.COURSE:
      return buildCourseTrainingReportData(programId, { cohortId, mode, reason });
    case REPORT_TYPES.COHORT:
      return buildCohortTrainingReportData(programId, cohortId);
    case REPORT_TYPES.TRAINER:
      return buildTrainerPerformanceReportData(programId, { cohortId, trainerUserId });
    case REPORT_TYPES.EVALUATION:
      return buildEvaluationReportData(programId, { cohortId });
    case REPORT_TYPES.ATTENDANCE:
      return buildAttendanceReportData(programId, { cohortId });
    case REPORT_TYPES.LEARNING_IMPACT:
      return buildLearningImpactReportData(programId, { cohortId });
    case REPORT_TYPES.CERTIFICATES:
      return buildCertificatesCompletionReportData(programId, { cohortId });
    default:
      throw new ApiError(400, 'نوع التقرير غير مدعوم', null, 'INVALID_REPORT_TYPE');
  }
}

function checksumSnapshot(snapshot) {
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

module.exports = {
  loadProgramContext,
  buildIndividualTrainingReportData,
  buildCourseTrainingReportData,
  buildCohortTrainingReportData,
  buildTrainerPerformanceReportData,
  buildEvaluationReportData,
  buildAttendanceReportData,
  buildLearningImpactReportData,
  buildCertificatesCompletionReportData,
  buildReportSnapshot,
  checksumSnapshot,
  formatDateAr,
};
