'use strict';

/**
 * Canonical Evidence Portfolio aggregator — one service for student UI, admin UI, PDF.
 * Logbook/Portfolio never contribute to Field Training score.
 */

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const repo = require('./fieldTraining.repository');
const ftAccess = require('./fieldTraining.access');
const supervisorScope = require('./fieldTraining.supervisorScope');
const hoursMod = require('./fieldTraining.hours');
const lectureRepo = require('./fieldTraining.recordedLectures.repository');
const { mapStudentProgress, emptyStudentProgress } = require('./fieldTraining.recordedLectures.watch.service');
const officialMod = require('./fieldTraining.officialResult.service');
const { LOGBOOK_STATUS } = require('./fieldTraining.logbook.workflow');

const PORTFOLIO_SOURCE = Object.freeze({
  TASK: 'TASK',
  LOGBOOK: 'LOGBOOK',
  RECORDED_LECTURE: 'RECORDED_LECTURE',
  ASSESSMENT: 'ASSESSMENT',
  ATTENDANCE: 'ATTENDANCE',
  EVALUATION: 'EVALUATION',
  COMPLETION_LETTER: 'COMPLETION_LETTER',
  CERTIFICATE: 'CERTIFICATE',
  STUDENT_UPLOAD: 'STUDENT_UPLOAD',
});

async function assertPortfolioAccess(applicationId, user) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  if (!opp) throw new ApiError(404, 'Opportunity not found');

  const roles = (user.roles || []).map((r) => String(r).toLowerCase());
  const isStudentSelf =
    roles.includes('student') && String(user.userId) === String(app.student_id);
  if (isStudentSelf) {
    return { app, opp };
  }
  await ftAccess.assertManageOpportunityAccess(user, opp);
  await supervisorScope.assertReviewerCanAccessApplication(user, app);
  await ftAccess.assertApplicationStudentAccess(user, app.student_id);
  return { app, opp };
}

function splitSkills(text) {
  if (!text) return [];
  return String(text)
    .split(/[,،\n;/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function getStudentEvidencePortfolio(applicationId, user) {
  const { app, opp } = await assertPortfolioAccess(applicationId, user);
  const studentId = app.student_id;

  const [
    profileRows,
    hours,
    tasks,
    submissions,
    submissionFiles,
    lectures,
    lectureProgress,
    logbookApproved,
    logbookAll,
    assessments,
    attempts,
    letter,
    ratings,
    studentUploads,
    requiredSessions,
    attendedCount,
  ] = await Promise.all([
    repo.findStudentProfilesByIds([studentId]),
    hoursMod.calculateHoursProgressForApplication(app.id, opp.required_training_hours),
    prisma.field_training_tasks.findMany({
      where: { opportunity_id: opp.id },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        title: true,
        is_required: true,
        due_date: true,
        description: true,
      },
    }),
    prisma.field_training_task_submissions.findMany({
      where: { application_id: app.id },
      select: {
        id: true,
        task_id: true,
        file_name: true,
        file_path: true,
        project_url: true,
        submitted_at: true,
        review_status: true,
        manual_score: true,
      },
    }),
    prisma.field_training_task_submission_files.findMany({
      where: {
        field_training_task_submissions: { application_id: app.id },
      },
      select: {
        id: true,
        submission_id: true,
        original_name: true,
        mime_type: true,
        size_bytes: true,
      },
    }),
    lectureRepo.listByOpportunity(opp.id, { status: 'published' }),
    prisma.field_training_recorded_lecture_progress.findMany({
      where: { application_id: app.id },
    }),
    prisma.field_training_logbook_entries.findMany({
      where: {
        application_id: app.id,
        status: LOGBOOK_STATUS.APPROVED,
        deleted_at: null,
      },
      include: { field_training_logbook_attachments: true },
      orderBy: { entry_date: 'desc' },
    }),
    prisma.field_training_logbook_entries.groupBy({
      by: ['status'],
      where: { application_id: app.id, deleted_at: null },
      _count: { _all: true },
    }),
    prisma.field_training_assessments.findMany({
      where: { opportunity_id: opp.id },
      select: { id: true, type: true, title: true, status: true },
    }),
    prisma.field_training_assessment_attempts.findMany({
      where: { application_id: app.id },
      select: {
        assessment_id: true,
        score: true,
        submitted_at: true,
        level: true,
      },
    }),
    prisma.field_training_completion_letters.findFirst({
      where: { application_id: app.id, status: 'issued' },
      orderBy: { issued_at: 'desc' },
    }),
    prisma.field_training_supervisor_ratings.findMany({
      where: { application_id: app.id },
      orderBy: { rated_at: 'desc' },
      take: 5,
    }),
    prisma.field_training_portfolio_uploads.findMany({
      where: { application_id: app.id, deleted_at: null },
      orderBy: { created_at: 'desc' },
    }),
    prisma.field_training_sessions.count({
      where: { opportunity_id: opp.id, is_required: true },
    }),
    prisma.field_training_sessions
      .findMany({
        where: { opportunity_id: opp.id, is_required: true },
        select: { id: true },
      })
      .then(async (sessions) => {
        const ids = sessions.map((s) => s.id);
        if (!ids.length) return 0;
        return prisma.field_training_attendance.count({
          where: {
            application_id: app.id,
            session_id: { in: ids },
            status: { in: ['present', 'late', 'excused'] },
          },
        });
      }),
  ]);

  const official = await officialMod.resolveFieldTrainingApprovedResult(app.id, {
    application: app,
    opportunity: opp,
  });
  const qualification = officialMod.toPublicQualificationFromOfficial(official);
  const profile = profileRows[0] || {};

  const subByTask = new Map(submissions.map((s) => [s.task_id, s]));
  const filesBySubmission = new Map();
  for (const f of submissionFiles) {
    if (!filesBySubmission.has(f.submission_id)) filesBySubmission.set(f.submission_id, []);
    filesBySubmission.get(f.submission_id).push(f);
  }

  const taskItems = tasks.map((task) => {
    const sub = subByTask.get(task.id);
    const files = sub ? filesBySubmission.get(sub.id) || [] : [];
    return {
      source: PORTFOLIO_SOURCE.TASK,
      id: task.id,
      title: task.title,
      required: task.is_required,
      submitted: Boolean(sub),
      review_status: sub?.review_status || null,
      submitted_at: sub?.submitted_at || null,
      files: files.map((f) => ({
        id: f.id,
        name: f.original_name,
        mime_type: f.mime_type,
        size_bytes: f.size_bytes,
      })),
      legacy_file_name: sub?.file_name || null,
      project_url: sub?.project_url || null,
      verification: sub?.review_status === 'accepted' ? 'APPROVED' : sub ? 'STUDENT-SUBMITTED' : null,
    };
  });

  const progressByLecture = new Map(lectureProgress.map((p) => [p.lecture_id, p]));
  const lectureItems = (lectures || []).map((lecture) => {
    const row = progressByLecture.get(lecture.id);
    const mapped = row
      ? mapStudentProgress(row, { durationSeconds: lecture.duration_seconds })
      : emptyStudentProgress();
    return {
      source: PORTFOLIO_SOURCE.RECORDED_LECTURE,
      id: lecture.id,
      title: lecture.title,
      progress_percent: Number(mapped.progressPercentage || 0),
      completed_at: mapped.completedAt || null,
      verification: mapped.completedAt ? 'APPROVED' : 'STUDENT-SUBMITTED',
    };
  });

  const logbookItems = logbookApproved.map((e) => ({
    source: PORTFOLIO_SOURCE.LOGBOOK,
    id: e.id,
    entry_date: e.entry_date,
    activity: e.activity,
    learning_outcome: e.learning_outcome,
    skills: e.skills,
    reported_hours: e.reported_hours != null ? Number(e.reported_hours) : null,
    verification: 'APPROVED',
    attachments: (e.field_training_logbook_attachments || []).map((a) => ({
      id: a.id,
      name: a.original_name,
      mime_type: a.mime_type,
    })),
  }));

  const attemptByAssessment = new Map(attempts.map((a) => [a.assessment_id, a]));
  const assessmentItems = assessments.map((a) => {
    const attempt = attemptByAssessment.get(a.id);
    return {
      source: PORTFOLIO_SOURCE.ASSESSMENT,
      id: a.id,
      type: a.type,
      title: a.title,
      completed: Boolean(attempt?.submitted_at) || (a.type === 'pre' && app.pre_assessment_score != null) || (a.type === 'post' && app.post_assessment_score != null),
      score:
        a.type === 'pre'
          ? app.pre_assessment_score != null
            ? Number(app.pre_assessment_score)
            : null
          : a.type === 'post'
            ? app.post_assessment_score != null
              ? Number(app.post_assessment_score)
              : null
            : attempt?.score != null
              ? Number(attempt.score)
              : null,
      scored_in_total: a.type === 'post',
      verification: 'APPROVED',
    };
  });

  const skills = [
    ...new Set(logbookApproved.flatMap((e) => splitSkills(e.skills))),
  ];

  const logbookCounts = Object.fromEntries(
    logbookAll.map((r) => [r.status, r._count._all])
  );

  const studentUploadItems = studentUploads.map((u) => ({
    source: PORTFOLIO_SOURCE.STUDENT_UPLOAD,
    id: u.id,
    title: u.title,
    description: u.description,
    original_name: u.original_name,
    external_url: u.external_url,
    verification: 'STUDENT-SUBMITTED',
    label_ar: 'أدلة أضافها الطالب',
  }));

  const sections = [
    {
      key: 'overview',
      title_ar: 'نظرة عامة على التدريب',
      items: [
        {
          source: 'OVERVIEW',
          opportunity_title: opp.title,
          organization_name: opp.organization_name,
          start_date: opp.start_date,
          end_date: opp.end_date,
          student_name: profile.full_name,
          student_number: profile.university_student_number,
        },
      ],
    },
    {
      key: 'progress',
      title_ar: 'ملخص التقدم',
      items: [
        {
          source: 'PROGRESS',
          final_score: qualification?.finalScore ?? null,
          passing_score: qualification?.passingScore ?? null,
          score_components: qualification?.scoreComponents || null,
          eligibility_status: qualification?.eligibilityStatus || app.completion_eligibility_status,
          training_status: app.training_status,
          note_ar: 'الدرجة المعتمدة لا تتضمن سجل التدريب أو ملف الإنجاز.',
        },
      ],
    },
    {
      key: 'skills',
      title_ar: 'المهارات والتعلم',
      items: skills.length ? skills.map((s) => ({ source: PORTFOLIO_SOURCE.LOGBOOK, skill: s })) : [],
    },
    {
      key: 'logbook',
      title_ar: 'سجل التدريب (المعتمد)',
      items: logbookItems,
      meta: {
        approved: logbookCounts.APPROVED || 0,
        pending: logbookCounts.SUBMITTED || 0,
        draft: logbookCounts.DRAFT || 0,
        revision: logbookCounts.REVISION_REQUESTED || 0,
      },
    },
    {
      key: 'tasks',
      title_ar: 'المهام والمشاريع',
      items: taskItems,
    },
    {
      key: 'recorded_lectures',
      title_ar: 'المحاضرات المسجلة',
      items: lectureItems,
    },
    {
      key: 'assessments',
      title_ar: 'التقييمات',
      items: assessmentItems,
    },
    {
      key: 'attendance_hours',
      title_ar: 'الحضور والساعات',
      items: [
        {
          source: PORTFOLIO_SOURCE.ATTENDANCE,
          attendance_percentage:
            app.attendance_percentage != null ? Number(app.attendance_percentage) : null,
          required_sessions: requiredSessions,
          attended_sessions: attendedCount,
          hours_completed: hours?.completed_training_hours ?? null,
          hours_required: hours?.required_training_hours ?? null,
          hours_unit: 'hours',
          hours_not_scored: true,
        },
      ],
    },
    {
      key: 'evaluations',
      title_ar: 'التقييمات الإشرافية',
      items: ratings.map((r) => ({
        source: PORTFOLIO_SOURCE.EVALUATION,
        id: r.id,
        rated_at: r.rated_at,
        verification: 'APPROVED',
      })),
    },
    {
      key: 'completion',
      title_ar: 'وثائق الإكمال',
      items: letter
        ? [
            {
              source: PORTFOLIO_SOURCE.COMPLETION_LETTER,
              id: letter.id,
              letter_no: letter.letter_no,
              issued_at: letter.issued_at,
              verification: 'APPROVED',
            },
          ]
        : [],
    },
    {
      key: 'student_uploads',
      title_ar: 'أدلة أضافها الطالب',
      items: studentUploadItems,
    },
  ].filter((s) => s.items.length > 0 || ['overview', 'progress', 'logbook'].includes(s.key));

  const evidenceCount =
    taskItems.filter((t) => t.submitted).length +
    logbookItems.length +
    lectureItems.filter((l) => l.completed_at || l.progress_percent > 0).length +
    assessmentItems.filter((a) => a.completed).length +
    (letter ? 1 : 0) +
    ratings.length +
    studentUploadItems.length;

  return {
    application_id: app.id,
    opportunity_id: opp.id,
    student: {
      id: studentId,
      name: profile.full_name || null,
      number: profile.university_student_number || null,
    },
    opportunity: {
      id: opp.id,
      title: opp.title,
      organization_name: opp.organization_name,
      start_date: opp.start_date,
      end_date: opp.end_date,
    },
    score: {
      final: qualification?.finalScore ?? null,
      passing: qualification?.passingScore ?? null,
      components: qualification?.scoreComponents || null,
      logbook_scored: false,
      portfolio_scored: false,
    },
    summary: {
      sections_with_evidence: sections.filter((s) => s.items.length).length,
      evidence_count: evidenceCount,
      tasks: taskItems.filter((t) => t.submitted).length,
      logbook_approved: logbookItems.length,
      lectures: lectureItems.filter((l) => l.completed_at).length,
      evaluations: ratings.length,
      completion_docs: letter ? 1 : 0,
      student_uploads: studentUploadItems.length,
    },
    skills,
    sections,
    computed_at: new Date().toISOString(),
  };
}

module.exports = {
  PORTFOLIO_SOURCE,
  getStudentEvidencePortfolio,
  assertPortfolioAccess,
};
