const { prisma } = require('../../config/db');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { env } = require('../../config/env');
const { renderHtmlToPdf } = require('../analytics/pdfRenderer');
const { assertManageOpportunityAccess, assertApplicationStudentAccess } = require('./fieldTraining.access');
const ftNotify = require('./fieldTraining.notifications');
const repo = require('./fieldTraining.repository');
const workflow = require('./fieldTraining.workflow');
const aiService = require('./fieldTraining.ai.service');
const progressBuilder = require('./fieldTraining.progress');
const hoursMod = require('./fieldTraining.hours');
const {
  gradeAnswers,
  prepareQuestionForStorage,
  validateAssessmentQuestions,
} = require('./fieldTraining.assessmentQuestions');
const {
  buildHoursSummary,
  validateCompletedHoursReplacement,
} = require('./fieldTraining.hours');

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
  await assertManageOpportunityAccess(user, opp);
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
    await assertManageOpportunityAccess(user, opp);
  }

  const sessions = await repo.findSessionsByOpportunity(opportunityId, { applicationId });
  return { sessions };
}

async function createSession(opportunityId, body, userId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);

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
  await assertManageOpportunityAccess(user, session.field_training_opportunities);

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

  if (body.start_time != null || body.end_time != null || body.is_required !== undefined) {
    await Promise.all(participants.map((p) => workflow.persistEligibility(p.id)));
  }

  return { session: repo.mapSessionRow(updated) };
}

async function deleteSession(sessionId, user) {
  const session = await repo.findSessionById(sessionId);
  if (!session) throw new ApiError(404, 'Session not found');
  await assertManageOpportunityAccess(user, session.field_training_opportunities);
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
  await assertManageOpportunityAccess(user, opp);

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
          universityId: profiles[0]?.primary_university_id ?? null,
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
  await assertManageOpportunityAccess(user, session.field_training_opportunities);

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
  await assertManageOpportunityAccess(user, opp);

  const status = body.status === 'published' ? 'published' : body.status ?? 'draft';
  if (status === 'published') {
    const validation = validateAssessmentQuestions(body.questions || []);
    if (typeof validation === 'string') {
      throw new ApiError(400, validation);
    }
    if (body.passing_score != null && Number(body.passing_score) > 100) {
      throw new ApiError(400, 'علامة النجاح لا يمكن أن تتجاوز 100.');
    }
  }

  const assessment = await repo.upsertAssessment({
    opportunity_id: opportunityId,
    type,
    title: body.title.trim(),
    description: body.description ?? null,
    passing_score: body.passing_score ?? null,
    status,
    created_by_id: userId,
  });

  if (Array.isArray(body.questions)) {
    const prepared = body.questions.map((q, i) => prepareQuestionForStorage(q, i));
    await repo.replaceAssessmentQuestions(assessment.id, prepared);
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
  await assertManageOpportunityAccess(user, opp);

  const assessment = await repo.findAssessmentByOpportunityAndType(opportunityId, type);
  if (!assessment) throw new ApiError(404, 'Assessment not found');

  const questions = assessment.field_training_assessment_questions || [];
  const validation = validateAssessmentQuestions(
    questions.map((q) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      correct_answer: q.correct_answer,
      points: q.points,
      is_required: q.is_required,
    }))
  );
  if (typeof validation === 'string') {
    throw new ApiError(400, validation);
  }
  if (assessment.passing_score != null && Number(assessment.passing_score) > 100) {
    throw new ApiError(400, 'علامة النجاح لا يمكن أن تتجاوز 100.');
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

  const { scorePoints, maxPoints, scorePercent, questionResults } = gradeAnswers(
    assessment.field_training_assessment_questions,
    answers
  );
  const level = workflow.scoreToLevel(scorePercent, 100);
  const now = new Date();

  const attempt = await repo.upsertAssessmentAttempt({
    assessment_id: assessment.id,
    application_id: app.id,
    student_id: studentId,
    answers,
    grading_details: questionResults,
    score: scorePercent,
    max_score: 100,
    level,
    submitted_at: now,
  });

  const appUpdate = {};
  if (type === 'pre') {
    appUpdate.pre_assessment_score = scorePercent;
    appUpdate.pre_assessment_level = level;
    appUpdate.training_status =
      opp.status === 'in_progress' ? 'in_training' : 'pre_assessment_completed';
  } else {
    appUpdate.post_assessment_score = scorePercent;
    appUpdate.training_status = 'post_assessment_completed';
  }

  await repo.updateApplication(app.id, appUpdate);

  if (type === 'post') {
    const eligibility = await workflow.persistEligibility(app.id);
    const oppRow = await repo.findById(opportunityId);
    const [studentProfile] = await repo.findStudentProfilesByIds([studentId]);
    await ftNotify.notifyStaffPostAssessmentCompleted({
      opportunityId,
      opportunityTitle: oppRow?.title,
      universityId: studentProfile?.primary_university_id ?? null,
      instructorId: oppRow?.assigned_instructor_id,
      studentName: studentProfile?.full_name,
    });
    if (eligibility.outcome === 'eligible') {
      await ftNotify.notifyStaffEligibilityReady({
        opportunityId,
        opportunityTitle: oppRow?.title,
        universityId: studentProfile?.primary_university_id ?? null,
        instructorId: oppRow?.assigned_instructor_id,
        studentName: studentProfile?.full_name,
      });
      await ftNotify.notifyStudentEligibilityUpdated({
        studentId,
        opportunityId,
        opportunityTitle: oppRow?.title,
        eligible: true,
      });
    }
  } else {
    const oppRow = await repo.findById(opportunityId);
    const [studentProfile] = await repo.findStudentProfilesByIds([studentId]);
    await ftNotify.notifyStaffPreAssessmentCompleted({
      opportunityId,
      opportunityTitle: oppRow?.title,
      universityId: studentProfile?.primary_university_id ?? null,
      instructorId: oppRow?.assigned_instructor_id,
      studentName: studentProfile?.full_name,
      level,
    });
  }

  return {
    attempt: {
      id: attempt.id,
      score: scorePercent,
      max_score: 100,
      score_points: scorePoints,
      max_points: maxPoints,
      level,
      submitted_at: now,
      grading_details: questionResults,
      has_pending_manual: questionResults.some((r) => r.gradingStatus === 'pending_manual'),
    },
  };
}

async function expelParticipant(applicationId, body, userId, user) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  await assertManageOpportunityAccess(user, opp);
  await assertApplicationStudentAccess(user, app.student_id);

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

async function requestExpulsion(applicationId, body, userId, user) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  await assertManageOpportunityAccess(user, opp);
  await assertApplicationStudentAccess(user, app.student_id);

  if (app.status !== 'approved') {
    throw new ApiError(400, 'يمكن طلب استبعاد المشاركين المعتمدين فقط');
  }
  if (workflow.isExpelled(app)) {
    throw new ApiError(400, 'الطالب مستبعد مسبقًا');
  }

  const reason = body.reason?.trim();
  if (!reason) throw new ApiError(400, 'سبب الاستبعاد مطلوب');

  const [instructor] = await repo.findUsersByIds([userId]);
  const [student] = await repo.findStudentProfilesByIds([app.student_id]);

  const notePrefix = `[طلب استبعاد من المدرب ${new Date().toISOString().slice(0, 10)}] ${reason}`;
  const existingNote = app.admin_note?.trim();
  await repo.updateApplication(applicationId, {
    admin_note: existingNote ? `${existingNote}\n${notePrefix}` : notePrefix,
  });

  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_EXPULSION_REQUESTED',
    entityType: 'field_training_application',
    entityId: applicationId,
    newValues: { reason },
  });

  await ftNotify.notifyAdminsExpulsionRequested({
    opportunityId: opp.id,
    opportunityTitle: opp.title,
    universityId: student?.primary_university_id || opp.university_id,
    studentName: student?.full_name,
    reason,
    instructorName: instructor?.full_name,
    applicationId,
  });

  return {
    application: repo.mapApplicationRow(await repo.findApplicationById(applicationId)),
    message: 'تم إرسال طلب الاستبعاد إلى الإدارة',
  };
}

async function runTaskAiSelfEvaluate(taskId, body, user) {
  const studentId = user.userId;
  const studentDescription = String(body.studentDescription || body.studentInput || '').trim();
  const uploadedFileId = body.uploadedFileId || null;
  const projectUrl = body.projectUrl?.trim() || null;

  const task = await repo.findTaskById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');
  if (!task.requires_ai_self_evaluation) {
    throw new ApiError(400, 'هذه المهمة لا تتطلب تقييمًا ذاتيًا بالذكاء الاصطناعي');
  }
  if (!task.ai_self_evaluation_prompt?.trim()) {
    throw new ApiError(400, 'لم يتم إعداد برومبت التقييم لهذه المهمة', null, 'AI_PROMPT_NOT_CONFIGURED');
  }

  const app = await repo.findApplicationByOpportunityAndStudent(task.opportunity_id, studentId);
  if (!app || app.status !== 'approved' || workflow.isExpelled(app)) {
    throw new ApiError(403, 'غير مصرح');
  }
  if (!workflow.canAccessTrainingContent(app)) {
    throw new ApiError(403, 'التدريب غير نشط بعد');
  }

  if (!uploadedFileId && !projectUrl) {
    throw new ApiError(400, 'أرفق ملفًا أو أدخل رابطًا عامًا للعمل مع الوصف');
  }

  const contentExtract = require('./fieldTraining.contentExtract');
  const urlFetch = require('./fieldTraining.urlFetch');
  const filesService = require('../files/files.service');

  let fileExtraction = { status: 'skipped', text: null, error: null };
  let fileMeta = { fileName: null, mimeType: null, fileId: null };

  if (uploadedFileId) {
    const record = await filesService.getFileByIdForUser(uploadedFileId, user);
    fileMeta = {
      fileName: record.originalName,
      mimeType: record.mimeType,
      fileId: record.id,
    };
    fileExtraction = await contentExtract.extractTextFromStorageKey({
      storageKey: record.storageKey,
      mimeType: record.mimeType,
      fileName: record.originalName,
    });
  }

  let urlExtraction = { status: 'skipped', text: null, error: null };
  if (projectUrl) {
    if (!urlFetch.isValidHttpUrlShape(projectUrl)) {
      throw new ApiError(400, 'الرابط يجب أن يكون عامًا ومتاحًا.', null, 'URL_INVALID');
    }
    urlExtraction = await urlFetch.fetchAndExtractPublicUrl(projectUrl);
  }

  const fileReadable = fileExtraction.status === 'ok' || fileExtraction.status === 'partial';
  const urlReadable = urlExtraction.status === 'ok';
  if (!fileReadable && !urlReadable) {
    const msg =
      urlExtraction.error ||
      fileExtraction.error ||
      'تعذر تحليل المحتوى حاليًا. يرجى المحاولة مرة أخرى.';
    throw new ApiError(400, msg, {
      file_extraction_status: fileExtraction.status,
      url_extraction_status: urlExtraction.status,
    }, 'CONTENT_UNREADABLE');
  }

  if (!aiService.isAiConfigured()) {
    throw new ApiError(
      503,
      'خدمة التحليل بالذكاء الاصطناعي غير مفعلة حاليًا.',
      null,
      'AI_NOT_CONFIGURED'
    );
  }

  const result = await aiService.runSelfEvaluationAi({
    systemPrompt: task.ai_self_evaluation_prompt,
    taskTitle: task.title,
    taskDescription: task.description,
    taskRequirements: task.description,
    studentDescription,
    fileContent: fileExtraction.text,
    fileStatus: fileExtraction.status,
    fileName: fileMeta.fileName,
    urlContent: urlExtraction.text,
    urlStatus: urlExtraction.status,
    projectUrl,
  });

  const extractionErrors = [fileExtraction.error, urlExtraction.error].filter(Boolean).join(' | ') || null;

  return {
    ai_response: result.text,
    ai_model_provider: result.provider,
    ai_model_name: result.model,
    ai_prompt_used: result.promptUsed || task.ai_self_evaluation_prompt,
    evaluated_at: new Date().toISOString(),
    student_description: studentDescription,
    project_url: projectUrl,
    analysis_file_id: fileMeta.fileId,
    analysis_file_name: fileMeta.fileName,
    analysis_file_mime_type: fileMeta.mimeType,
    file_extraction_status: fileExtraction.status,
    file_extracted_text: fileExtraction.text,
    url_extraction_status: urlExtraction.status,
    url_extracted_text: urlExtraction.text,
    extraction_errors: extractionErrors,
    warnings: [
      fileExtraction.status !== 'ok' && fileExtraction.status !== 'skipped'
        ? fileExtraction.error || `ملف: ${fileExtraction.status}`
        : null,
      urlExtraction.status !== 'ok' && urlExtraction.status !== 'skipped'
        ? urlExtraction.error || `رابط: ${urlExtraction.status}`
        : null,
    ].filter(Boolean),
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
  await assertManageOpportunityAccess(user, opp);
  await assertApplicationStudentAccess(user, app.student_id);

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
  await assertManageOpportunityAccess(user, opp);
  await assertApplicationStudentAccess(user, app.student_id);

  const [sessions, tasks, submissions, attendanceRows, attempts, letter, profiles, assessments] =
    await Promise.all([
    prisma.field_training_sessions.findMany({
      where: { opportunity_id: opp.id },
      orderBy: [{ session_date: 'asc' }, { start_time: 'asc' }],
      select: {
        id: true,
        title: true,
        session_date: true,
        start_time: true,
        end_time: true,
        is_required: true,
      },
    }),
    prisma.field_training_tasks.findMany({
      where: { opportunity_id: opp.id },
      orderBy: { created_at: 'asc' },
      select: { id: true, title: true, due_date: true, is_final_task: true },
    }),
    prisma.field_training_task_submissions.findMany({
      where: { application_id: app.id },
      include: {
        field_training_tasks: { select: { id: true, title: true, is_final_task: true } },
      },
      orderBy: { submitted_at: 'desc' },
    }),
    prisma.field_training_attendance.findMany({
      where: { application_id: app.id },
      select: {
        id: true,
        session_id: true,
        status: true,
        note: true,
        recorded_at: true,
      },
    }),
    prisma.field_training_assessment_attempts.findMany({
      where: { application_id: app.id },
      include: {
        field_training_assessments: { select: { id: true, type: true, title: true } },
      },
    }),
    repo.findCompletionLetterByApplication(app.id),
    repo.findStudentProfilesByIds([app.student_id]),
    prisma.field_training_assessments.findMany({
      where: { opportunity_id: opp.id },
      select: { type: true, status: true },
    }),
  ]);

  const attendanceBySession = Object.fromEntries(attendanceRows.map((r) => [r.session_id, r]));
  const attendanceRecords = sessions.map((session) => {
    const row = attendanceBySession[session.id];
    return {
      session_id: session.id,
      session_title: session.title,
      session_date: session.session_date
        ? new Date(session.session_date).toISOString().slice(0, 10)
        : null,
      is_required: session.is_required !== false,
      status: row?.status ?? null,
      note: row?.note ?? null,
      recorded_at: row?.recorded_at ?? null,
    };
  });

  const attendanceCounts = attendanceRecords.reduce(
    (acc, row) => {
      if (!row.status) return acc;
      if (row.status === 'present') acc.present += 1;
      else if (row.status === 'absent') acc.absent += 1;
      else if (row.status === 'late') acc.late += 1;
      else if (row.status === 'excused') acc.excused += 1;
      return acc;
    },
    { present: 0, absent: 0, late: 0, excused: 0 }
  );

  const submissionByTask = Object.fromEntries(submissions.map((s) => [s.task_id, s]));
  const taskRows = tasks.map((task) => {
    const sub = submissionByTask[task.id];
    const aiText = sub?.ai_response_inserted_text || sub?.ai_raw_response || null;
    return {
      task_id: task.id,
      task_title: task.title,
      is_final_task: Boolean(task.is_final_task),
      due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 10) : null,
      submission_id: sub?.id ?? null,
      review_status: sub?.review_status ?? (sub ? 'pending' : 'not_submitted'),
      submitted_at: sub?.submitted_at ?? null,
      instructor_feedback: sub?.instructor_feedback ?? null,
      ai_summary: aiText ? String(aiText).slice(0, 280) : null,
      student_input: sub?.student_self_evaluation_input ?? null,
      is_late: Boolean(sub?.is_late),
    };
  });

  const pendingReviews = submissions.filter((s) => (s.review_status || 'pending') === 'pending').length;

  const findAttempt = (type) =>
    attempts.find((a) => a.field_training_assessments?.type === type) || null;

  const mapAttempt = (attempt) =>
    attempt
      ? {
          attempt_id: attempt.id,
          assessment_id: attempt.assessment_id,
          score: attempt.score != null ? Number(attempt.score) : null,
          max_score: attempt.max_score != null ? Number(attempt.max_score) : null,
          level: attempt.level ?? null,
          submitted_at: attempt.submitted_at ?? null,
        }
      : null;

  const preAttempt = mapAttempt(findAttempt('pre'));
  const postAttempt = mapAttempt(findAttempt('post'));

  const requiredSessions = sessions.filter((s) => s.is_required !== false);
  const requiredIds = new Set(requiredSessions.map((s) => s.id));
  const sessionsAttended = attendanceRows.filter(
    (r) =>
      requiredIds.has(r.session_id) && ['present', 'late', 'excused'].includes(r.status)
  ).length;

  const progress = progressBuilder.buildParticipantProgress(app, opp, {
    sessionsCount: sessions.length,
    requiredSessionsCount: requiredSessions.length,
    sessionsAttended,
    attendanceRecordsCount: attendanceRows.length,
    tasksCount: tasks.length,
    tasksSubmitted: submissions.length,
    preAssessmentPublished: assessments.some((a) => a.type === 'pre' && a.status === 'published'),
    postAssessmentPublished: assessments.some((a) => a.type === 'post' && a.status === 'published'),
    hoursProgress: await hoursMod.calculateHoursProgressForApplication(
      app.id,
      opp.required_training_hours
    ),
  });

  progress.metrics = {
    ...progress.metrics,
    present_count: attendanceCounts.present,
    absent_count: attendanceCounts.absent,
    late_count: attendanceCounts.late,
    excused_count: attendanceCounts.excused,
    pending_reviews: pendingReviews,
    sessions_attended: attendanceCounts.present + attendanceCounts.late,
  };

  const profile = profiles[0] || null;

  return {
    progress,
    student_name: profile?.full_name ?? null,
    student: {
      id: app.student_id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      university: profile?.university?.name ?? null,
      specialty_label: profile?.university_specialty
        ? repo.formatSpecialtyLabel(profile.university_specialty)
        : repo.formatSpecialtyLabel(profile?.specialty),
    },
    attendance: {
      records: attendanceRecords,
      counts: attendanceCounts,
    },
    tasks: taskRows,
    assessments: {
      pre: preAttempt,
      post: postAttempt,
    },
    completion_letter: letter
      ? {
          id: letter.id,
          letter_no: letter.letter_no,
          issued_at: letter.issued_at ?? app.completion_letter_issued_at,
          has_pdf: Boolean(letter.pdf_url),
        }
      : null,
    hours: buildHoursSummary(app, opp),
  };
}

/**
 * Read authoritative hours summary for an application (instructor/admin manage scope).
 */
async function getApplicationHours(applicationId, user) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  await assertApplicationStudentAccess(user, app.student_id);

  return {
    application_id: app.id,
    opportunity_id: opp.id,
    hours: buildHoursSummary(app, opp),
    application: repo.mapApplicationRow(app),
  };
}

/**
 * Replace total completed hours for an application (Model A).
 * Body: { completed_hours, note?, expected_completed_hours? }
 */
async function updateApplicationHours(applicationId, body, user) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  await assertApplicationStudentAccess(user, app.student_id);

  if (workflow.isExpelled(app)) {
    throw new ApiError(409, 'لا يمكن تحديث ساعات طالب مستبعد', null, 'HOURS_EXPELLED');
  }
  if (app.status !== 'approved') {
    throw new ApiError(
      409,
      'تحديث الساعات متاح للمشاركين المقبولين فقط',
      null,
      'HOURS_APPLICATION_NOT_APPROVED'
    );
  }

  const previous =
    app.completed_training_hours != null ? Number(app.completed_training_hours) : 0;
  if (body.expected_completed_hours !== undefined) {
    const expected =
      body.expected_completed_hours === null || body.expected_completed_hours === ''
        ? 0
        : Number(body.expected_completed_hours);
    const expectedNorm = Number.isNaN(expected) ? 0 : expected;
    if (previous !== expectedNorm) {
      throw new ApiError(
        409,
        'تم تحديث الساعات من مستخدم آخر. حدّث الصفحة وحاول مجدداً.',
        {
          current_completed_hours: previous,
          expected_completed_hours: expectedNorm,
        },
        'HOURS_CONFLICT'
      );
    }
  }

  const validated = validateCompletedHoursReplacement(
    body.completed_hours,
    opp.required_training_hours
  );
  if (!validated.ok) {
    throw new ApiError(validated.status, validated.message, null, validated.code);
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.field_training_applications.update({
      where: { id: applicationId },
      data: {
        completed_training_hours: validated.value,
        hours_updated_at: now,
        hours_updated_by_id: user.userId,
        updated_at: now,
      },
    });
    return row;
  });

  await recordAudit({
    userId: user.userId,
    universityId: user.universityId ?? null,
    actionType: 'field_training.hours.update',
    entityType: 'field_training_application',
    entityId: applicationId,
    oldValues: {
      completed_training_hours: previous,
      opportunity_id: opp.id,
    },
    newValues: {
      completed_training_hours: validated.value,
      difference: previous == null ? validated.value : validated.value - previous,
      note: body.note?.trim() || null,
      required_training_hours:
        opp.required_training_hours != null ? Number(opp.required_training_hours) : null,
    },
  });

  // Eligibility is NOT gated on hours today; still refresh progress metrics for clients.
  const hours = buildHoursSummary(updated, opp);
  return {
    application_id: updated.id,
    opportunity_id: opp.id,
    hours,
    previous_completed_hours: previous,
    application: repo.mapApplicationRow(updated),
  };
}

async function recalculateEligibility(applicationId, user) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  await assertApplicationStudentAccess(user, app.student_id);

  if (workflow.isExpelled(app)) {
    throw new ApiError(400, 'لا يمكن إعادة حساب أهلية طالب مستبعد');
  }
  if (app.status !== 'approved') {
    throw new ApiError(400, 'إعادة حساب الأهلية متاحة للمشاركين المقبولين فقط');
  }

  const result = await workflow.persistEligibility(applicationId);
  const updated = await repo.findApplicationById(applicationId);
  return {
    eligibility: result,
    application: repo.mapApplicationRow(updated),
  };
}

async function gradeAssessmentAttempt(attemptId, body, user) {
  const attempt = await repo.findAssessmentAttemptById(attemptId);
  if (!attempt) throw new ApiError(404, 'Attempt not found');
  const assessment = attempt.field_training_assessments;
  const opp = assessment?.field_training_opportunities;
  if (!assessment || !opp) throw new ApiError(404, 'Assessment not found');
  await assertManageOpportunityAccess(user, opp);

  const app = attempt.field_training_applications;
  if (!app) throw new ApiError(404, 'Application not found');
  await assertApplicationStudentAccess(user, app.student_id);

  const grades = Array.isArray(body?.grades) ? body.grades : [];
  if (!grades.length) throw new ApiError(400, 'أضف درجات الأسئلة المطلوب تصحيحها يدويًا');

  const gradeByQuestion = Object.fromEntries(
    grades.map((g) => [String(g.question_id), Number(g.awarded_points)])
  );
  const questions = assessment.field_training_assessment_questions || [];
  const existingDetails = Array.isArray(attempt.grading_details) ? attempt.grading_details : [];
  const detailByQuestion = Object.fromEntries(
    existingDetails.map((row) => [String(row.questionId), row])
  );

  let scorePoints = 0;
  let maxPoints = 0;
  const questionResults = questions.map((q) => {
    const points = Number(q.points) > 0 ? Number(q.points) : 1;
    maxPoints += points;
    const prev = detailByQuestion[q.id] || {
      questionId: q.id,
      awardedPoints: 0,
      maxPoints: points,
      gradingStatus: 'pending_manual',
    };

    if (Object.prototype.hasOwnProperty.call(gradeByQuestion, q.id)) {
      const awarded = Math.max(0, Math.min(points, Number(gradeByQuestion[q.id]) || 0));
      scorePoints += awarded;
      return {
        questionId: q.id,
        awardedPoints: awarded,
        maxPoints: points,
        gradingStatus: 'manually_graded',
      };
    }

    const awarded = Number(prev.awardedPoints) || 0;
    scorePoints += awarded;
    return {
      questionId: q.id,
      awardedPoints: awarded,
      maxPoints: points,
      gradingStatus: prev.gradingStatus || 'auto_graded',
    };
  });

  if (questionResults.some((r) => r.gradingStatus === 'pending_manual')) {
    throw new ApiError(400, 'ما زالت هناك أسئلة بانتظار التصحيح اليدوي');
  }

  const scorePercent = maxPoints > 0 ? Math.round((scorePoints / maxPoints) * 10000) / 100 : 0;
  const level = workflow.scoreToLevel(scorePercent, 100);

  const updatedAttempt = await repo.updateAssessmentAttempt(attemptId, {
    grading_details: questionResults,
    score: scorePercent,
    max_score: 100,
    level,
  });

  const appUpdate = {};
  if (assessment.type === 'pre') {
    appUpdate.pre_assessment_score = scorePercent;
    appUpdate.pre_assessment_level = level;
  } else if (assessment.type === 'post') {
    appUpdate.post_assessment_score = scorePercent;
  }
  if (Object.keys(appUpdate).length) {
    await repo.updateApplication(app.id, appUpdate);
  }
  if (assessment.type === 'post') {
    await workflow.persistEligibility(app.id);
  }

  return {
    attempt: {
      id: updatedAttempt.id,
      score: scorePercent,
      level,
      grading_details: questionResults,
      has_pending_manual: false,
    },
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

  // Scope strictly to this student's application — never aggregate other students.
  const [
    sessionsCount,
    requiredSessions,
    tasksCount,
    tasksSubmitted,
    attendanceRecordsCount,
    assessments,
  ] = await Promise.all([
    prisma.field_training_sessions.count({ where: { opportunity_id: opp.id } }),
    prisma.field_training_sessions.findMany({
      where: { opportunity_id: opp.id, is_required: true },
      select: { id: true },
    }),
    prisma.field_training_tasks.count({ where: { opportunity_id: opp.id } }),
    prisma.field_training_task_submissions.count({ where: { application_id: app.id } }),
    prisma.field_training_attendance.count({ where: { application_id: app.id } }),
    prisma.field_training_assessments.findMany({
      where: { opportunity_id: opp.id },
      select: { type: true, status: true },
    }),
  ]);

  const requiredSessionIds = requiredSessions.map((s) => s.id);
  const sessionsAttended = requiredSessionIds.length
    ? await prisma.field_training_attendance.count({
        where: {
          application_id: app.id,
          session_id: { in: requiredSessionIds },
          status: { in: ['present', 'late', 'excused'] },
        },
      })
    : 0;

  const preAssessmentPublished = assessments.some(
    (a) => a.type === 'pre' && a.status === 'published'
  );
  const postAssessmentPublished = assessments.some(
    (a) => a.type === 'post' && a.status === 'published'
  );

  const letter = await repo.findCompletionLetterByApplicationForStudent(app.id, studentId);

  const hoursProgress = await hoursMod.calculateHoursProgressForApplication(
    app.id,
    opp.required_training_hours
  );

  return {
    progress: progressBuilder.buildParticipantProgress(app, opp, {
      sessionsCount,
      requiredSessionsCount: requiredSessions.length,
      sessionsAttended,
      attendanceRecordsCount,
      tasksCount,
      tasksSubmitted,
      preAssessmentPublished,
      postAssessmentPublished,
      hoursProgress,
    }),
    hours: hoursProgress,
    completion_letter_id: letter?.id ?? null,
  };
}

async function getSessionAttendance(sessionId, user) {
  return getSessionParticipants(sessionId, user);
}

async function listOpportunityAssessments(opportunityId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  const assessments = await repo.findAssessmentsByOpportunity(opportunityId);
  return { assessments };
}

async function createOpportunityAssessment(opportunityId, body, userId, user) {
  return upsertAssessment(opportunityId, body.type, body, userId, user);
}

async function updateAssessmentById(assessmentId, body, user) {
  const assessment = await repo.findAssessmentById(assessmentId);
  if (!assessment) throw new ApiError(404, 'Assessment not found');
  await assertManageOpportunityAccess(user, assessment.field_training_opportunities);

  if (body.status === 'published' || (body.questions && assessment.status === 'published')) {
    const questions = body.questions?.length
      ? body.questions
      : (assessment.field_training_assessment_questions || []).map((q) => ({
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options,
          correct_answer: q.correct_answer,
          points: q.points,
          is_required: q.is_required,
        }));
    const validation = validateAssessmentQuestions(questions);
    if (typeof validation === 'string') {
      throw new ApiError(400, validation);
    }
  }

  const data = {};
  if (body.title != null) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description;
  if (body.passing_score !== undefined) data.passing_score = body.passing_score;
  if (body.status != null) data.status = body.status;

  if (Object.keys(data).length) {
    await prisma.field_training_assessments.update({ where: { id: assessmentId }, data });
  }
  if (Array.isArray(body.questions)) {
    const prepared = body.questions.map((q, i) => prepareQuestionForStorage(q, i));
    await repo.replaceAssessmentQuestions(assessmentId, prepared);
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
  await assertManageOpportunityAccess(user, assessment.field_training_opportunities);

  const questions = assessment.field_training_assessment_questions || [];
  const validation = validateAssessmentQuestions(
    questions.map((q) => ({
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options,
      correct_answer: q.correct_answer,
      points: q.points,
      is_required: q.is_required,
    }))
  );
  if (typeof validation === 'string') {
    throw new ApiError(400, validation);
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

async function downloadCompletionLetterAsManager(applicationId, user) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  await assertManageOpportunityAccess(user, opp);
  await assertApplicationStudentAccess(user, app.student_id);

  const letter = await repo.findCompletionLetterByApplication(applicationId);
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
  getApplicationHours,
  updateApplicationHours,
  recalculateEligibility,
  gradeAssessmentAttempt,
  getStudentOpportunityProgress,
  expelParticipant,
  requestExpulsion,
  runTaskAiSelfEvaluate,
  issueCompletionLetter,
  downloadCompletionLetter,
  downloadCompletionLetterAsManager,
  listInstructors,
};
