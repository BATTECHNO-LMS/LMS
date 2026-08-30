'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { getProvider } = require('../../shared/storage/storageProvider');
const { recordAudit } = require('../../utils/auditRecorder');
const access = require('./fieldTrainingEvaluation.access');
const ftAccess = require('./fieldTraining.access');
const repo = require('./fieldTraining.repository');
const labels = require('./fieldTrainingReport.labels');
const names = require('./fieldTraining.supervisorName');
const zipUtil = require('./fieldTrainingEvaluation.zip');
const { resolveOfficialUniversityNumber } = require('./fieldTrainingEvaluation.universityNumber');
const { extractUniversityNumberFromEmail } = require('./universityNumberFromEmail');
const { contentDispositionAttachment } = require('./fieldTraining.completionLetter.filename');

function assertOpportunityReportAccess(user, opp) {
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  access.assertCanViewReports(user, opp.university_id);
  if (access.isInstructor(user) && !access.isUniversityAdmin(user) && !access.isSuperAdmin(user) && !access.isReviewer(user)) {
    if (!ftAccess.isAssignedInstructor(user, opp)) {
      throw new ApiError(403, access.MSG.instructorUnassigned, null, 'FIELD_TRAINING_FORBIDDEN');
    }
  }
}

function evaluationStatusOf(evaluation) {
  if (evaluation?.pdf_file_id) return 'generated';
  if (evaluation?.id) return 'missing_file';
  return 'not_generated';
}

function letterStatusOf(letter, eligibility) {
  if (letter?.status === 'issued' || letter?.pdf_url) return 'issued';
  if (eligibility === 'eligible') return 'pending';
  return 'ineligible';
}

async function loadGroupedStudents(user, opportunityId) {
  const opp = await repo.findById(opportunityId);
  assertOpportunityReportAccess(user, opp);

  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunityId, status: 'approved' },
  });
  const studentIds = [...new Set(apps.map((row) => row.student_id))];
  const appIds = apps.map((row) => row.id);
  const [profiles, evaluations, letters] = await Promise.all([
    repo.findStudentProfilesByIds(studentIds),
    appIds.length
      ? prisma.field_training_final_evaluations.findMany({
          where: { application_id: { in: appIds }, is_current: true },
        })
      : [],
    appIds.length
      ? prisma.field_training_completion_letters.findMany({
          where: { application_id: { in: appIds }, status: 'issued' },
        })
      : [],
  ]);
  const profileById = Object.fromEntries(profiles.map((row) => [row.id, row]));
  const evalByApp = new Map(evaluations.map((row) => [row.application_id, row]));
  const letterByApp = new Map(letters.map((row) => [row.application_id, row]));

  const students = apps.map((app) => {
    const profile = profileById[app.student_id];
    const evaluation = evalByApp.get(app.id) || null;
    const letter = letterByApp.get(app.id) || null;
    const universityNumber =
      resolveOfficialUniversityNumber(profile).number || extractUniversityNumberFromEmail(profile?.email) || '';
    const supervisorName = names.displaySupervisorName(app.academic_supervisor_name);
    return {
      application_id: app.id,
      student_id: app.student_id,
      student_name: profile?.full_name || '',
      university_number: universityNumber,
      university_email: profile?.email || '',
      specialty: repo.formatSpecialtyLabel(profile?.university_specialty || profile?.specialty, ''),
      opportunity_id: opp.id,
      opportunity_title: opp.title,
      academic_supervisor_name: supervisorName || null,
      academic_supervisor_normalized: names.normalizeSupervisorKey(supervisorName),
      eligibility_status: app.completion_eligibility_status,
      eligibility_label: labels.labelOf(labels.ELIGIBILITY_AR, app.completion_eligibility_status, ''),
      evaluation_id: evaluation?.id || null,
      evaluation_status: evaluationStatusOf(evaluation),
      final_status: evaluation?.final_status || null,
      has_pdf: Boolean(evaluation?.pdf_file_id),
      pdf_file_id: evaluation?.pdf_file_id || null,
      report_status: evaluation?.pdf_file_id ? 'generated' : evaluation?.id ? 'missing_file' : 'not_generated',
      completion_letter_status: letterStatusOf(letter, app.completion_eligibility_status),
    };
  });

  return { opp, students };
}

function applyGroupFilters(students, query = {}) {
  const search = String(query.search || query.student_name || '').trim().toLowerCase();
  const supervisorFilter = query.supervisor_normalized != null
    ? String(query.supervisor_normalized)
    : query.supervisor_name != null
      ? names.normalizeSupervisorKey(query.supervisor_name)
      : null;
  const evalFilter = query.evaluation_status || query.report_status || '';

  return students.filter((row) => {
    if (supervisorFilter != null && supervisorFilter !== '') {
      if ((row.academic_supervisor_normalized || '') !== supervisorFilter) return false;
    } else if (supervisorFilter === '') {
      if (row.academic_supervisor_normalized) return false;
    }
    if (evalFilter && row.evaluation_status !== evalFilter && row.report_status !== evalFilter) return false;
    if (search) {
      const hay = [row.student_name, row.university_number, row.university_email].join(' ').toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

async function listSupervisorGroups(user, query = {}) {
  const opportunityId = query.opportunity_id;
  if (!opportunityId) throw new ApiError(400, 'يرجى تحديد فرصة التدريب', null, 'OPPORTUNITY_REQUIRED');
  const { opp, students } = await loadGroupedStudents(user, opportunityId);
  const filtered = applyGroupFilters(students, query);
  const groups = names.groupRowsBySupervisorName(filtered, (row) => row.academic_supervisor_name).map((group) => {
    const completed = group.students.filter((row) => row.has_pdf).length;
    const pending = group.students.length - completed;
    return {
      supervisor_label: group.supervisor_label,
      supervisor_normalized: group.supervisor_normalized,
      unassigned: group.unassigned,
      title: names.supervisorGroupTitle(group.supervisor_label, group.students.length),
      student_count: group.students.length,
      completed_reports: completed,
      pending_reports: pending,
      students: group.students,
    };
  });
  return {
    opportunity: { id: opp.id, title: opp.title },
    totals: {
      students: filtered.length,
      groups: groups.length,
      unassigned: groups.filter((g) => g.unassigned).reduce((sum, g) => sum + g.student_count, 0),
      completed_reports: filtered.filter((row) => row.has_pdf).length,
      pending_reports: filtered.filter((row) => !row.has_pdf).length,
    },
    groups,
  };
}

async function loadPdfBuffer(fileId) {
  const file = await prisma.files.findFirst({ where: { id: fileId, deleted_at: null } });
  if (!file) return null;
  try {
    return await getProvider().getObjectBuffer(file.storage_key);
  } catch {
    return null;
  }
}

async function zipSupervisorReports(user, { opportunity_id: opportunityId, supervisor_normalized }) {
  if (!opportunityId) throw new ApiError(400, 'يرجى تحديد فرصة التدريب', null, 'OPPORTUNITY_REQUIRED');
  const { opp, students } = await loadGroupedStudents(user, opportunityId);
  const key = supervisor_normalized == null ? null : String(supervisor_normalized);
  const scoped = students.filter((row) => {
    if (key == null) return true;
    return (row.academic_supervisor_normalized || '') === key;
  });
  if (key != null && !scoped.length) {
    throw new ApiError(404, 'لا يوجد طلاب تحت هذا المشرف', null, 'SUPERVISOR_GROUP_EMPTY');
  }

  const skipped = [];
  const zipEntries = [];
  for (const student of scoped) {
    if (!student.has_pdf || !student.pdf_file_id) {
      skipped.push({
        application_id: student.application_id,
        student_name: student.student_name,
        university_number: student.university_number,
        reason: student.evaluation_id ? 'missing_file' : 'not_generated',
        reason_label: student.evaluation_id ? 'ملف التقرير غير موجود' : 'لم يُنشأ تقرير التقييم',
      });
      continue;
    }
    const buffer = await loadPdfBuffer(student.pdf_file_id);
    if (!buffer) {
      skipped.push({
        application_id: student.application_id,
        student_name: student.student_name,
        university_number: student.university_number,
        reason: 'failed',
        reason_label: 'تعذّر قراءة ملف التقرير',
      });
      continue;
    }
    const filename = names.buildSupervisorReportPdfFilename({
      studentName: student.student_name,
      universityNumber: student.university_number,
    });
    zipEntries.push({
      studentName: student.student_name,
      universityNumber: student.university_number,
      supervisorFolder: names.sanitizeZipFolder(student.academic_supervisor_name),
      filename,
      buffer,
    });
  }

  if (!zipEntries.length) {
    throw new ApiError(
      409,
      'لا توجد تقارير جاهزة للتنزيل ضمن هذه المجموعة',
      { skipped },
      'SUPERVISOR_REPORTS_MISSING'
    );
  }

  const built = await zipUtil.buildReportsZip(zipEntries, {
    mixedFolders: true,
    folderFor: (entry) => entry.supervisorFolder,
  });
  const single = key != null;
  const label = single
    ? scoped[0]?.academic_supervisor_name || names.UNASSIGNED_SUPERVISOR_LABEL
    : opp.title;
  const filename = single
    ? names.buildSupervisorReportsZipFilename(label)
    : names.buildAllSupervisorReportsZipFilename(opp.title);

  await recordAudit({
    userId: user.userId,
    actionType: single ? 'FT_EVAL_SUPERVISOR_ZIP_DOWNLOADED' : 'FT_EVAL_ALL_SUPERVISOR_ZIP_DOWNLOADED',
    entityType: 'field_training_opportunity',
    entityId: opp.id,
    newValues: {
      included: built.included.length,
      skipped: skipped.length,
      failed: built.failed.length,
      supervisor: single ? label : null,
    },
  });

  return {
    buffer: built.buffer,
    filename,
    contentDisposition: contentDispositionAttachment(filename),
    summary: {
      selected: scoped.length,
      included: built.included.length,
      missing: skipped.filter((row) => row.reason !== 'failed').length,
      failed: skipped.filter((row) => row.reason === 'failed').length + built.failed.length,
      skipped,
      included_students: built.included.map((row) => ({
        student_name: row.studentName,
        university_number: row.universityNumber,
        zip_path: row.zipPath,
      })),
    },
  };
}

module.exports = {
  listSupervisorGroups,
  zipSupervisorReports,
};
