'use strict';

const crypto = require('crypto');
const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { assertManageOpportunityAccess, isSystemWideAdmin } = require('./fieldTraining.access');
const reportAccess = require('./fieldTrainingReport.access');
const repo = require('./fieldTraining.repository');
const { resolveOfficialUniversityNumber } = require('./fieldTrainingEvaluation.universityNumber');
const { extractUniversityNumberFromEmail } = require('./universityNumberFromEmail');
const parse = require('./fieldTraining.supervisorExcel.parse');
const supervisorScope = require('./fieldTraining.supervisorScope');
const labels = require('./fieldTrainingReport.labels');
const names = require('./fieldTraining.supervisorName');

const UNRESOLVED_ACCOUNT = 'unlinked';
const AMBIGUOUS_ACCOUNT = 'ambiguous';
const LINKED_ACCOUNT = 'linked';

function fileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function emailKey(value) {
  return String(value || '').trim().toLowerCase();
}

function namesMatch(a, b) {
  return parse.normalizePersonLabel(a) === parse.normalizePersonLabel(b) && Boolean(parse.normalizePersonLabel(a));
}

function majorityId(ids) {
  const counts = new Map();
  for (const id of ids || []) {
    if (!id) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  let tied = false;
  for (const [id, n] of counts) {
    if (n > bestCount) {
      best = id;
      bestCount = n;
      tied = false;
    } else if (n === bestCount) {
      tied = true;
    }
  }
  return best && !tied ? best : null;
}

function matchUniversityByOpportunityTitle(title, universities) {
  const text = String(title || '');
  if (!text) return null;
  const hits = (universities || []).filter((row) => {
    const names = [row.name, row.name_en, row.short_name].filter(Boolean);
    return names.some((name) => text.includes(name));
  });
  if (hits.length !== 1) return null;
  return { id: hits[0].id, name: hits[0].name };
}

function liveDisplayLabels(application) {
  if (!application) return {};
  return {
    applicationStatus: labels.labelOf(labels.APPLICATION_STATUS_AR, application.status, ''),
    trainingStatus: labels.labelOf(labels.TRAINING_STATUS_AR, application.training_status, ''),
    eligibilityStatus: labels.labelOf(labels.ELIGIBILITY_AR, application.completion_eligibility_status, ''),
  };
}

async function resolveOpportunityUniversity(opportunity) {
  if (opportunity?.university_id) {
    const linked = await prisma.universities.findUnique({
      where: { id: opportunity.university_id },
      select: { id: true, name: true },
    });
    if (linked) return linked;
  }

  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunity.id },
    select: { student_id: true },
  });
  const studentIds = [...new Set(apps.map((row) => row.student_id))];
  if (studentIds.length) {
    const students = await prisma.users.findMany({
      where: { id: { in: studentIds } },
      select: { primary_university_id: true, email: true },
    });
    const fromStudents = majorityId(students.map((row) => row.primary_university_id));
    if (fromStudents) {
      const row = await prisma.universities.findUnique({
        where: { id: fromStudents },
        select: { id: true, name: true },
      });
      if (row) return row;
    }

    const domains = [
      ...new Set(
        students
          .map((row) => String(row.email || '').split('@')[1]?.trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
    if (domains.length) {
      const domainRows = await prisma.university_email_domains.findMany({
        where: { domain: { in: domains }, is_active: true },
        select: { university_id: true },
      });
      const fromDomain = majorityId(domainRows.map((row) => row.university_id));
      if (fromDomain) {
        const row = await prisma.universities.findUnique({
          where: { id: fromDomain },
          select: { id: true, name: true },
        });
        if (row) return row;
      }
    }
  }

  const universities = await prisma.universities.findMany({
    select: { id: true, name: true, name_en: true, short_name: true },
  });
  return matchUniversityByOpportunityTitle(opportunity?.title, universities);
}

async function requireOpportunityUniversity(opportunity) {
  const university = await resolveOpportunityUniversity(opportunity);
  if (!university?.id) {
    throw new ApiError(
      400,
      'فرصة التدريب غير مرتبطة بجامعة. اربط الجامعة أولاً ثم أعد رفع الملف',
      null,
      'OPPORTUNITY_UNIVERSITY_REQUIRED'
    );
  }
  return university;
}

async function loadUniversityReviewers(universityId) {
  const reviewerRole = await prisma.roles.findFirst({ where: { code: 'reviewer' } });
  if (!reviewerRole) return [];
  const links = await prisma.user_roles.findMany({
    where: { role_id: reviewerRole.id },
    select: { user_id: true },
  });
  const ids = [...new Set(links.map((row) => row.user_id))];
  if (!ids.length) return [];
  const assigned = await prisma.reviewer_university_assignments.findMany({
    where: { university_id: universityId, is_active: true, reviewer_user_id: { in: ids } },
    select: { reviewer_user_id: true },
  });
  const assignedIds = new Set(assigned.map((row) => row.reviewer_user_id));
  return prisma.users.findMany({
    where: {
      id: { in: ids },
      status: 'active',
      OR: [{ primary_university_id: universityId }, { id: { in: [...assignedIds] } }],
    },
    select: { id: true, full_name: true, email: true, primary_university_id: true },
    orderBy: { full_name: 'asc' },
  });
}

function resolveSupervisorAccount({ group, reviewers, mappings, resolutions = {} }) {
  const normalized = group.supervisorNormalized;
  if (resolutions[normalized]) {
    const chosen = reviewers.find((row) => row.id === resolutions[normalized]);
    if (chosen) {
      return { status: LINKED_ACCOUNT, account: chosen, reason: 'manual' };
    }
  }

  const mapping = mappings.get(normalized);
  if (mapping) {
    const mapped = reviewers.find((row) => row.id === mapping.supervisor_user_id);
    if (mapped) return { status: LINKED_ACCOUNT, account: mapped, reason: 'saved_mapping' };
  }

  const idHint = String(group.supervisorId || group.rows.find((r) => r.supervisorId)?.supervisorId || '').trim();
  if (idHint) {
    const byId = reviewers.filter((row) => String(row.id) === idHint);
    if (byId.length === 1) return { status: LINKED_ACCOUNT, account: byId[0], reason: 'supervisor_id' };
    if (byId.length > 1) return { status: AMBIGUOUS_ACCOUNT, account: null, matches: byId };
  }

  const emailHint = emailKey(group.supervisorEmail || group.rows.find((r) => r.supervisorEmail)?.supervisorEmail);
  if (emailHint) {
    const byEmail = reviewers.filter((row) => emailKey(row.email) === emailHint);
    if (byEmail.length === 1) return { status: LINKED_ACCOUNT, account: byEmail[0], reason: 'supervisor_email' };
    if (byEmail.length > 1) return { status: AMBIGUOUS_ACCOUNT, account: null, matches: byEmail };
  }

  const nameMatches = reviewers.filter((row) => namesMatch(row.full_name, group.supervisorLabel));
  if (nameMatches.length === 1) return { status: LINKED_ACCOUNT, account: nameMatches[0], reason: 'exact_name' };
  if (nameMatches.length > 1) return { status: AMBIGUOUS_ACCOUNT, account: null, matches: nameMatches };
  return { status: UNRESOLVED_ACCOUNT, account: null, matches: [] };
}

async function loadEnrollmentIndex(opportunity, university) {
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunity.id },
  });
  const profiles = await repo.findStudentProfilesByIds([...new Set(apps.map((a) => a.student_id))]);
  const profileById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const assignments = await supervisorScope.loadAssignmentsByApplicationIds(apps.map((a) => a.id));
  const byNumber = new Map();
  const byEmail = new Map();
  const records = apps.map((app) => {
    const profile = profileById[app.student_id];
    const number = resolveOfficialUniversityNumber(profile).number || extractUniversityNumberFromEmail(profile?.email);
    const assignment = assignments.get(app.id) || null;
    const storedName = names.displaySupervisorName(app.academic_supervisor_name || assignment?.supervisor_name);
    const record = {
      application: app,
      profile,
      universityNumber: number,
      email: emailKey(profile?.email),
      assignment: {
        supervisor_name: storedName || null,
        supervisor_normalized: app.academic_supervisor_normalized || assignment?.supervisor_normalized || names.normalizeSupervisorKey(storedName),
        supervisor_user_id: null,
      },
      universityName: profile?.university?.name || university?.name || '',
    };
    if (number) byNumber.set(String(number), record);
    if (record.email) byEmail.set(record.email, record);
    return record;
  });
  return { records, byNumber, byEmail };
}

function matchExcelRow(row, index, { opportunity, university, expectedUniversity, expectedOpportunity }) {
  const errors = [...(row.errors || [])];
  if (row.universityNormalized && expectedUniversity && row.universityNormalized !== expectedUniversity) {
    errors.push({ code: 'cross_university', label: 'الصف لا ينتمي إلى الجامعة الحالية' });
  }
  if (row.opportunityNormalized && expectedOpportunity && row.opportunityNormalized !== expectedOpportunity) {
    errors.push({ code: 'cross_opportunity', label: 'الصف لا ينتمي إلى فرصة التدريب الحالية' });
  }

  let match = null;
  if (row.universityNumber) match = index.byNumber.get(String(row.universityNumber));
  if (!match && row.universityEmail) match = index.byEmail.get(emailKey(row.universityEmail));

  if (!match) {
    errors.push({ code: 'student_not_found', label: 'الطالب غير موجود في هذه الفرصة' });
    return { ...row, errors, match: null };
  }

  if (row.universityEmail && match.email && emailKey(row.universityEmail) !== match.email) {
    errors.push({ code: 'email_mismatch', label: 'البريد الجامعي لا يطابق سجل الطالب' });
  }
  if (
    match.profile?.primary_university_id &&
    university?.id &&
    String(match.profile.primary_university_id) !== String(university.id)
  ) {
    errors.push({ code: 'cross_university', label: 'الطالب ينتمي إلى جامعة أخرى' });
  }
  if (String(match.application.opportunity_id) !== String(opportunity.id)) {
    errors.push({ code: 'cross_opportunity', label: 'الطالب ينتمي إلى فرصة أخرى' });
  }

  return { ...row, errors, match, ...liveDisplayLabels(match.application) };
}

function previewPayload({ summary, groups, opportunity, university, batch }) {
  const invalidStudents = summary.rows.filter((row) => row.errors?.length);
  const warningStudents = summary.rows.filter((row) => row.warnings?.length);
  const canApply =
    invalidStudents.length === 0 &&
    summary.duplicateUniversityNumbers === 0 &&
    summary.conflictingAssignments === 0;

  return {
    batch_id: batch.id,
    filename: batch.original_filename,
    file_size: batch.file_size,
    opportunity: { id: opportunity.id, title: opportunity.title },
    university: university ? { id: university.id, name: university.name } : null,
    totals: {
      excel_rows: summary.totalRows,
      valid_students: summary.validRows,
      invalid_students: summary.invalidRows,
      duplicate_rows: summary.duplicateUniversityNumbers,
      conflicting_assignments: summary.conflictingAssignments,
      distinct_supervisors: summary.distinctSupervisors,
      missing_supervisors: summary.missingSupervisors || warningStudents.length,
      linked_supervisors: groups.filter((g) => g.supervisorNormalized).length,
      unresolved_supervisors: 0,
    },
    can_apply: canApply,
    reassignment_count: summary.rows.filter((row) => row.reassignment).length,
    warnings: warningStudents.length
      ? ['يوجد طلاب بلا اسم مشرف أكاديمي وسيظهرون تحت مجموعة مشرف غير محدد']
      : [],
    groups: groups.map((group) => ({
      supervisor_label: group.supervisorLabel || names.UNASSIGNED_SUPERVISOR_LABEL,
      supervisor_normalized: group.supervisorNormalized || '',
      unassigned: Boolean(group.unassigned || !group.supervisorNormalized),
      title: names.supervisorGroupTitle(group.supervisorLabel, group.rows.length),
      student_count: group.rows.length,
      resolution_status: 'named',
      resolution_label: group.supervisorNormalized ? 'اسم محفوظ من Excel' : names.UNASSIGNED_SUPERVISOR_LABEL,
      account: null,
      matches: [],
      students: group.rows.map((row) => ({
        excel_row: row.excelRow,
        student_name: row.studentName,
        university_number: row.universityNumber,
        university_email: row.universityEmail,
        specialty: row.specialty,
        opportunity: row.opportunity,
        current_supervisor_name: row.match?.assignment?.supervisor_name || null,
        current_supervisor_id: null,
        proposed_supervisor_name: group.supervisorLabel || names.UNASSIGNED_SUPERVISOR_LABEL,
        proposed_supervisor_id: null,
        reassignment: Boolean(row.reassignment),
        status: row.errors?.length ? 'error' : 'valid',
        errors: row.errors || [],
        warnings: row.warnings || [],
        application_id: row.match?.application?.id || null,
        display_application_status: row.applicationStatus,
        display_training_status: row.trainingStatus,
        display_eligibility_status: row.eligibilityStatus,
        display_final_result: row.finalResult,
      })),
    })),
  };
}

async function previewImport(opportunityId, user, file) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  if (!reportAccess.isUniversityAdmin(user) && !isSystemWideAdmin(user)) {
    throw new ApiError(403, 'إسناد المشرفين الأكاديميين متاح للمدير فقط');
  }
  if (!parse.isXlsxUpload(file)) {
    throw new ApiError(400, 'يُقبل ملف Excel بصيغة .xlsx فقط', null, 'INVALID_EXCEL_TYPE');
  }
  if (!file.buffer || file.size > parse.MAX_EXCEL_BYTES) {
    throw new ApiError(400, 'حجم ملف Excel يتجاوز الحد المسموح', null, 'EXCEL_TOO_LARGE');
  }

  const parsed = await parse.parseSupervisorAssignmentWorkbook(file.buffer);
  if (parsed.error === 'missing_sheet' || parsed.error === 'missing_headers') {
    throw new ApiError(400, 'ملف Excel لا يطابق النموذج المعتمد', parsed, 'INVALID_EXCEL_TEMPLATE');
  }

  const university = await requireOpportunityUniversity(opp);
  const expectedUniversity = parse.normalizeScopeLabel(university?.name);
  const expectedOpportunity = parse.normalizeScopeLabel(opp.title);
  const index = await loadEnrollmentIndex(opp, university);
  const matchedRows = parsed.rows.map((row) =>
    matchExcelRow(row, index, {
      opportunity: opp,
      university,
      expectedUniversity,
      expectedOpportunity,
    })
  );
  parse.detectRowIssues(matchedRows);
  const summary = parse.summarizeParse(matchedRows);
  const groups = parse.groupRowsBySupervisor(matchedRows).map((group) => {
    const rows = group.rows.map((row) => {
      const currentName = row.match?.assignment?.supervisor_name || '';
      const proposedName = group.supervisorLabel || '';
      const currentKey = names.normalizeSupervisorKey(currentName);
      const proposedKey = names.normalizeSupervisorKey(proposedName);
      return {
        ...row,
        reassignment: Boolean(currentKey && proposedKey && currentKey !== proposedKey),
      };
    });
    return { ...group, rows };
  });
  summary.rows = groups.flatMap((g) => g.rows);
  summary.validRows = summary.rows.filter((row) => !row.errors?.length).length;
  summary.invalidRows = summary.rows.filter((row) => row.errors?.length).length;

  const payload = previewPayload({
    summary: { ...summary, rows: summary.rows },
    groups,
    opportunity: opp,
    university,
    batch: { id: 'pending', original_filename: file.originalname, file_size: file.size || file.buffer.length },
  });

  const batch = await prisma.field_training_supervisor_import_batches.create({
    data: {
      university_id: university.id,
      opportunity_id: opp.id,
      original_filename: file.originalname || 'assignment.xlsx',
      file_hash: fileHash(file.buffer),
      file_size: file.size || file.buffer.length,
      uploaded_by_id: user.userId,
      status: 'previewed',
      preview_json: payload,
    },
  });
  payload.batch_id = batch.id;
  payload.filename = batch.original_filename;
  payload.file_size = batch.file_size;
  await prisma.field_training_supervisor_import_batches.update({
    where: { id: batch.id },
    data: { preview_json: payload, updated_at: new Date() },
  });
  return payload;
}

async function applyResolutions(opportunityId, user, { batch_id }) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  const batch = await prisma.field_training_supervisor_import_batches.findFirst({
    where: { id: batch_id, opportunity_id: opportunityId },
  });
  if (!batch?.preview_json?.groups) throw new ApiError(404, 'دفعة الاستيراد غير موجودة');
  return batch.preview_json;
}

async function applyImport(opportunityId, user, body) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  if (!reportAccess.isUniversityAdmin(user) && !isSystemWideAdmin(user)) {
    throw new ApiError(403, 'إسناد المشرفين الأكاديميين متاح للمدير فقط');
  }

  const batch = await prisma.field_training_supervisor_import_batches.findFirst({
    where: { id: body.batch_id, opportunity_id: opportunityId },
  });
  if (!batch) throw new ApiError(404, 'دفعة الاستيراد غير موجودة');
  if (batch.status === 'applied') {
    return { batch_id: batch.id, created: 0, updated: 0, unchanged: 0, idempotent: true };
  }

  const previewData = body.preview || batch.preview_json;
  if (!previewData?.groups) {
    throw new ApiError(400, 'أعد رفع الملف لمعاينة التوزيع قبل الاعتماد');
  }
  if (!previewData.can_apply) {
    throw new ApiError(400, 'لا يمكن اعتماد ملف يحتوي على أخطاء في مطابقة الطلاب');
  }
  if (previewData.reassignment_count > 0 && !body.confirm_reassignments) {
    throw new ApiError(400, 'يوجد تغيير في اسم المشرف. أكّد العملية قبل الاعتماد', null, 'REASSIGNMENT_CONFIRMATION_REQUIRED');
  }

  const created = [];
  const updated = [];
  const unchanged = [];

  await prisma.$transaction(
    async (tx) => {
      const pending = [];
      for (const group of previewData.groups || []) {
        const displayName = names.displaySupervisorName(group.supervisor_label);
        const normalized = names.normalizeSupervisorKey(displayName);
        const unassigned = Boolean(group.unassigned) || !normalized;
        const nextName = unassigned ? null : displayName;
        const nextKey = unassigned ? null : normalized;
        for (const student of group.students) {
          if (student.status === 'error' || !student.application_id) {
            throw new ApiError(400, 'لا يمكن اعتماد ملف يحتوي على طلاب غير صالحين');
          }
          pending.push({ student, nextName, nextKey });
        }
      }

      const appIds = pending.map((row) => row.student.application_id);
      const [apps, existingAssignments] = await Promise.all([
        tx.field_training_applications.findMany({ where: { id: { in: appIds } } }),
        tx.field_training_academic_supervisor_assignments.findMany({
          where: { application_id: { in: appIds } },
        }),
      ]);
      const appById = new Map(apps.map((row) => [row.id, row]));
      const existingByApp = new Map(existingAssignments.map((row) => [row.application_id, row]));
      const auditRows = [];
      const now = new Date();

      for (const item of pending) {
        const app = appById.get(item.student.application_id);
        if (!app || String(app.opportunity_id) !== String(opportunityId)) {
          throw new ApiError(400, 'لا يمكن اعتماد ملف يحتوي على طلاب غير صالحين');
        }
        const existing = existingByApp.get(app.id) || null;
        const previousName = names.displaySupervisorName(
          app.academic_supervisor_name || existing?.academic_supervisor_name
        );
        const previousKey = names.normalizeSupervisorKey(previousName);
        const sameName = previousKey === item.nextKey;

        await tx.field_training_applications.update({
          where: { id: app.id },
          data: {
            academic_supervisor_name: item.nextName,
            academic_supervisor_normalized: item.nextKey,
            updated_at: now,
          },
        });

        const assignmentData = {
          student_id: app.student_id,
          opportunity_id: opportunityId,
          university_id: batch.university_id,
          supervisor_user_id: null,
          academic_supervisor_name: item.nextName,
          academic_supervisor_normalized: item.nextKey,
          import_batch_id: batch.id,
          assigned_by_id: user.userId,
          assigned_at: now,
          updated_at: now,
        };

        if (!existing) {
          await tx.field_training_academic_supervisor_assignments.create({
            data: { application_id: app.id, ...assignmentData },
          });
          created.push(app.id);
          auditRows.push({ action: 'created', app, previousName, nextName: item.nextName });
        } else if (!sameName) {
          await tx.field_training_academic_supervisor_assignments.update({
            where: { application_id: app.id },
            data: assignmentData,
          });
          updated.push(app.id);
          auditRows.push({
            action: 'reassigned',
            app,
            previousName,
            nextName: item.nextName,
            previous_supervisor_id: existing.supervisor_user_id || null,
          });
        } else {
          await tx.field_training_academic_supervisor_assignments.update({
            where: { application_id: app.id },
            data: {
              academic_supervisor_name: item.nextName || existing.academic_supervisor_name,
              academic_supervisor_normalized: item.nextKey,
              import_batch_id: batch.id,
              supervisor_user_id: null,
              updated_at: now,
            },
          });
          unchanged.push(app.id);
        }
      }

      if (auditRows.length) {
        await tx.field_training_supervisor_import_audit.createMany({
          data: auditRows.map((row) => ({
            batch_id: batch.id,
            application_id: row.app.id,
            student_id: row.app.student_id,
            opportunity_id: opportunityId,
            university_id: batch.university_id,
            previous_supervisor_id: row.previous_supervisor_id || null,
            new_supervisor_id: null,
            previous_supervisor_name: row.previousName || null,
            new_supervisor_name: row.nextName,
            action: row.action,
            acting_admin_id: user.userId,
            original_filename: batch.original_filename,
            file_hash: batch.file_hash,
          })),
        });
      }

      await tx.field_training_supervisor_import_batches.update({
        where: { id: batch.id },
        data: { status: 'applied', applied_at: now, updated_at: now },
      });
    },
    { timeout: 120000, maxWait: 20000 }
  );

  await recordAudit({
    userId: user.userId,
    actionType: 'FIELD_TRAINING_SUPERVISOR_ASSIGNMENTS_IMPORTED',
    entityType: 'field_training_supervisor_import_batch',
    entityId: batch.id,
    newValues: {
      created: created.length,
      updated: updated.length,
      unchanged: unchanged.length,
      filename: batch.original_filename,
      file_hash: batch.file_hash,
    },
  });

  return {
    batch_id: batch.id,
    created: created.length,
    updated: updated.length,
    unchanged: unchanged.length,
    idempotent: created.length === 0 && updated.length === 0,
  };
}

async function updateEnrollmentSupervisorName(applicationId, user, body = {}) {
  const app = await prisma.field_training_applications.findUnique({
    where: { id: applicationId },
  });
  if (!app) throw new ApiError(404, 'الطلب غير موجود');
  const opp = await repo.findById(app.opportunity_id);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  if (!reportAccess.isUniversityAdmin(user) && !isSystemWideAdmin(user)) {
    throw new ApiError(403, 'تعديل اسم المشرف الأكاديمي متاح للمدير فقط');
  }

  const nextName = names.displaySupervisorName(body.academic_supervisor_name) || null;
  const nextKey = names.normalizeSupervisorKey(nextName) || null;
  const previousName = names.displaySupervisorName(app.academic_supervisor_name);
  if (names.normalizeSupervisorKey(previousName) === nextKey) {
    return {
      application_id: app.id,
      academic_supervisor_name: previousName || null,
      academic_supervisor_normalized: nextKey,
      unchanged: true,
    };
  }

  const university = await resolveOpportunityUniversity(opp);
  if (!university?.id) {
    throw new ApiError(400, 'تعذر تحديد الجامعة لحفظ اسم المشرف');
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.field_training_applications.update({
      where: { id: app.id },
      data: {
        academic_supervisor_name: nextName,
        academic_supervisor_normalized: nextKey,
        updated_at: now,
      },
    });
    await tx.field_training_academic_supervisor_assignments.upsert({
      where: { application_id: app.id },
      create: {
        application_id: app.id,
        student_id: app.student_id,
        opportunity_id: app.opportunity_id,
        university_id: university.id,
        supervisor_user_id: null,
        academic_supervisor_name: nextName,
        academic_supervisor_normalized: nextKey,
        assigned_by_id: user.userId,
        assigned_at: now,
        updated_at: now,
      },
      update: {
        supervisor_user_id: null,
        academic_supervisor_name: nextName,
        academic_supervisor_normalized: nextKey,
        assigned_by_id: user.userId,
        assigned_at: now,
        updated_at: now,
      },
    });
  });

  await recordAudit({
    userId: user.userId,
    actionType: 'FIELD_TRAINING_ACADEMIC_SUPERVISOR_NAME_UPDATED',
    entityType: 'field_training_application',
    entityId: app.id,
    oldValues: { academic_supervisor_name: previousName || null },
    newValues: { academic_supervisor_name: nextName },
  });

  return {
    application_id: app.id,
    academic_supervisor_name: nextName,
    academic_supervisor_normalized: nextKey,
    previous_supervisor_name: previousName || null,
    unchanged: false,
  };
}

async function listAcademicSupervisors(opportunityId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunityId, status: 'approved' },
    select: { academic_supervisor_name: true, academic_supervisor_normalized: true },
  });
  const grouped = names.groupRowsBySupervisorName(apps, (row) => row.academic_supervisor_name);
  return {
    supervisors: grouped.map((group) => ({
      name: group.supervisor_label,
      normalized: group.supervisor_normalized,
      student_count: group.students.length,
      unassigned: group.unassigned,
    })),
  };
}

async function downloadTemplate(opportunityId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  return parse.buildSupervisorAssignmentTemplate();
}

module.exports = {
  UNRESOLVED_ACCOUNT,
  AMBIGUOUS_ACCOUNT,
  LINKED_ACCOUNT,
  fileHash,
  majorityId,
  matchUniversityByOpportunityTitle,
  resolveOpportunityUniversity,
  loadUniversityReviewers,
  resolveSupervisorAccount,
  matchExcelRow,
  previewImport,
  applyImport,
  applyResolutions,
  updateEnrollmentSupervisorName,
  listAcademicSupervisors,
  downloadTemplate,
};
