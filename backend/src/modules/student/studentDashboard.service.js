'use strict';

const enrollmentsService = require('../enrollments/enrollments.service');
const sessionsService = require('../sessions/sessions.service');
const coursesService = require('../courses/courses.service');
const fieldTrainingService = require('../fieldTraining/fieldTraining.service');
const assessmentsService = require('../assessments/assessments.service');
const submissionsService = require('../submissions/submissions.service');
const gradesService = require('../grades/grades.service');
const certificatesService = require('../certificates/certificates.service');
const notificationsService = require('../notifications/notifications.service');
const workflowService = require('../fieldTraining/fieldTraining.workflowService');

const ACTIVE_FT_STATUSES = new Set(['rejected', 'cancelled']);

function isActiveFieldTrainingApplication(app) {
  if (!app) return false;
  if (ACTIVE_FT_STATUSES.has(String(app.status))) return false;
  if (app.training_status === 'expelled') return false;
  return true;
}

function compactAssessment(a) {
  return {
    id: a.id,
    title: a.title,
    assessment_type: a.assessment_type,
    due_date: a.due_date,
    status: a.status,
    max_score: a.max_score ?? null,
    cohort: a.cohort ? { id: a.cohort.id, title: a.cohort.title } : null,
    micro_credential: a.micro_credential
      ? { id: a.micro_credential.id, title: a.micro_credential.title }
      : null,
  };
}

function compactSubmission(s) {
  return {
    id: s.id,
    assessment_id: s.assessment_id,
    status: s.status,
    submitted_at: s.submitted_at,
  };
}

function compactGrade(g) {
  return {
    id: g.id,
    assessment_id: g.assessment_id,
    score: g.score,
    is_final: g.is_final,
    graded_at: g.graded_at,
    updated_at: g.updated_at,
  };
}

function compactCourse(c) {
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    short_description: c.short_description,
    level: c.level,
    category: c.category,
    cover_image_url: c.cover_image_url,
    estimated_duration_minutes: c.estimated_duration_minutes,
    lessons_count: c.lessons_count,
    completed_lessons_count: c.completed_lessons_count,
    progress_percent: c.progress_percent,
    enrollment_status: c.enrollment_status,
    started_at: c.started_at,
  };
}

function compactSession(s) {
  return {
    id: s.id,
    title: s.title,
    session_date: s.session_date,
    start_time: s.start_time,
    end_time: s.end_time,
    session_type: s.session_type,
    zoom_link: s.zoom_link || null,
    meeting_url: s.meeting_url || null,
    my_attendance_status: s.my_attendance_status ?? null,
    cohort: s.cohort
      ? {
          id: s.cohort.id,
          title: s.cohort.title,
          micro_credential: s.cohort.micro_credential
            ? { id: s.cohort.micro_credential.id, title: s.cohort.micro_credential.title }
            : null,
        }
      : null,
  };
}

async function getStudentDashboardSummary(requester) {
  const studentId = requester.userId;
  const pageQ = { page: 1, page_size: 30, skip: 0, take: 30 };
  const certQ = { page: 1, page_size: 50, skip: 0, take: 50 };
  const notifQ = { page: 1, page_size: 5, skip: 0, take: 5 };

  const [
    enrollmentsPayload,
    sessionsPayload,
    coursesPayload,
    ftAppsPayload,
    assessmentsPayload,
    submissionsPayload,
    gradesPayload,
    certificatesPayload,
    notificationsPayload,
  ] = await Promise.all([
    enrollmentsService.listMine(requester),
    sessionsService.listMine(requester),
    coursesService.listStudentCourses({}, studentId),
    fieldTrainingService.listMyApplications(studentId),
    assessmentsService.listAssessments(pageQ, requester),
    submissionsService.listSubmissions({}, requester),
    gradesService.listGrades({}, requester),
    certificatesService.listCertificates(certQ, requester),
    notificationsService.listNotifications(notifQ, requester),
  ]);

  const enrollments = enrollmentsPayload?.enrollments || [];
  const sessions = (sessionsPayload?.sessions || []).map(compactSession);
  const allCourses = (coursesPayload?.courses || []).map(compactCourse);
  const courses = allCourses.filter((c) => {
    const st = String(c.enrollment_status || '').toLowerCase();
    return st === 'active' || st === 'completed';
  });
  const ftApplications = ftAppsPayload?.applications || [];
  const assessments = (assessmentsPayload?.assessments || []).map(compactAssessment);
  const submissions = (submissionsPayload?.submissions || []).map(compactSubmission);
  const grades = (gradesPayload?.grades || []).map(compactGrade);
  const certificates = certificatesPayload?.certificates || [];
  const notifications = (notificationsPayload?.notifications || []).map((n) => ({
    id: n.id,
    title: n.title,
    type: n.type,
    is_read: n.is_read,
    created_at: n.created_at,
    action_url: n.action_url ?? null,
  }));

  const issuedCount = certificates.filter((c) => String(c.status || '').toLowerCase() === 'issued').length;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const activeFtApps = ftApplications.filter(isActiveFieldTrainingApplication);
  const primaryFtApp = activeFtApps[0] || null;
  let fieldTrainingProgress = null;
  if (primaryFtApp?.opportunity_id) {
    try {
      const progressPayload = await workflowService.getStudentOpportunityProgress(
        primaryFtApp.opportunity_id,
        studentId
      );
      fieldTrainingProgress = progressPayload?.progress || null;
    } catch {
      fieldTrainingProgress = null;
    }
  }

  return {
    enrollments,
    sessions,
    courses,
    fieldTrainingApplications: activeFtApps,
    fieldTrainingProgress,
    assessments,
    submissions,
    grades,
    certificates: { issuedCount },
    notifications: { unreadCount, preview: notifications.slice(0, 5) },
  };
}

module.exports = { getStudentDashboardSummary };
