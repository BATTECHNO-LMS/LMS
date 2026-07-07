const { prisma } = require('../../config/db');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { env } = require('../../config/env');
const { renderHtmlToPdf } = require('../analytics/pdfRenderer');
const { assertManageOpportunityAccess } = require('./fieldTraining.access');
const ftNotify = require('./fieldTraining.notifications');
const repo = require('./fieldTraining.repository');
const workflow = require('./fieldTraining.workflow');
const aiService = require('./fieldTraining.ai.service');
const progressBuilder = require('./fieldTraining.progress');

function gradeAnswers(questions, answers) {
  let score = 0;
  let max = 0;
  for (const q of questions) {
    const pts = Number(q.points) || 1;
    max += pts;
    const given = answers?.[q.id];
    if (given == null) continue;
    const correct = q.correct_answer;
    if (q.question_type === 'short_answer') {
      if (
        correct != null &&
        String(given).trim().toLowerCase() === String(correct).trim().toLowerCase()
      ) {
        score += pts;
      }
      continue;
    }
    if (JSON.stringify(given) === JSON.stringify(correct)) {
      score += pts;
    }
  }
  return { score, max };
}

async function assertPreAssessmentSatisfied(opportunityId) {
  const opp = await repo.findById(opportunityId);
  if (!opp?.requires_pre_assessment) return true;
  const assessment = await repo.findAssessmentByOpportunityAndType(opportunityId, 'pre');
  if (!assessment || assessment.status !== 'published') {
    throw new ApiError(400, 'يجب نشر التقييم القبلي قبل بدء التدريب');
  }
  const pending = await prisma.field_training_applications.count({
    where: {
      opportunity_id: opportunityId,
      status: 'approved',
      training_status: 'pre_assessment_pending',
      expelled_at: null,
    },
  });
  if (pending > 0) {
    throw new ApiError(400, 'يوجد مشاركون لم يكملوا التقييم القبلي بعد');
  }
  return true;
}

async function startTraining(opportunityId, userId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  assertManageOpportunityAccess(user, opp);
  if (!['published', 'in_progress'].includes(opp.status)) {
    throw new ApiError(400, 'يجب نشر الفرصة قبل بدء التدريب');
  }

  const approvedCount = await repo.countApprovedApplications(opportunityId);
  if (!approvedCount) {
    throw new ApiError(400, 'لا يوجد مشاركون معتمدون');
  }

  await assertPreAssessmentSatisfied(opportunityId);

  const now = new Date();
  await repo.updateOpportunity(opportunityId, {
    status: 'in_progress',
    training_started_at: opp.training_started_at || now,
  });

  await prisma.field_training_applications.updateMany({
    where: {
      opportunity_id: opportunityId,
      status: 'approved',
      training_status: { in: ['pre_assessment_completed', 'ready_for_training'] },
      expelled_at: null,
    },
    data: { training_status: 'in_training', training_started_at: now },
  });

  const participants = await repo.findActiveParticipants(opportunityId);
  await ftNotify.notifyStudentsTrainingStarted({
    studentIds: participants.map((p) => p.student_id),
    opportunityId,
    opportunityTitle: opp.title,
  });

  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_STARTED',
    entityType: 'field_training_opportunity',
    entityId: opportunityId,
  });

  const updated = await repo.findById(opportunityId);
  return { opportunity: repo.mapOpportunityRow(updated) };
}

async function listSessions(opportunityId, user, { studentId } = {}) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');

  let applicationId;
  if (studentId) {
    const app = await prisma.field_training_applications.findUnique({
      where: {
        opportunity_id_student_id: { opportunity_id: opportunityId, student_id: studentId },
      },
    });
    if (!app || app.status !== 'approved' || workflow.isExpelled(app)) {
      throw new ApiError(403, 'غير مصرح');
    }
    applicationId = app.id;
  } else {
    assertManageOpportunityAccess(user, opp);
  }

  const sessions = await repo.findSessionsByOpportunity(opportunityId, { applicationId });
  return { sessions };
}

async function createSession(opportunityId, body, userId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  assertManageOpportunityAccess(user, opp);

  const row = await repo.createSession({
    opportunity_id: opportunityId,
    title: body.title.trim(),
    description: body.description ?? null,
    session_date: repo.toDateOnly(body.session_date),
    start_time: body.start_time,
    end_time: body.end_time,
    zoom_link: body.zoom_link ?? null,
    is_required: body.is_required ?? true,
    created_by_id: userId,
  });

  const participants = await repo.findActiveParticipants(opportunityId);
  await ftNotify.notifyStudentsNewSession({
    studentIds: participants.filter((p) => workflow.canAccessTrainingContent(p)).map((p) => p.student_id),
    opportunityId,
    opportunityTitle: opp.title,
    sessionTitle: row.title,
  });

  return { session: repo.mapSessionRow(row) };
}

async function updateSession(sessionId, body, user) {
  const session = await repo.findSessionById(sessionId);
  if (!session) throw new ApiError(404, 'Session not found');
  assertManageOpportunityAccess(user, session.field_training_opportunities);

  const data = {};
  if (body.title != null) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description;
  if (body.session_date !== undefined) data.session_date = repo.toDateOnly(body.session_date);
  if (body.start_time != null) data.start_time = body.start_time;
  if (body.end_time != null) data.end_time = body.end_time;
  if (body.zoom_link !== undefined) data.zoom_link = body.zoom_link;
  if (body.is_required !== undefined) data.is_required = body.is_required;

  const updated = await repo.updateSession(sessionId, data);
  const oppRow = await repo.findById(session.opportunity_id);
  const participants = await repo.findActiveParticipants(session.opportunity_id);
  await ftNotify.notifyStudentsSessionUpdated({
    studentIds: participants.filter((p) => workflow.canAccessTrainingContent(p)).map((p) => p.student_id),
    opportunityId: session.opportunity_id,
    opportunityTitle: oppRow?.title,
    sessionTitle: updated.title,
  });
  return { session: repo.mapSessionRow(updated) };
}

async function deleteSession(sessionId, user) {
  const session = await repo.findSessionById(sessionId);
  if (!session) throw new ApiError(404, 'Session not found');
  assertManageOpportunityAccess(user, session.field_training_opportunities);
  if (session._count?.field_training_attendance > 0) {
    throw new ApiError(400, 'لا يمكن حذف جلسة تم تسجيل حضورها');
  }
  await repo.deleteSession(sessionId);
  return { ok: true };
}

async function saveSessionAttendance(sessionId, records, userId, user) {
  const session = await repo.findSessionById(sessionId);
  if (!session) throw new ApiError(404, 'Session not found');
  const opp = session.field_training_opportunities;
  assertManageOpportunityAccess(user, opp);

  const activeApps = await repo.findActiveParticipants(opp.id);
  const activeById = new Map(activeApps.map((a) => [a.id, a]));

  for (const rec of records) {
    const app = activeById.get(rec.applicationId);
    if (!app || app.student_id !== rec.studentId) {
      throw new ApiError(400, 'مشارك غير صالح للجلسة');
    }
  }

  await repo.upsertAttendanceRecords(sessionId, records, userId);

  const absentStudentIds = records
    .filter((r) => r.status === 'absent')
    .map((r) => r.studentId);
  if (absentStudentIds.length) {
    await ftNotify.notifyStudentsMarkedAbsent({
      studentIds: absentStudentIds,
      opportunityId: opp.id,
      opportunityTitle: (await repo.findById(opp.id))?.title,
      sessionTitle: session.title,
    });
  }

  const applicationIds = [...new Set(records.map((r) => r.applicationId))];
  const oppFull = await repo.findById(opp.id);
  const minAttendance = oppFull?.minimum_attendance_percentage;

  for (const appId of applicationIds) {
    await workflow.refreshAttendancePercentage(appId);
    await workflow.persistEligibility(appId);

    if (minAttendance != null) {
      const refreshed = await repo.findApplicationById(appId);
      const pct = refreshed?.attendance_percentage != null ? Number(refreshed.attendance_percentage) : null;
      if (pct != null && pct < minAttendance) {
        const profiles = await repo.findStudentProfilesByIds([refreshed.student_id]);
        await ftNotify.notifyStaffAttendanceRisk({
          opportunityId: opp.id,
          opportunityTitle: oppFull?.title,
          universityId: oppFull?.university_id,
          instructorId: oppFull?.assigned_instructor_id,
          studentName: profiles[0]?.full_name,
          attendancePercentage: Math.round(pct),
          minimumRequired: minAttendance,
        });
      }
    }
  }

  return { ok: true, saved: records.length };
}

async function getSessionParticipants(sessionId, user) {
  const session = await repo.findSessionById(sessionId);
  if (!session) throw new ApiError(404, 'Session not found');
  assertManageOpportunityAccess(user, session.field_training_opportunities);

  const apps = await repo.findActiveParticipants(session.opportunity_id);
  const profiles = await repo.findStudentProfilesByIds(apps.map((a) => a.student_id));
  const byId = Object.fromEntries(profiles.map((u) => [u.id, u]));

  const attendance = await prisma.field_training_attendance.findMany({
    where: { session_id: sessionId },
  });
  const attByApp = Object.fromEntries(attendance.map((a) => [a.application_id, a]));

  return {
    participants: apps.map((a) => ({
      ...repo.mapApplicationRow(a),
      student_name: byId[a.student_id]?.full_name ?? null,
      attendance: attByApp[a.id] ? repo.mapAttendanceRow(attByApp[a.id]) : null,
    })),
  };
}

async function upsertAssessment(opportunityId, type, body, userId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  assertManageOpportunityAccess(user, opp);

  const assessment = await repo.upsertAssessment({
    opportunity_id: opportunityId,
    type,
    title: body.title.trim(),
    description: body.description ?? null,
    passing_score: body.passing_score ?? null,
    status: body.status ?? 'draft',
    created_by_id: userId,
  });

  if (body.questions?.length) {
    await repo.replaceAssessmentQuestions(assessment.id, body.questions);
  }

  const full = await repo.findAssessmentById(assessment.id);
  return {
    assessment: {
      ...repo.mapAssessmentRow(full, { includeQuestions: true }),
      questions: full.field_training_assessment_questions.map(repo.mapAssessmentQuestionRowAdmin),
    },
  };
}

async function publishAssessment(opportunityId, type, userId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  assertManageOpportunityAccess(user, opp);

  const assessment = await repo.findAssessmentByOpportunityAndType(opportunityId, type);
  if (!assessment) throw new ApiError(404, 'Assessment not found');
  if (!assessment.field_training_assessment_questions?.length) {
    throw new ApiError(400, 'أضف أسئلة قبل النشر');
  }

  await prisma.field_training_assessments.update({
    where: { id: assessment.id },
    data: { status: 'published' },
  });

  if (type === 'post') {
    const apps = await repo.findActiveParticipants(opportunityId);
    await ftNotify.notifyStudentsPostAssessmentAvailable({
      studentIds: apps.filter((p) => workflow.canTakePostAssessment(p, opp)).map((p) => p.student_id),
      opportunityId,
      opportunityTitle: opp.title,
    });
  }

  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_ASSESSMENT_PUBLISHED',
    entityType: 'field_training_assessment',
    entityId: assessment.id,
    newValues: { type },
  });

  return { ok: true };
}

async function getStudentAssessment(opportunityId, type, studentId) {
  const opp = await repo.findPublishedById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');

  const app = await repo.findApplicationByOpportunityAndStudent(opportunityId, studentId);
  if (!app || app.status !== 'approved' || workflow.isExpelled(app)) {
    throw new ApiError(403, 'غير مصرح');
  }

  if (type === 'pre' && !workflow.canTakePreAssessment(app, opp)) {
    throw new ApiError(403, 'التقييم القبلي غير متاح حاليًا');
  }
  if (type === 'post' && !workflow.canTakePostAssessment(app, opp)) {
    throw new ApiError(403, 'التقييم البعدي غير متاح حاليًا');
  }

  const assessment = await repo.findAssessmentByOpportunityAndType(opportunityId, type);
  if (!assessment || assessment.status !== 'published') {
    throw new ApiError(404, 'التقييم غير منشور');
  }

  const attempt = await repo.findAssessmentAttempt(assessment.id, app.id);
  return {
    assessment: {
      ...repo.mapAssessmentRow(assessment, { includeQuestions: true }),
      questions: assessment.field_training_assessment_questions.map(repo.mapAssessmentQuestionRow),
    },
    attempt: attempt
      ? {
          id: attempt.id,
          score: attempt.score != null ? Number(attempt.score) : null,
          max_score: attempt.max_score != null ? Number(attempt.max_score) : null,
          level: attempt.level,
          submitted_at: attempt.submitted_at,
        }
      : null,
  };
}

async function submitAssessment(opportunityId, type, answers, studentId) {
  const opp = await repo.findPublishedById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');

  const app = await repo.findApplicationByOpportunityAndStudent(opportunityId, studentId);
  if (!app || app.status !== 'approved' || workflow.isExpelled(app)) {
    throw new ApiError(403, 'غير مصرح');
  }

  const assessment = await repo.findAssessmentByOpportunityAndType(opportunityId, type);
  if (!assessment || assessment.status !== 'published') {
    throw new ApiError(404, 'التقييم غير منشور');
  }

  if (type === 'pre' && !workflow.canTakePreAssessment(app, opp)) {
    throw new ApiError(403, 'التقييم القبلي غير متاح');
  }
  if (type === 'post' && !workflow.canTakePostAssessment(app, opp)) {
    throw new ApiError(403, 'التقييم البعدي غير متاح');
  }

  const existing = await repo.findAssessmentAttempt(assessment.id, app.id);
  if (existing?.submitted_at) {
    throw new ApiError(409, 'تم تسليم التقييم مسبقًا');
  }

  const { score, max } = gradeAnswers(assessment.field_training_assessment_questions, answers);
  const level = workflow.scoreToLevel(score, max);
  const now = new Date();

  const attempt = await repo.upsertAssessmentAttempt({
    assessment_id: assessment.id,
    application_id: app.id,
    student_id: studentId,
    answers,
    score,
    max_score: max,
    level,
    submitted_at: now,
  });

  const appUpdate = {};
  if (type === 'pre') {
    appUpdate.pre_assessment_score = score;
    appUpdate.pre_assessment_level = level;
    appUpdate.training_status =
      opp.status === 'in_progress' ? 'in_training' : 'pre_assessment_completed';
  } else {
    appUpdate.post_assessment_score = score;
    appUpdate.training_status = 'post_assessment_completed';
  }

  await repo.updateApplication(app.id, appUpdate);

  if (type === 'post') {
    const eligibility = await workflow.persistEligibility(app.id);
    const oppRow = await repo.findById(opportunityId);
    await ftNotify.notifyStaffPostAssessmentCompleted({
      opportunityId,
      opportunityTitle: oppRow?.title,
      universityId: oppRow?.university_id,
      instructorId: oppRow?.assigned_instructor_id,
      studentName: (await repo.findStudentProfilesByIds([studentId]))[0]?.full_name,
    });
    if (eligibility.outcome === 'eligible') {
      await ftNotify.notifyStaffEligibilityReady({
        opportunityId,
        opportunityTitle: oppRow?.title,
        universityId: oppRow?.university_id,
        instructorId: oppRow?.assigned_instructor_id,
        studentName: (await repo.findStudentProfilesByIds([studentId]))[0]?.full_name,
      });
    }
  } else {
    const oppRow = await repo.findById(opportunityId);
    await ftNotify.notifyStaffPreAssessmentCompleted({
      opportunityId,
      opportunityTitle: oppRow?.title,
      universityId: oppRow?.university_id,
      instructorId: oppRow?.assigned_instructor_id,
      studentName: (await repo.findStudentProfilesByIds([studentId]))[0]?.full_name,
      level,
    });
  }

  return {
    attempt: {
      id: attempt.id,
      score: Number(score),
      max_score: Number(max),
      level,
      submitted_at: now,
    },
  };
}

async function expelParticipant(applicationId, body, userId, user) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  assertManageOpportunityAccess(user, opp);

  if (workflow.isExpelled(app)) {
    throw new ApiError(400, 'الطالب مستبعد مسبقًا');
  }

  const now = new Date();
  const updateData = {
    training_status: 'expelled',
    expelled_at: now,
    expelled_by_id: userId,
    expulsion_reason: body.reason?.trim() || null,
    completion_eligibility_status: 'ineligible',
  };
  if (body.allowReapply) {
    updateData.status = 'cancelled';
    updateData.training_status = 'none';
  }
  await repo.updateApplication(applicationId, updateData);

  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_PARTICIPANT_EXPELLED',
    entityType: 'field_training_application',
    entityId: applicationId,
    newValues: { reason: body.reason },
  });

  if (body.notifyStudent !== false) {
    await ftNotify.notifyStudentExpelled({
      studentId: app.student_id,
      opportunityId: opp.id,
      opportunityTitle: opp.title,
      reason: body.reason,
    });
  }

  return { application: repo.mapApplicationRow(await repo.findApplicationById(applicationId)) };
}

async function runTaskAiSelfEvaluate(taskId, studentInput, studentId) {
  const task = await repo.findTaskById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');
  if (!task.requires_ai_self_evaluation) {
    throw new ApiError(400, 'هذه المهمة لا تتطلب تقييمًا ذاتيًا بالذكاء الاصطناعي');
  }
  if (!task.ai_self_evaluation_prompt?.trim()) {
    throw new ApiError(400, 'لم يتم إعداد برومبت التقييم لهذه المهمة', null, 'AI_PROMPT_NOT_CONFIGURED');
  }

  const opp = await prisma.field_training_opportunities.findUnique({
    where: { id: task.opportunity_id },
  });
  const app = await repo.findApplicationByOpportunityAndStudent(task.opportunity_id, studentId);
  if (!app || app.status !== 'approved' || workflow.isExpelled(app)) {
    throw new ApiError(403, 'غير مصرح');
  }
  if (!workflow.canAccessTrainingContent(app)) {
    throw new ApiError(403, 'التدريب غير نشط بعد');
  }

  const result = await aiService.runSelfEvaluationAi({
    systemPrompt: task.ai_self_evaluation_prompt,
    studentInput: studentInput.trim(),
  });

  return {
    ai_response: result.text,
    ai_model_provider: result.provider,
    ai_model_name: result.model,
    ai_prompt_used: task.ai_self_evaluation_prompt,
    evaluated_at: new Date().toISOString(),
  };
}

function buildCompletionLetterHtml(data) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: Tajawal, 'IBM Plex Sans Arabic', sans-serif; color: #1a2332; margin: 0; padding: 24px; }
  .header { text-align: center; border-bottom: 3px solid #0d4f8b; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { font-size: 22px; font-weight: 700; color: #0d4f8b; }
  h1 { font-size: 20px; margin: 16px 0; }
  .meta { margin: 12px 0; line-height: 1.8; }
  .footer { margin-top: 40px; font-size: 12px; color: #5c6675; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">BATTECHNO LMS</div>
    <h1>كتاب إنهاء التدريب الميداني</h1>
    <div>رقم الكتاب: ${data.letterNo}</div>
  </div>
  <div class="meta">
    <p>نشهد بأن الطالب/ة <strong>${data.studentName}</strong></p>
    <p>من جامعة <strong>${data.universityName || '—'}</strong> — تخصص <strong>${data.specialtyName || '—'}</strong></p>
    <p>قد أتم/أتمت التدريب الميداني في فرصة: <strong>${data.opportunityTitle}</strong></p>
    <p>الفترة: ${data.startDate || '—'} إلى ${data.endDate || '—'}</p>
    <p>نسبة الحضور: ${data.attendancePct != null ? `${data.attendancePct}%` : '—'}</p>
    <p>درجة التقييم البعدي: ${data.postScore != null ? data.postScore : '—'}</p>
    <p>المدرب المسؤول: ${data.instructorName || '—'}</p>
  </div>
  <div class="footer">
    رمز التحقق: ${data.verificationCode || '—'} · تاريخ الإصدار: ${data.issuedAt}
  </div>
</body>
</html>`;
}

async function issueCompletionLetter(applicationId, userId, user) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  assertManageOpportunityAccess(user, opp);

  if (workflow.isExpelled(app)) {
    throw new ApiError(400, 'لا يمكن إصدار كتاب لطالب مستبعد');
  }

  const existing = await repo.findCompletionLetterByApplication(applicationId);
  if (existing) {
    throw new ApiError(409, 'تم إصدار كتاب الإنهاء مسبقًا');
  }

  const eligibility = await workflow.calculateFieldTrainingEligibility(applicationId);
  if (eligibility.outcome !== 'eligible') {
    throw new ApiError(400, 'الطالب غير مؤهل لإصدار كتاب الإنهاء', eligibility);
  }

  const profiles = await repo.findStudentProfilesByIds([app.student_id]);
  const student = profiles[0];
  let instructorName = null;
  if (opp.assigned_instructor_id) {
    const ins = await prisma.users.findUnique({
      where: { id: opp.assigned_instructor_id },
      select: { full_name: true },
    });
    instructorName = ins?.full_name ?? null;
  }

  const letterNo = `FT-${Date.now().toString(36).toUpperCase()}`;
  const verificationCode = crypto.randomBytes(16).toString('hex');
  const issuedAt = new Date().toISOString().slice(0, 10);

  const html = buildCompletionLetterHtml({
    letterNo,
    studentName: student?.full_name || '—',
    universityName: student?.university?.name,
    specialtyName: student?.specialty?.name_ar || student?.specialty?.name_en,
    opportunityTitle: opp.title,
    startDate: repo.mapOpportunityRow(opp).start_date,
    endDate: repo.mapOpportunityRow(opp).end_date,
    attendancePct: app.attendance_percentage != null ? Number(app.attendance_percentage) : null,
    postScore: app.post_assessment_score != null ? Number(app.post_assessment_score) : null,
    instructorName,
    verificationCode,
    issuedAt,
  });

  const pdfBuffer = await renderHtmlToPdf(html, { lang: 'ar' });
  const relDir = path.posix.join('field-training', 'completion-letters', applicationId);
  const absDir = path.join(env.UPLOAD_DIR || 'uploads', relDir);
  fs.mkdirSync(absDir, { recursive: true });
  const fileName = `${letterNo}.pdf`;
  const relPath = path.posix.join(relDir, fileName);
  fs.writeFileSync(path.join(env.UPLOAD_DIR || 'uploads', relPath), pdfBuffer);

  const letter = await repo.createCompletionLetter({
    application_id: applicationId,
    student_id: app.student_id,
    opportunity_id: opp.id,
    letter_no: letterNo,
    status: 'issued',
    issued_by_id: userId,
    pdf_url: relPath,
    verification_code: verificationCode,
    metadata: { eligibility: eligibility.details },
  });

  await repo.updateApplication(applicationId, {
    completion_letter_issued_at: new Date(),
    training_status: 'completed',
    completion_eligibility_status: 'eligible',
  });

  await ftNotify.notifyStudentCompletionLetter({
    studentId: app.student_id,
    opportunityId: opp.id,
    opportunityTitle: opp.title,
  });

  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_COMPLETION_LETTER_ISSUED',
    entityType: 'field_training_completion_letter',
    entityId: letter.id,
  });

  return {
    letter: {
      id: letter.id,
      letter_no: letter.letter_no,
      pdf_url: letter.pdf_url,
      verification_code: letter.verification_code,
      issued_at: letter.issued_at,
    },
  };
}

async function listInstructors() {
  const instructors = await repo.findInstructorsForSelect();
  return { instructors };
}

async function getApplicationProgress(applicationId, user) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  assertManageOpportunityAccess(user, opp);

  const [sessionsCount, tasksCount, tasksSubmitted] = await Promise.all([
    prisma.field_training_sessions.count({ where: { opportunity_id: opp.id } }),
    prisma.field_training_tasks.count({ where: { opportunity_id: opp.id } }),
    prisma.field_training_task_submissions.count({ where: { application_id: app.id } }),
  ]);

  const profiles = await repo.findStudentProfilesByIds([app.student_id]);
  return {
    progress: progressBuilder.buildParticipantProgress(app, opp, {
      sessionsCount,
      tasksCount,
      tasksSubmitted,
    }),
    student_name: profiles[0]?.full_name ?? null,
  };
}

async function getStudentOpportunityProgress(opportunityId, studentId) {
  const opp = await repo.findPublishedById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  const app = await repo.findApplicationByOpportunityAndStudent(opportunityId, studentId);
  if (!app) {
    return {
      progress: null,
      message: 'لم يتم التقديم على هذه الفرصة بعد',
    };
  }

  const [sessionsCount, tasksCount, tasksSubmitted] = await Promise.all([
    prisma.field_training_sessions.count({ where: { opportunity_id: opp.id } }),
    prisma.field_training_tasks.count({ where: { opportunity_id: opp.id } }),
    prisma.field_training_task_submissions.count({ where: { application_id: app.id } }),
  ]);

  const letter = await repo.findCompletionLetterByApplicationForStudent(app.id, studentId);

  return {
    progress: progressBuilder.buildParticipantProgress(app, opp, {
      sessionsCount,
      tasksCount,
      tasksSubmitted,
    }),
    completion_letter_id: letter?.id ?? null,
  };
}

async function getSessionAttendance(sessionId, user) {
  return getSessionParticipants(sessionId, user);
}

async function listOpportunityAssessments(opportunityId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  assertManageOpportunityAccess(user, opp);
  const assessments = await repo.findAssessmentsByOpportunity(opportunityId);
  return { assessments };
}

async function createOpportunityAssessment(opportunityId, body, userId, user) {
  return upsertAssessment(opportunityId, body.type, body, userId, user);
}

async function updateAssessmentById(assessmentId, body, user) {
  const assessment = await repo.findAssessmentById(assessmentId);
  if (!assessment) throw new ApiError(404, 'Assessment not found');
  assertManageOpportunityAccess(user, assessment.field_training_opportunities);

  const data = {};
  if (body.title != null) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description;
  if (body.passing_score !== undefined) data.passing_score = body.passing_score;
  if (body.status != null) data.status = body.status;

  if (Object.keys(data).length) {
    await prisma.field_training_assessments.update({ where: { id: assessmentId }, data });
  }
  if (body.questions?.length) {
    await repo.replaceAssessmentQuestions(assessmentId, body.questions);
  }

  const full = await repo.findAssessmentById(assessmentId);
  return {
    assessment: {
      ...repo.mapAssessmentRow(full, { includeQuestions: true }),
      questions: full.field_training_assessment_questions.map(repo.mapAssessmentQuestionRowAdmin),
    },
  };
}

async function publishAssessmentById(assessmentId, userId, user) {
  const assessment = await repo.findAssessmentById(assessmentId);
  if (!assessment) throw new ApiError(404, 'Assessment not found');
  assertManageOpportunityAccess(user, assessment.field_training_opportunities);
  if (!assessment.field_training_assessment_questions?.length) {
    throw new ApiError(400, 'أضف أسئلة قبل النشر');
  }

  await prisma.field_training_assessments.update({
    where: { id: assessmentId },
    data: { status: 'published' },
  });

  const opp = assessment.field_training_opportunities;
  if (assessment.type === 'post') {
    const apps = await repo.findActiveParticipants(opp.id);
    await ftNotify.notifyStudentsPostAssessmentAvailable({
      studentIds: apps.filter((p) => workflow.canTakePostAssessment(p, opp)).map((p) => p.student_id),
      opportunityId: opp.id,
      opportunityTitle: (await repo.findById(opp.id))?.title,
    });
  }

  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_ASSESSMENT_PUBLISHED',
    entityType: 'field_training_assessment',
    entityId: assessmentId,
  });

  return { ok: true };
}

async function listStudentAssessments(opportunityId, studentId) {
  const opp = await repo.findPublishedById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  const app = await repo.findApplicationByOpportunityAndStudent(opportunityId, studentId);
  if (!app || app.status !== 'approved' || workflow.isExpelled(app)) {
    throw new ApiError(403, 'غير مصرح');
  }

  const rows = await repo.findAssessmentsByOpportunity(opportunityId);
  const visible = rows.filter((a) => a.status === 'published');
  const attempts = await prisma.field_training_assessment_attempts.findMany({
    where: { application_id: app.id, assessment_id: { in: visible.map((v) => v.id) } },
  });
  const attemptByAssessment = Object.fromEntries(attempts.map((x) => [x.assessment_id, x]));

  return {
    assessments: visible.map((a) => ({
      id: a.id,
      type: a.type,
      title: a.title,
      status: a.status,
      attempt: attemptByAssessment[a.id]
        ? {
            score: attemptByAssessment[a.id].score != null ? Number(attemptByAssessment[a.id].score) : null,
            level: attemptByAssessment[a.id].level,
            submitted_at: attemptByAssessment[a.id].submitted_at,
          }
        : null,
      can_take:
        a.type === 'pre'
          ? workflow.canTakePreAssessment(app, opp)
          : workflow.canTakePostAssessment(app, opp),
    })),
  };
}

async function submitAssessmentById(assessmentId, answers, studentId) {
  const assessment = await repo.findAssessmentById(assessmentId);
  if (!assessment) throw new ApiError(404, 'Assessment not found');
  return submitAssessment(assessment.opportunity_id, assessment.type, answers, studentId);
}

async function downloadCompletionLetter(applicationId, studentId) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  if (app.student_id !== studentId) throw new ApiError(403, 'Forbidden');
  if (workflow.isExpelled(app)) throw new ApiError(403, 'Forbidden');

  const letter = await repo.findCompletionLetterByApplicationForStudent(applicationId, studentId);
  if (!letter?.pdf_url) throw new ApiError(404, 'Completion letter not found');

  const absPath = repo.resolveSubmissionAbsolutePath(letter.pdf_url);
  if (!repo.submissionFileExists(letter.pdf_url)) {
    throw new ApiError(404, 'File not found');
  }

  return {
    absPath,
    fileName: `${letter.letter_no}.pdf`,
    mimeType: 'application/pdf',
  };
}

module.exports = {
  startTraining,
  listSessions,
  createSession,
  updateSession,
  deleteSession,
  saveSessionAttendance,
  getSessionParticipants,
  getSessionAttendance,
  upsertAssessment,
  publishAssessment,
  listOpportunityAssessments,
  createOpportunityAssessment,
  updateAssessmentById,
  publishAssessmentById,
  getStudentAssessment,
  listStudentAssessments,
  submitAssessment,
  submitAssessmentById,
  getApplicationProgress,
  getStudentOpportunityProgress,
  expelParticipant,
  runTaskAiSelfEvaluate,
  issueCompletionLetter,
  downloadCompletionLetter,
  listInstructors,
};
