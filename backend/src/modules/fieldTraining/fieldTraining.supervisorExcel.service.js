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
const names = require('./fieldTraining.supervisorName');
const { universityLabelsMatch } = require('../../utils/universityNameNormalize');

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

function previewCanApply(summary) {
  return (
    Number(summary?.invalidRows || 0) === 0 &&
    Number(summary?.duplicateUniversityNumbers || 0) === 0 &&
    Number(summary?.conflictingAssignments || 0) === 0
  );
}

async function resolveOpportunityUniversity(opp) {
  if (opp?.university_id) {
    const row = await prisma.universities.findUnique({
      where: { id: opp.university_id },
      select: { id: true, name: true },
    });
    if (row) return row;
  }

  const eligibility = await prisma.field_training_opportunity_eligibility.findMany({
    where: { opportunity_id: opp.id, is_active: true },
    select: { university_id: true },
  });
  const eligibilityIds = [...new Set(eligibility.map((row) => row.university_id).filter(Boolean))];
  if (eligibilityIds.length === 1) {
    const row = await prisma.universities.findUnique({
      where: { id: eligibilityIds[0] },
      select: { id: true, name: true },
    });
    if (row) return row;
  }

  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opp.id },
    select: { student_id: true },
  });
  const studentIds = [...new Set(apps.map((row) => row.student_id))];
  if (studentIds.length) {
    const users = await prisma.users.findMany({
      where: { id: { in: studentIds }, primary_university_id: { not: null } },
      select: { primary_university_id: true },
    });
    const counts = new Map();
    for (const user of users) {
      counts.set(user.primary_university_id, (counts.get(user.primary_university_id) || 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked[0]?.[0]) {
      const row = await prisma.universities.findUnique({
        where: { id: ranked[0][0] },
        select: { id: true, name: true },
      });
      if (row) return row;
    }
  }

  return null;
}

async function requireOpportunityUniversity(opp) {
  const university = await resolveOpportunityUniversity(opp);
  if (!university?.id) {
    throw new ApiError(
      400,
      'تعذر تحديد جامعة هذه الفرصة. اربط الفرصة بجامعة ثم أعد المحاولة.',
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
    const record = {
      application: app,
      profile,
      universityNumber: number,
      email: emailKey(profile?.email),
      assignment: {
        supervisor_user_id: assignment?.supervisor_user_id || null,
        supervisor_name:
          assignment?.supervisor_name || names.displaySupervisorName(app.academic_supervisor_name) || null,
        supervisor_email: assignment?.supervisor_email || null,
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
  const rowUniversityLabel = row.university || row.universityNormalized;
  if (
    rowUniversityLabel &&
    (university?.name || expectedUniversity) &&
    !universityLabelsMatch(rowUniversityLabel, university?.name || expectedUniversity)
  ) {
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

  return { ...row, errors, match };
}

function previewPayload({ summary, groups, opportunity, university, batch }) {
  const unresolved = groups.filter((g) => g.resolution?.status !== LINKED_ACCOUNT && g.supervisorNormalized);
  const invalidStudents = summary.rows.filter((row) => row.errors?.length);
  const canApply = previewCanApply({
    invalidRows: invalidStudents.length,
    duplicateUniversityNumbers: summary.duplicateUniversityNumbers,
    conflictingAssignments: summary.conflictingAssignments,
  });

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
      linked_supervisors: groups.filter((g) => g.resolution?.status === LINKED_ACCOUNT).length,
      unresolved_supervisors: unresolved.length,
    },
    can_apply: canApply,
    reassignment_count: summary.rows.filter((row) => row.reassignment).length,
    groups: groups.map((group) => ({
      supervisor_label: group.supervisorLabel,
      supervisor_normalized: group.supervisorNormalized,
      student_count: group.rows.length,
      resolution_status: group.resolution?.status || UNRESOLVED_ACCOUNT,
      resolution_label:
        group.resolution?.status === LINKED_ACCOUNT
          ? 'مرتبط بحساب'
          : group.resolution?.status === AMBIGUOUS_ACCOUNT
            ? 'يوجد أكثر من حساب مطابق — سيُحفظ الاسم كما هو'
            : 'سيُحفظ الاسم بدون حساب في المنصة',
      account: group.resolution?.account
        ? {
            id: group.resolution.account.id,
            full_name: group.resolution.account.full_name,
            email: group.resolution.account.email,
          }
        : null,
      matches: (group.resolution?.matches || []).map((row) => ({
        id: row.id,
        full_name: row.full_name,
        email: row.email,
      })),
      students: group.rows.map((row) => ({
        excel_row: row.excelRow,
        student_name: row.studentName,
        university_number: row.universityNumber,
        university_email: row.universityEmail,
        specialty: row.specialty,
        opportunity: row.opportunity,
        current_supervisor_name: row.match?.assignment?.supervisor_name || null,
        current_supervisor_id: row.match?.assignment?.supervisor_user_id || null,
        proposed_supervisor_name: group.resolution?.account?.full_name || group.supervisorLabel,
        proposed_supervisor_id: group.resolution?.account?.id || null,
        reassignment: Boolean(row.reassignment),
        status: row.errors?.length ? 'error' : 'valid',
        errors: row.errors || [],
        application_id: row.match?.application?.id || null,
        display_application_status: row.applicationStatus,
        display_training_status: row.trainingStatus,
        display_eligibility_status: row.eligibilityStatus,
        display_final_result: row.finalResult,
      })),
    })),
  };
}

async function previewImport(opportunityId, user, file, { resolutions = {} } = {}) {
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
  const summaryBase = parse.summarizeParse(parsed.rows);
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
  summary.rows = matchedRows;

  const reviewers = await loadUniversityReviewers(university.id);
  const mappingRows = await prisma.field_training_supervisor_name_mappings.findMany({
    where: { university_id: university.id },
  });
  const mappings = new Map(mappingRows.map((row) => [row.normalized_name, row]));
  const groups = parse.groupRowsBySupervisor(matchedRows).map((group) => {
    const resolution = resolveSupervisorAccount({ group, reviewers, mappings, resolutions });
    const rows = group.rows.map((row) => {
      const currentName = row.match?.assignment?.supervisor_name || null;
      const proposedName = resolution.account?.full_name || group.supervisorLabel;
      const currentId = row.match?.assignment?.supervisor_user_id || null;
      const proposedId = resolution.account?.id || null;
      return {
        ...row,
        reassignment: Boolean(
          (currentId && proposedId && String(currentId) !== String(proposedId)) ||
            (currentName && proposedName && !names.supervisorNamesEqual(currentName, proposedName))
        ),
      };
    });
    return { ...group, rows, resolution };
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

async function applyResolutions(opportunityId, user, { batch_id, resolutions = {} }) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  const batch = await prisma.field_training_supervisor_import_batches.findFirst({
    where: { id: batch_id, opportunity_id: opportunityId },
  });
  if (!batch?.preview_json?.groups) throw new ApiError(404, 'دفعة الاستيراد غير موجودة');
  const reviewers = opp.university_id ? await loadUniversityReviewers(opp.university_id) : [];
  const preview = batch.preview_json;
  preview.groups = (preview.groups || []).map((group) => {
    const chosenId = resolutions[group.supervisor_normalized];
    if (!chosenId) return group;
    const account = reviewers.find((row) => row.id === chosenId);
    if (!account) return group;
    return {
      ...group,
      resolution_status: LINKED_ACCOUNT,
      resolution_label: 'مرتبط بحساب',
      account: { id: account.id, full_name: account.full_name, email: account.email },
      students: (group.students || []).map((student) => ({
        ...student,
        proposed_supervisor_id: account.id,
        proposed_supervisor_name: account.full_name,
        reassignment: Boolean(
          student.current_supervisor_id && String(student.current_supervisor_id) !== String(account.id)
        ),
      })),
    };
  });
  preview.totals = {
    ...preview.totals,
    linked_supervisors: preview.groups.filter((g) => g.resolution_status === LINKED_ACCOUNT).length,
    unresolved_supervisors: preview.groups.filter(
      (g) => g.resolution_status !== LINKED_ACCOUNT && g.supervisor_normalized
    ).length,
  };
  preview.reassignment_count = preview.groups.reduce(
    (sum, group) => sum + group.students.filter((row) => row.reassignment).length,
    0
  );
  preview.can_apply = previewCanApply({
    invalidRows: preview.totals.invalid_students,
    duplicateUniversityNumbers: preview.totals.duplicate_rows,
    conflictingAssignments: preview.totals.conflicting_assignments,
  });
  await prisma.field_training_supervisor_import_batches.update({
    where: { id: batch.id },
    data: { preview_json: preview, updated_at: new Date() },
  });
  return preview;
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
    throw new ApiError(400, 'لا يمكن اعتماد ملف يحتوي على طلاب غير صالحين أو صفوف متعارضة');
  }
  if (previewData.reassignment_count > 0 && !body.confirm_reassignments) {
    throw new ApiError(400, 'يوجد إعادة إسناد. أكّد العملية قبل الاعتماد', null, 'REASSIGNMENT_CONFIRMATION_REQUIRED');
  }

  const created = [];
  const updated = [];
  const unchanged = [];

  await prisma.$transaction(
    async (tx) => {
      const locked = await tx.$queryRaw`
        SELECT id, status
        FROM field_training_supervisor_import_batches
        WHERE id = ${batch.id}::uuid
        FOR UPDATE
      `;
      if (!locked[0]) {
        throw new ApiError(404, 'دفعة الاستيراد غير موجودة');
      }
      if (locked[0].status === 'applied') {
        return;
      }

      const allApplicationIds = [];
      for (const group of previewData.groups || []) {
        for (const student of group.students || []) {
          if (student.status === 'error' || !student.application_id) {
            throw new ApiError(400, 'لا يمكن اعتماد ملف يحتوي على طلاب غير صالحين');
          }
          allApplicationIds.push(student.application_id);
        }
      }

      const [applications, existingAssignments, existingMappings] = await Promise.all([
        tx.field_training_applications.findMany({
          where: { id: { in: allApplicationIds } },
        }),
        tx.field_training_academic_supervisor_assignments.findMany({
          where: { application_id: { in: allApplicationIds } },
        }),
        tx.field_training_supervisor_name_mappings.findMany({
          where: { university_id: batch.university_id },
        }),
      ]);
      const appById = new Map(applications.map((row) => [row.id, row]));
      const assignmentByAppId = new Map(
        existingAssignments.map((row) => [row.application_id, row])
      );
      const mappingByKey = new Map(
        existingMappings.map((row) => [row.normalized_name, row])
      );
      for (const applicationId of allApplicationIds) {
        if (!appById.has(applicationId)) {
          throw new ApiError(400, 'لا يمكن اعتماد ملف يحتوي على طلاب غير صالحين');
        }
      }

      const auditRows = [];
      const now = new Date();

      for (const group of previewData.groups || []) {
        const supervisorUserId = group.account?.id || null;
        const supervisorName = names.displaySupervisorName(group.supervisor_label) || null;
        const supervisorKey = names.normalizeSupervisorKey(group.supervisor_label) || null;
        const groupApplicationIds = (group.students || [])
          .map((student) => student.application_id)
          .filter(Boolean);

        if (supervisorUserId && supervisorKey) {
          const existingMapping = mappingByKey.get(supervisorKey);
          if (existingMapping) {
            await tx.field_training_supervisor_name_mappings.update({
              where: { id: existingMapping.id },
              data: {
                supervisor_user_id: supervisorUserId,
                display_name: supervisorName,
                supervisor_email: group.account.email,
                updated_at: now,
              },
            });
          } else {
            const createdMapping = await tx.field_training_supervisor_name_mappings.create({
              data: {
                university_id: batch.university_id,
                normalized_name: supervisorKey,
                display_name: supervisorName,
                supervisor_user_id: supervisorUserId,
                supervisor_email: group.account.email,
                created_by_id: user.userId,
              },
            });
            mappingByKey.set(supervisorKey, createdMapping);
          }
        }

        if (groupApplicationIds.length) {
          await tx.field_training_applications.updateMany({
            where: { id: { in: groupApplicationIds } },
            data: {
              academic_supervisor_name: supervisorName,
              academic_supervisor_normalized: supervisorKey,
              updated_at: now,
            },
          });
        }

        for (const student of group.students || []) {
        if (student.status === 'error' || !student.application_id) {
          throw new ApiError(400, 'لا يمكن اعتماد ملف يحتوي على طلاب غير صالحين');
        }
          const existing = assignmentByAppId.get(student.application_id);
          const app = appById.get(student.application_id);

          const nameChanged = !names.supervisorNamesEqual(
            existing?.academic_supervisor_name || app.academic_supervisor_name,
            supervisorName
          );
          const accountChanged =
            String(existing?.supervisor_user_id || '') !== String(supervisorUserId || '');
          const auditBase = {
            batch_id: batch.id,
            application_id: student.application_id,
            student_id: app.student_id,
            opportunity_id: opportunityId,
            university_id: batch.university_id,
            previous_supervisor_id: existing?.supervisor_user_id || null,
            new_supervisor_id: supervisorUserId,
            previous_supervisor_name: existing?.academic_supervisor_name || null,
            new_supervisor_name: supervisorName,
            acting_admin_id: user.userId,
            original_filename: batch.original_filename,
            file_hash: batch.file_hash,
          };

          if (!existing) {
            const createdAssignment = await tx.field_training_academic_supervisor_assignments.create({
              data: {
                application_id: student.application_id,
                student_id: app.student_id,
                opportunity_id: opportunityId,
                university_id: batch.university_id,
                supervisor_user_id: supervisorUserId,
                academic_supervisor_name: supervisorName,
                academic_supervisor_normalized: supervisorKey,
                import_batch_id: batch.id,
                assigned_by_id: user.userId,
              },
            });
            assignmentByAppId.set(student.application_id, createdAssignment);
            auditRows.push({ ...auditBase, action: 'created', previous_supervisor_id: null, previous_supervisor_name: null });
            created.push(student.application_id);
          } else if (nameChanged || accountChanged) {
            await tx.field_training_academic_supervisor_assignments.update({
              where: { application_id: student.application_id },
              data: {
                supervisor_user_id: supervisorUserId,
                academic_supervisor_name: supervisorName,
                academic_supervisor_normalized: supervisorKey,
                import_batch_id: batch.id,
                assigned_by_id: user.userId,
                assigned_at: now,
                updated_at: now,
              },
            });
            auditRows.push({ ...auditBase, action: 'reassigned' });
            updated.push(student.application_id);
          } else {
            auditRows.push({ ...auditBase, action: 'unchanged' });
            unchanged.push(student.application_id);
          }
        }
      }

      if (auditRows.length) {
        await tx.field_training_supervisor_import_audit.createMany({ data: auditRows });
      }

      await tx.field_training_supervisor_import_batches.update({
        where: { id: batch.id },
        data: { status: 'applied', applied_at: now, updated_at: now },
      });
  },
    { maxWait: 20_000, timeout: 120_000 }
  );

  if (created.length === 0 && updated.length === 0 && unchanged.length === 0) {
    const freshBatch = await prisma.field_training_supervisor_import_batches.findUnique({
      where: { id: batch.id },
      select: { status: true },
    });
    if (freshBatch?.status === 'applied') {
      return { batch_id: batch.id, created: 0, updated: 0, unchanged: 0, idempotent: true };
    }
  }

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

async function listAcademicSupervisors(opportunityId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  const university = await resolveOpportunityUniversity(opp);
  const reviewers = university?.id ? await loadUniversityReviewers(university.id) : [];
  return { supervisors: reviewers };
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
  loadUniversityReviewers,
  resolveSupervisorAccount,
  matchExcelRow,
  previewImport,
  applyImport,
  applyResolutions,
  listAcademicSupervisors,
  downloadTemplate,
  previewCanApply,
  resolveOpportunityUniversity,
};
