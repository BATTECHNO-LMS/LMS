'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { getProvider } = require('../../shared/storage/storageProvider');
const filesService = require('../files/files.service');
const ftAccess = require('./fieldTraining.access');
const access = require('./fieldTrainingEvaluation.access');
const scoring = require('./fieldTrainingEvaluation.scoring');
const { buildAutoComment } = require('./fieldTrainingEvaluation.comments');
const { buildPlaceholderMap, validatePlaceholderSet } = require('./fieldTrainingEvaluation.placeholders');
const { assertDocxUpload, extractDocxPlaceholders, fillDocxTemplate, inspectFilledDocx, detectUniversityLabelFormFromBuffer } = require('./fieldTrainingEvaluation.docx');
const { convertFilledDocxToPdf } = require('./fieldTrainingEvaluation.pdf');
const {
  TEMPLATE_MISSING_CODE,
  DATA_INCOMPLETE_CODE,
  STUDENT_NUMBER_UNRESOLVED_CODE,
  UNRESOLVED_PLACEHOLDERS_CODE,
  PDF_RENDER_FAILED_CODE,
  PROFESSIONAL_INCOMPLETE_CODE,
  GATE_REASON_LABELS_AR,
  ACCEPTED_TASK_STATUSES,
  STORAGE_FOLDER,
  DEFAULT_POLICY,
} = require('./fieldTrainingEvaluation.constants');
const {
  buildEvaluationPdfFilename,
} = require('./fieldTrainingEvaluation.filename');
const { resolveOfficialUniversityNumber } = require('./fieldTrainingEvaluation.universityNumber');
const { resolveEvaluationTemplate } = require('./fieldTrainingEvaluation.resolve');
const {
  num,
  academicPeriod,
  buildFieldTrainingEvaluationTemplatePayload,
  missingRequiredIdentityFields,
  missingRequiredCompleteFields,
  publicPreviewPayload,
  identitySnapshot,
  shouldReuseStoredPdf,
} = require('./fieldTrainingEvaluation.payload');
const ftRepo = require('./fieldTraining.repository');
const zipUtil = require('./fieldTrainingEvaluation.zip');
const taskProgress = require('./fieldTraining.taskProgress');

function templateIsUsable(template) {
  if (!template || template.archived_at) return false;
  if (template.validation_status === 'valid') return true;
  return template.validation_json?.fillMode === 'label_form';
}

function isPrismaUniqueConflict(err) {
  if (!err) return false;
  if (err.code === 'P2002') return true;
  return /unique constraint/i.test(String(err.message || ''));
}

async function upsertCurrentEvaluationRow(applicationId, payload) {
  const existing = await prisma.field_training_final_evaluations.findFirst({
    where: { application_id: applicationId },
    orderBy: [{ is_current: 'desc' }, { generated_at: 'desc' }, { created_at: 'desc' }],
    select: { id: true, pdf_file_id: true },
  });
  if (existing) {
    return prisma.field_training_final_evaluations.update({
      where: { id: existing.id },
      data: { ...payload, is_current: true },
    });
  }
  try {
    return await prisma.field_training_final_evaluations.create({
      data: { ...payload, application_id: applicationId, is_current: true },
    });
  } catch (err) {
    if (!isPrismaUniqueConflict(err)) throw err;
    const raced = await prisma.field_training_final_evaluations.findFirst({
      where: { application_id: applicationId },
      orderBy: [{ is_current: 'desc' }, { generated_at: 'desc' }, { created_at: 'desc' }],
      select: { id: true },
    });
    if (!raced) throw err;
    return prisma.field_training_final_evaluations.update({
      where: { id: raced.id },
      data: { ...payload, is_current: true },
    });
  }
}

async function findUsableTemplate({ opportunity, universityId }) {
  const resolved = await resolveTemplate({ ...opportunity, university_id: universityId });
  if (templateIsUsable(resolved.template)) return resolved.template;

  const sameUniversity = universityId
    ? await prisma.field_training_evaluation_templates.findMany({
        where: { university_id: universityId, archived_at: null },
        orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
        take: 20,
      })
    : [];

  for (const row of sameUniversity) {
    if (templateIsUsable(row)) return row;
    try {
      const { buffer } = await loadFileBuffer(row.original_file_id);
      if (!(await detectUniversityLabelFormFromBuffer(buffer))) continue;
      return prisma.field_training_evaluation_templates.update({
        where: { id: row.id },
        data: {
          is_active: true,
          validation_status: 'valid',
          validation_json: { ...(row.validation_json || {}), valid: true, fillMode: 'label_form' },
          updated_at: new Date(),
        },
      });
    } catch {
      /* try next uploaded file for this university only */
    }
  }

  const globalFallback = await prisma.field_training_evaluation_templates.findFirst({
    where: {
      archived_at: null,
      is_active: true,
      is_default: true,
      validation_status: 'valid',
      ...(universityId ? { university_id: { not: universityId } } : {}),
    },
    orderBy: { created_at: 'desc' },
  });
  if (templateIsUsable(globalFallback)) return globalFallback;
  return resolved.template || null;
}

function resolveEvalUniversityId(ctx, user) {
  return (
    ctx?.opportunity?.university_id ||
    ctx?.student?.primary_university_id ||
    user?.universityId ||
    null
  );
}

function remapSchemaMismatch(err) {
  if (err instanceof ApiError) throw err;
  const msg = String(err?.message || '');
  if (
    err?.code === 'P2021' ||
    err?.code === 'P2022' ||
    msg.includes('does not exist in the current database')
  ) {
    throw new ApiError(
      503,
      'تعذر تحميل بيانات تقييم التدريب الميداني. يرجى تطبيق ترحيل قاعدة البيانات (prisma migrate deploy).',
      null,
      'FIELD_TRAINING_SCHEMA_MISMATCH'
    );
  }
  throw err;
}

function mapPolicyRow(row) {
  if (!row) return { ...DEFAULT_POLICY, id: null, version: 0 };
  return {
    id: row.id,
    universityId: row.university_id,
    version: row.version,
    isActive: row.is_active,
    minimumAttendancePercentage: num(row.minimum_attendance_percentage),
    requiredTrainingHours: row.required_training_hours,
    requiredTasksRequired: row.required_tasks_required,
    postAssessmentRequired: row.post_assessment_required,
    professionalEvaluationRequired: row.professional_evaluation_required,
    minimumPassingScore: num(row.minimum_passing_score),
    attendanceWeight: num(row.attendance_weight),
    tasksWeight: num(row.tasks_weight),
    postAssessmentWeight: num(row.post_assessment_weight),
    professionalEvaluationWeight: num(row.professional_evaluation_weight),
    attendanceBands: row.attendance_bands || DEFAULT_POLICY.attendanceBands,
  };
}

function mapTemplateRow(row, extras = {}) {
  if (!row) return null;
  return {
    id: row.id,
    universityId: row.university_id,
    name: row.name,
    description: row.description,
    originalFileId: row.original_file_id,
    version: row.version,
    isActive: row.is_active,
    isDefault: row.is_default,
    validationStatus: row.validation_status,
    validation: row.validation_json,
    createdById: row.created_by_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    ...extras,
  };
}

async function getActivePolicy(universityId) {
  if (!universityId) return mapPolicyRow(null);
  const row = await prisma.field_training_evaluation_policies.findFirst({
    where: { university_id: universityId, is_active: true, archived_at: null },
  });
  return mapPolicyRow(row);
}

async function resolveTemplate(opportunity) {
  let assigned = null;
  if (opportunity?.evaluation_template_id) {
    assigned = await prisma.field_training_evaluation_templates.findUnique({
      where: { id: opportunity.evaluation_template_id },
    });
  }
  const universityId = opportunity?.university_id;
  const universityDefault = universityId
    ? await prisma.field_training_evaluation_templates.findFirst({
        where: {
          university_id: universityId,
          is_default: true,
          is_active: true,
          archived_at: null,
        },
      })
    : null;
  let globalFallback = null;
  if (!assigned?.id || assigned.archived_at) {
    if (!universityDefault) {
      globalFallback = await prisma.field_training_evaluation_templates.findFirst({
        where: {
          archived_at: null,
          is_active: true,
          is_default: true,
          validation_status: 'valid',
          ...(universityId ? { university_id: { not: universityId } } : {}),
        },
        orderBy: { created_at: 'desc' },
      });
    }
  }
  return resolveEvaluationTemplate({
    opportunity,
    assignedTemplate: assigned,
    universityDefault,
    globalFallback,
  });
}

async function loadFileBuffer(fileId) {
  const file = await prisma.files.findFirst({
    where: { id: fileId, deleted_at: null },
  });
  if (!file) throw new ApiError(404, 'File not found', null, 'FILE_NOT_FOUND');
  const provider = getProvider();
  return { file, buffer: await provider.getObjectBuffer(file.storage_key) };
}

function audit(user, actionType, entityType, entityId, extra = {}) {
  return recordAudit({
    userId: user?.userId || null,
    universityId: extra.universityId || user?.universityId || null,
    actionType,
    entityType,
    entityId: entityId || null,
    newValues: {
      role: user?.role || (Array.isArray(user?.roles) ? user.roles[0] : null),
      opportunityId: extra.opportunityId || null,
      studentId: extra.studentId || null,
      ...extra.meta,
    },
  });
}

async function listTemplates(user, query = {}) {
  let universityId = query.university_id;
  if (access.isInstructor(user) && !access.isUniversityAdmin(user) && !access.isSuperAdmin(user)) {
    universityId = user.universityId || query.university_id;
    if (!universityId) throw new ApiError(403, access.MSG.universityRequired, null, 'UNIVERSITY_REQUIRED');
  } else {
    const scoped = access.assertCanManageUniversityTemplates(user, query.university_id);
    universityId = scoped.universityId || query.university_id;
    if (!access.isSuperAdmin(user) && !universityId) {
      throw new ApiError(403, access.MSG.universityRequired, null, 'UNIVERSITY_REQUIRED');
    }
  }
  const where = { archived_at: query.include_archived ? undefined : null };
  if (universityId) where.university_id = universityId;
  Object.keys(where).forEach((key) => where[key] === undefined && delete where[key]);

  const [rows, assignments] = await Promise.all([
    prisma.field_training_evaluation_templates.findMany({
      where: universityId ? { university_id: universityId, ...(query.include_archived ? {} : { archived_at: null }) } : (query.include_archived ? {} : { archived_at: null }),
      orderBy: [{ university_id: 'asc' }, { is_default: 'desc' }, { version: 'desc' }],
    }),
    prisma.field_training_opportunities.findMany({
      where: universityId ? { university_id: universityId, evaluation_template_id: { not: null } } : { evaluation_template_id: { not: null } },
      select: { id: true, title: true, evaluation_template_id: true },
    }),
  ]);
  const byTemplate = new Map();
  for (const opp of assignments) {
    const list = byTemplate.get(opp.evaluation_template_id) || [];
    list.push({ id: opp.id, title: opp.title });
    byTemplate.set(opp.evaluation_template_id, list);
  }
  return {
    templates: rows.map((row) => mapTemplateRow(row, { opportunities: byTemplate.get(row.id) || [] })),
  };
}

async function uploadTemplate(user, body, file) {
  let universityId = body.university_id;
  if (body.opportunity_id) {
    const opportunity = await prisma.field_training_opportunities.findUnique({
      where: { id: body.opportunity_id },
      include: {
        field_training_opportunity_eligibility: {
          where: { is_active: true },
          select: { university_id: true },
          take: 1,
        },
      },
    });
    if (!opportunity) throw new ApiError(404, 'Opportunity not found');
    access.assertCanAssignOpportunityTemplate(user, opportunity);
    await ftAccess.assertManageOpportunityAccess(user, opportunity);
    universityId =
      opportunity.university_id ||
      opportunity.field_training_opportunity_eligibility?.[0]?.university_id ||
      user.universityId;
    if (!access.isSuperAdmin(user) && !access.isUniversityAdmin(user)) {
      body.is_default = false;
    }
  } else {
    universityId = access.assertCanManageUniversityTemplates(user, body.university_id).universityId || body.university_id;
  }
  if (!universityId) throw new ApiError(400, 'يرجى تحديد الجامعة', null, 'UNIVERSITY_REQUIRED');
  if (!file?.buffer) throw new ApiError(400, 'يرجى رفع ملف DOCX', null, 'FILE_REQUIRED');
  const uploadCheck = assertDocxUpload({
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  });
  if (!uploadCheck.ok) {
    throw new ApiError(400, 'صيغة القالب غير صالحة. يُقبل DOCX فقط.', { errors: uploadCheck.errors }, 'INVALID_TEMPLATE_FILE');
  }
  const found = await extractDocxPlaceholders(file.buffer);
  let validation = validatePlaceholderSet(found);
  const labelForm = await detectUniversityLabelFormFromBuffer(file.buffer);
  if (labelForm && !validation.valid) {
    validation = { ...validation, valid: true, fillMode: 'label_form' };
  }
  const usable = Boolean(validation.valid);
  const stored = await filesService.storePrivateBuffer({
    buffer: file.buffer,
    originalName: file.originalname || 'evaluation-template.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    folder: STORAGE_FOLDER,
    user,
    relatedEntityType: 'field_training_evaluation_template',
    relatedEntityId: universityId,
  });

  const previousDefault = body.is_default
    ? await prisma.field_training_evaluation_templates.findFirst({
        where: { university_id: universityId, is_default: true, is_active: true, archived_at: null },
      })
    : null;
  const latest = await prisma.field_training_evaluation_templates.findFirst({
    where: { university_id: universityId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = body.replace_of ? undefined : (latest?.version || 0) + 1;

  const created = await prisma.$transaction(async (tx) => {
    if (body.is_default && previousDefault) {
      await tx.field_training_evaluation_templates.update({
        where: { id: previousDefault.id },
        data: { is_default: false, is_active: false, archived_at: new Date(), updated_at: new Date() },
      });
    }
    if (body.replace_of) {
      const prev = await tx.field_training_evaluation_templates.findUnique({ where: { id: body.replace_of } });
      if (!prev || String(prev.university_id) !== String(universityId)) {
        throw new ApiError(404, 'Template not found');
      }
      await tx.field_training_evaluation_templates.update({
        where: { id: prev.id },
        data: { is_active: false, is_default: false, archived_at: new Date(), updated_at: new Date() },
      });
    }
    return tx.field_training_evaluation_templates.create({
      data: {
        university_id: universityId,
        name: body.name || file.originalname || 'Evaluation template',
        description: body.description || null,
        original_file_id: stored.id,
        version: body.replace_of
          ? ((await tx.field_training_evaluation_templates.findUnique({ where: { id: body.replace_of } }))?.version || 0) + 1
          : version,
        is_active: usable,
        is_default: Boolean(body.is_default) && usable,
        validation_status: usable ? 'valid' : 'invalid',
        validation_json: validation,
        created_by_id: user.userId,
      },
    });
  });

  await audit(user, body.replace_of ? 'FT_EVAL_TEMPLATE_REPLACED' : 'FT_EVAL_TEMPLATE_UPLOADED', 'field_training_evaluation_template', created.id, {
    universityId,
    meta: { version: created.version, isDefault: created.is_default },
  });
  if (body.opportunity_id && created.id) {
    await prisma.field_training_opportunities.update({
      where: { id: body.opportunity_id },
      data: { evaluation_template_id: created.id, updated_at: new Date() },
    });
  }
  return { template: mapTemplateRow(created), validation };
}

async function setDefaultTemplate(user, templateId) {
  const row = await prisma.field_training_evaluation_templates.findUnique({ where: { id: templateId } });
  if (!row || row.archived_at) throw new ApiError(404, 'Template not found');
  access.assertCanManageUniversityTemplates(user, row.university_id);
  if (row.validation_status !== 'valid') {
    throw new ApiError(400, 'لا يمكن تعيين قالب غير صالح كافتراضي', null, 'TEMPLATE_VALIDATION_FAILED');
  }
  await prisma.$transaction([
    prisma.field_training_evaluation_templates.updateMany({
      where: { university_id: row.university_id, is_default: true, archived_at: null },
      data: { is_default: false, updated_at: new Date() },
    }),
    prisma.field_training_evaluation_templates.update({
      where: { id: templateId },
      data: { is_default: true, is_active: true, updated_at: new Date() },
    }),
  ]);
  await audit(user, 'FT_EVAL_TEMPLATE_DEFAULT_CHANGED', 'field_training_evaluation_template', templateId, {
    universityId: row.university_id,
  });
  return listTemplates(user, { university_id: row.university_id });
}

async function getOpportunityTemplateState(user, opportunityId) {
  try {
    const opportunity = await prisma.field_training_opportunities.findUnique({ where: { id: opportunityId } });
    if (!opportunity) throw new ApiError(404, 'Opportunity not found');
    await ftAccess.assertAdminOpportunityAccess(user, opportunity);
    const resolved = await resolveTemplate(opportunity);
    const universityDefault = opportunity.university_id
      ? await prisma.field_training_evaluation_templates.findFirst({
          where: { university_id: opportunity.university_id, is_default: true, is_active: true, archived_at: null },
        })
      : null;
    return {
      opportunityId,
      universityDefault: mapTemplateRow(universityDefault),
      opportunityTemplate: mapTemplateRow(
        opportunity.evaluation_template_id
          ? await prisma.field_training_evaluation_templates.findUnique({ where: { id: opportunity.evaluation_template_id } })
          : null
      ),
      resolvedSource: resolved.source,
      resolvedTemplate: mapTemplateRow(resolved.template),
      missing: resolved.source === 'missing',
      code: resolved.source === 'missing' ? TEMPLATE_MISSING_CODE : null,
    };
  } catch (err) {
    remapSchemaMismatch(err);
  }
}

async function assignOpportunityTemplate(user, opportunityId, templateId) {
  const opportunity = await prisma.field_training_opportunities.findUnique({ where: { id: opportunityId } });
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  access.assertCanAssignOpportunityTemplate(user, opportunity);
  await ftAccess.assertManageOpportunityAccess(user, opportunity);
  if (!templateId) {
    await prisma.field_training_opportunities.update({
      where: { id: opportunityId },
      data: { evaluation_template_id: null, updated_at: new Date() },
    });
    await audit(user, 'FT_EVAL_OPPORTUNITY_OVERRIDE_CHANGED', 'field_training_opportunity', opportunityId, {
      universityId: opportunity.university_id,
      opportunityId,
      meta: { templateId: null },
    });
    return getOpportunityTemplateState(user, opportunityId);
  }
  const template = await prisma.field_training_evaluation_templates.findUnique({ where: { id: templateId } });
  if (!template || template.archived_at) throw new ApiError(404, 'Template not found');
  if (opportunity.university_id && String(template.university_id) !== String(opportunity.university_id) && !access.isSuperAdmin(user)) {
    throw new ApiError(403, access.MSG.crossUniversity, null, 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN');
  }
  if (template.validation_status !== 'valid') {
    throw new ApiError(400, 'لا يمكن إسناد قالب غير صالح', null, 'TEMPLATE_VALIDATION_FAILED');
  }
  await prisma.field_training_opportunities.update({
    where: { id: opportunityId },
    data: { evaluation_template_id: templateId, updated_at: new Date() },
  });
  await audit(user, 'FT_EVAL_OPPORTUNITY_OVERRIDE_CHANGED', 'field_training_opportunity', opportunityId, {
    universityId: opportunity.university_id,
    opportunityId,
    meta: { templateId },
  });
  return getOpportunityTemplateState(user, opportunityId);
}

async function previewTemplate(user, templateId) {
  const row = await prisma.field_training_evaluation_templates.findUnique({ where: { id: templateId } });
  if (!row) throw new ApiError(404, 'Template not found');
  access.assertCanManageUniversityTemplates(user, row.university_id);
  const { buffer } = await loadFileBuffer(row.original_file_id);
  const mammoth = require('mammoth');
  const { value } = await mammoth.convertToHtml({ buffer });
  return { template: mapTemplateRow(row), html: value };
}

async function previewApplicationPayload(user, applicationId) {
  const { byId } = await loadBatchContext([applicationId]);
  const ctx = byId.get(applicationId);
  if (!ctx) throw new ApiError(404, 'Application not found');
  access.assertCanGenerate(user, ctx.opportunity);
  await ftAccess.assertManageOpportunityAccess(user, ctx.opportunity);
  const policy = { ...ctx.policy };
  if (policy.requiredTrainingHours == null) policy.requiredTrainingHours = ctx.scoringInput.requiredHours;
  const calculated = scoring.calculateFinalEvaluation(ctx.scoringInput, policy);
  const autoComment = buildAutoComment(calculated);
  const payload = buildFillFields(ctx, { ...calculated, generalComments: autoComment, autoComment });
  const missingFields = missingRequiredIdentityFields(payload);
  return {
    payload: publicPreviewPayload(payload),
    missingFields,
    canGenerate: missingFields.length === 0,
    filename: missingFields.length
      ? null
      : buildEvaluationPdfFilename({
          studentName: payload.student_name,
          universityNumber: payload.student_number,
        }),
  };
}

async function downloadTemplateFile(user, templateId) {
  const row = await prisma.field_training_evaluation_templates.findUnique({ where: { id: templateId } });
  if (!row) throw new ApiError(404, 'Template not found');
  if (access.isInstructor(user) && !access.isUniversityAdmin(user) && !access.isSuperAdmin(user)) {
    const assigned = await prisma.field_training_opportunities.findFirst({
      where: { assigned_instructor_id: user.userId, evaluation_template_id: templateId },
      select: { id: true },
    });
    const uniDefault = row.is_default && user.universityId && String(row.university_id) === String(user.universityId);
    if (!assigned && !uniDefault) throw new ApiError(403, access.MSG.forbidden, null, 'FIELD_TRAINING_FORBIDDEN');
  } else {
    access.assertCanManageUniversityTemplates(user, row.university_id);
  }
  const { file, buffer } = await loadFileBuffer(row.original_file_id);
  return { buffer, filename: file.original_name || `${row.name}.docx`, mimeType: file.mime_type };
}

async function getPolicy(user, universityId) {
  const scoped = access.assertCanViewReports(user, universityId);
  const uni = scoped.universityId || universityId;
  if (!uni && !access.isSuperAdmin(user)) {
    throw new ApiError(403, access.MSG.universityRequired, null, 'UNIVERSITY_REQUIRED');
  }
  return { policy: await getActivePolicy(uni) };
}

async function upsertPolicy(user, universityId, body) {
  const uni = access.assertCanManagePolicy(user, universityId).universityId || universityId;
  if (!uni) throw new ApiError(400, 'يرجى تحديد الجامعة', null, 'UNIVERSITY_REQUIRED');
  const mapped = scoring.normalizePolicy({
    minimumAttendancePercentage: body.minimum_attendance_percentage,
    requiredTrainingHours: body.required_training_hours,
    requiredTasksRequired: body.required_tasks_required,
    postAssessmentRequired: body.post_assessment_required,
    professionalEvaluationRequired: body.professional_evaluation_required,
    minimumPassingScore: body.minimum_passing_score,
    attendanceWeight: body.attendance_weight,
    tasksWeight: body.tasks_weight,
    postAssessmentWeight: body.post_assessment_weight,
    professionalEvaluationWeight: body.professional_evaluation_weight,
    attendanceBands: body.attendance_bands,
  });
  const check = scoring.validatePolicyWeights(mapped);
  if (!check.ok) {
    throw new ApiError(400, 'يجب أن مجموع الأوزان المفعّلة يساوي 100%', { total: check.total }, 'POLICY_WEIGHTS_INVALID');
  }
  const current = await prisma.field_training_evaluation_policies.findFirst({
    where: { university_id: uni, is_active: true, archived_at: null },
  });
  const created = await prisma.$transaction(async (tx) => {
    if (current) {
      await tx.field_training_evaluation_policies.update({
        where: { id: current.id },
        data: { is_active: false, archived_at: new Date(), updated_at: new Date() },
      });
    }
    return tx.field_training_evaluation_policies.create({
      data: {
        university_id: uni,
        version: (current?.version || 0) + 1,
        is_active: true,
        minimum_attendance_percentage: mapped.minimumAttendancePercentage,
        required_training_hours: mapped.requiredTrainingHours,
        required_tasks_required: mapped.requiredTasksRequired,
        post_assessment_required: mapped.postAssessmentRequired,
        professional_evaluation_required: mapped.professionalEvaluationRequired,
        minimum_passing_score: mapped.minimumPassingScore,
        attendance_weight: mapped.attendanceWeight,
        tasks_weight: mapped.tasksWeight,
        post_assessment_weight: mapped.postAssessmentWeight,
        professional_evaluation_weight: mapped.professionalEvaluationWeight,
        attendance_bands: mapped.attendanceBands,
        created_by_id: user.userId,
      },
    });
  });
  await audit(user, 'FT_EVAL_POLICY_CHANGED', 'field_training_evaluation_policy', created.id, {
    universityId: uni,
    meta: { version: created.version },
  });
  return { policy: mapPolicyRow(created) };
}

async function saveSupervisorRating(user, applicationId, body) {
  const application = await prisma.field_training_applications.findUnique({
    where: { id: applicationId },
    include: { field_training_opportunities: true },
  });
  if (!application) throw new ApiError(404, 'Application not found');
  const opportunity = application.field_training_opportunities;
  access.assertCanGenerate(user, opportunity);
  await ftAccess.assertManageOpportunityAccess(user, opportunity);
  const fields = ['thinking_and_initiative', 'problem_solving', 'teamwork', 'professional_conduct', 'supervisor_cooperation', 'rules_compliance'];
  const data = {};
  for (const field of fields) {
    const n = scoring.clampScore15(body[field]);
    if (n == null) throw new ApiError(400, 'جميع تقييمات المشرف يجب أن تكون من 1 إلى 5', null, 'INVALID_RATING');
    data[field] = n;
  }
  const universityId = opportunity.university_id || user.universityId;
  if (!universityId) throw new ApiError(400, 'يرجى تحديد الجامعة', null, 'UNIVERSITY_REQUIRED');
  const row = await prisma.field_training_supervisor_ratings.create({
    data: {
      university_id: universityId,
      opportunity_id: opportunity.id,
      application_id: applicationId,
      student_id: application.student_id,
      ...data,
      notes: body.notes || null,
      rated_by_id: user.userId,
    },
  });
  return { rating: row };
}

async function listSupervisorRatings(user, applicationId) {
  const application = await prisma.field_training_applications.findUnique({
    where: { id: applicationId },
    include: { field_training_opportunities: true },
  });
  if (!application) throw new ApiError(404, 'Application not found');
  await ftAccess.assertAdminOpportunityAccess(user, application.field_training_opportunities);
  const rows = await prisma.field_training_supervisor_ratings.findMany({
    where: { application_id: applicationId },
    orderBy: { rated_at: 'desc' },
  });
  return { ratings: rows, aggregated: scoring.averageSupervisorRatings(rows.map(mapRatingRow)) };
}

function mapRatingRow(row) {
  return {
    thinkingAndInitiative: row.thinking_and_initiative,
    problemSolving: row.problem_solving,
    teamwork: row.teamwork,
    professionalConduct: row.professional_conduct,
    supervisorCooperation: row.supervisor_cooperation,
    rulesCompliance: row.rules_compliance,
  };
}

async function loadBatchContext(applicationIds) {
  const ids = [...new Set((applicationIds || []).filter(Boolean))];
  if (!ids.length) {
    return { applications: [], byId: new Map() };
  }
  const applications = await prisma.field_training_applications.findMany({
    where: { id: { in: ids } },
    include: {
      field_training_opportunities: {
        include: {
          universities: { select: { id: true, name: true, name_en: true, short_name: true } },
          specialties: { select: { id: true, name_ar: true, name_en: true } },
        },
      },
    },
  });
  const studentIds = [...new Set(applications.map((a) => a.student_id))];
  const opportunityIds = [...new Set(applications.map((a) => a.opportunity_id))];
  const universityIds = [...new Set(applications.map((a) => a.field_training_opportunities?.university_id).filter(Boolean))];

  const instructorIds = [...new Set(applications.map((a) => a.field_training_opportunities?.assigned_instructor_id).filter(Boolean))];
  const [students, tasks, submissions, attendance, ratings, policies, instructorUsers] = await Promise.all([
    ftRepo.findStudentProfilesByIds(studentIds),
    prisma.field_training_tasks.findMany({
      where: { opportunity_id: { in: opportunityIds } },
      select: { id: true, opportunity_id: true, grading_mode: true },
    }),
    prisma.field_training_task_submissions.findMany({
      where: { application_id: { in: ids } },
      select: {
        id: true,
        application_id: true,
        task_id: true,
        review_status: true,
        manual_score: true,
        max_score: true,
        is_late: true,
      },
    }),
    prisma.field_training_attendance.findMany({
      where: { application_id: { in: ids } },
      select: {
        application_id: true,
        session_id: true,
        status: true,
        field_training_sessions: { select: { id: true, start_time: true, end_time: true } },
      },
    }),
    prisma.field_training_supervisor_ratings.findMany({
      where: { application_id: { in: ids } },
      orderBy: { rated_at: 'asc' },
    }),
    universityIds.length
      ? prisma.field_training_evaluation_policies.findMany({
          where: { university_id: { in: universityIds }, is_active: true, archived_at: null },
        })
      : Promise.resolve([]),
    instructorIds.length
      ? prisma.users.findMany({
          where: { id: { in: instructorIds } },
          select: { id: true, full_name: true },
        })
      : Promise.resolve([]),
  ]);

  const studentById = new Map(students.map((s) => [s.id, s]));
  const tasksByOpp = new Map();
  for (const task of tasks) {
    const list = tasksByOpp.get(task.opportunity_id) || [];
    list.push(task);
    tasksByOpp.set(task.opportunity_id, list);
  }
  const subsByApp = new Map();
  for (const sub of submissions) {
    const list = subsByApp.get(sub.application_id) || [];
    list.push(sub);
    subsByApp.set(sub.application_id, list);
  }
  const attByApp = new Map();
  for (const row of attendance) {
    const list = attByApp.get(row.application_id) || [];
    list.push(row);
    attByApp.set(row.application_id, list);
  }
  const ratingsByApp = new Map();
  for (const row of ratings) {
    const list = ratingsByApp.get(row.application_id) || [];
    list.push(row);
    ratingsByApp.set(row.application_id, list);
  }
  const policyByUni = new Map(policies.map((p) => [p.university_id, p]));
  const instructorById = new Map(instructorUsers.map((u) => [u.id, u]));

  const byId = new Map();
  for (const app of applications) {
    const opp = app.field_training_opportunities;
    const student = studentById.get(app.student_id);
    const oppTasks = tasksByOpp.get(app.opportunity_id) || [];
    const appSubs = subsByApp.get(app.id) || [];
    const accepted = appSubs.filter((s) => ACCEPTED_TASK_STATUSES.includes(s.review_status));
    const rejected = appSubs.filter((s) => s.review_status === 'rejected');
    const scorePercents = accepted
      .filter((s) => s.manual_score != null && s.max_score)
      .map((s) => (Number(s.manual_score) / Number(s.max_score)) * 100);
    const att = attByApp.get(app.id) || [];
    const absenceDays = att.filter((r) => r.status === 'absent').length;
    const specialtyName =
      ftRepo.formatSpecialtyLabel(student?.specialty, null) ||
      ftRepo.formatSpecialtyLabel(student?.canonical_specialty, null) ||
      '';
    byId.set(app.id, {
      application: app,
      opportunity: opp,
      student,
      specialtyName,
      tasks: oppTasks,
      submissions: appSubs,
      attendanceRows: att,
      ratings: ratingsByApp.get(app.id) || [],
      policy: mapPolicyRow(policyByUni.get(opp?.university_id) || null),
      instructor: instructorById.get(opp?.assigned_instructor_id) || null,
      scoringInput: {
        attendancePercentage: num(app.attendance_percentage),
        completedHours: num(app.completed_training_hours) || 0,
        requiredHours: num(opp?.required_training_hours),
        absenceDays,
        requiredTaskCount: oppTasks.length,
        acceptedTaskCount: accepted.length,
        rejectedTaskCount: rejected.length,
        lateTaskCount: appSubs.filter((s) => s.is_late).length,
        taskScoreAveragePercent: scorePercents.length
          ? scorePercents.reduce((sum, n) => sum + n, 0) / scorePercents.length
          : null,
        preAssessmentScore: num(app.pre_assessment_score),
        postAssessmentScore: num(app.post_assessment_score),
        supervisorRatings: scoring.averageSupervisorRatings((ratingsByApp.get(app.id) || []).map(mapRatingRow)),
      },
    });
  }
  return { applications, byId };
}

function buildFillFields(ctx, evaluation) {
  return buildFieldTrainingEvaluationTemplatePayload({
    student: ctx.student || {},
    application: ctx.application || {},
    opportunity: ctx.opportunity || {},
    instructor: ctx.instructor,
    attendanceRows: ctx.attendanceRows || [],
    specialtyLabel: ctx.specialtyName,
    evaluation: {
      ...evaluation,
      reasonLabels: GATE_REASON_LABELS_AR,
    },
  });
}

async function persistOfficialUniversityNumber(student = {}) {
  const resolved = resolveOfficialUniversityNumber(student);
  if (!resolved.number || !resolved.persist || !student.id) return resolved.number;
  await prisma.users.update({
    where: { id: student.id },
    data: { university_student_number: resolved.number, updated_at: new Date() },
  });
  return resolved.number;
}

async function persistGeneratedFiles(user, evaluationId, filledDocx, pdfBuffer, filename) {
  const docxFile = await filesService.storePrivateBuffer({
    buffer: filledDocx,
    originalName: filename.replace(/\.pdf$/i, '.docx'),
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    folder: STORAGE_FOLDER,
    user,
    relatedEntityType: 'field_training_final_evaluation',
    relatedEntityId: evaluationId,
  });
  const pdfFile = await filesService.storePrivateBuffer({
    buffer: pdfBuffer,
    originalName: filename,
    mimeType: 'application/pdf',
    folder: STORAGE_FOLDER,
    user,
    relatedEntityType: 'field_training_final_evaluation',
    relatedEntityId: evaluationId,
  });
  return { docxFile, pdfFile };
}

async function generateForApplications(user, applicationIds, { regenerate = false, regenerationReason = null, finalize = true } = {}) {
  const { byId } = await loadBatchContext(applicationIds);
  const contexts = applicationIds.map((id) => byId.get(id)).filter(Boolean);
  for (const ctx of contexts) {
    access.assertCanGenerate(user, ctx.opportunity);
    await ftAccess.assertManageOpportunityAccess(user, ctx.opportunity);
    if (!resolveEvalUniversityId(ctx, user)) {
      throw new ApiError(400, 'الفرصة غير مرتبطة بجامعة', null, 'UNIVERSITY_REQUIRED');
    }
  }

  const templateIds = [...new Set(contexts.map((ctx) => ctx.opportunity.evaluation_template_id).filter(Boolean))];
  const universityIds = [...new Set(contexts.map((ctx) => resolveEvalUniversityId(ctx, user)).filter(Boolean))];
  const [assignedTemplates, defaultTemplates, previousRows] = await Promise.all([
    templateIds.length
      ? prisma.field_training_evaluation_templates.findMany({ where: { id: { in: templateIds } } })
      : Promise.resolve([]),
    universityIds.length
      ? prisma.field_training_evaluation_templates.findMany({
          where: { university_id: { in: universityIds }, is_default: true, is_active: true, archived_at: null },
        })
      : Promise.resolve([]),
    prisma.field_training_final_evaluations.findMany({
      where: { application_id: { in: applicationIds }, is_current: true },
    }),
  ]);
  const assignedById = new Map(assignedTemplates.map((t) => [t.id, t]));
  const defaultByUni = new Map(defaultTemplates.map((t) => [t.university_id, t]));
  const previousByApp = new Map(previousRows.map((row) => [row.application_id, row]));
  const globalFallback = await prisma.field_training_evaluation_templates.findFirst({
    where: { archived_at: null, is_active: true, is_default: true, validation_status: 'valid' },
    orderBy: { created_at: 'desc' },
  });

  function resolveFromCache(opportunity, universityId) {
    const assigned = opportunity.evaluation_template_id
      ? assignedById.get(opportunity.evaluation_template_id)
      : null;
    const universityDefault = universityId ? defaultByUni.get(universityId) : null;
    const fallback =
      globalFallback && universityId && String(globalFallback.university_id) !== String(universityId)
        ? globalFallback
        : universityDefault
          ? null
          : globalFallback;
    return resolveEvaluationTemplate({
      opportunity,
      assignedTemplate: assigned,
      universityDefault,
      globalFallback: fallback,
    });
  }

  const templateFileCache = new Map();
  async function templateBuffer(template) {
    if (templateFileCache.has(template.original_file_id)) return templateFileCache.get(template.original_file_id);
    const loaded = await loadFileBuffer(template.original_file_id);
    templateFileCache.set(template.original_file_id, loaded);
    return loaded;
  }

  const results = [];
  const missingTemplate = [];
  for (const applicationId of applicationIds) {
    const ctx = byId.get(applicationId);
    if (!ctx) continue;
    const universityId = resolveEvalUniversityId(ctx, user);
    const resolved = resolveFromCache(ctx.opportunity, universityId);
    if (!resolved.template || !templateIsUsable(resolved.template)) {
      missingTemplate.push(applicationId);
      results.push({
        applicationId,
        code: resolved.template ? 'TEMPLATE_VALIDATION_FAILED' : TEMPLATE_MISSING_CODE,
        generated: false,
      });
      continue;
    }
    const policy = { ...ctx.policy };
    if (policy.requiredTrainingHours == null) policy.requiredTrainingHours = ctx.scoringInput.requiredHours;
    const calculated = scoring.calculateFinalEvaluation(ctx.scoringInput, policy);
    const autoComment = buildAutoComment(calculated);
    const previous = previousByApp.get(applicationId);
    if (shouldReuseStoredPdf(previous, { regenerate })) {
      results.push({
        applicationId,
        evaluationId: previous.id,
        generated: false,
        reused: true,
        finalStatus: previous.final_status,
      });
      continue;
    }
    const generalComments = previous?.comments_edited_at ? previous.general_comments : autoComment;
    const evaluationDate = previous?.finalized_at || new Date();
    const studentNumber = await persistOfficialUniversityNumber(ctx.student);
    if (studentNumber) ctx.student.university_student_number = studentNumber;
    const fillFields = buildFillFields(ctx, {
      ...calculated,
      generalComments,
      autoComment,
      evaluationDate,
      finalizedAt: evaluationDate,
    });
    if (!fillFields.student_number) {
      results.push({
        applicationId,
        generated: false,
        code: STUDENT_NUMBER_UNRESOLVED_CODE,
        missingFields: ['student_number'],
      });
      continue;
    }
    const missingFields = missingRequiredCompleteFields(fillFields);
    if (missingFields.length) {
      const code = missingFields.some((key) => String(key).startsWith('criterion_'))
        ? PROFESSIONAL_INCOMPLETE_CODE
        : DATA_INCOMPLETE_CODE;
      results.push({
        applicationId,
        generated: false,
        code,
        missingFields,
      });
      continue;
    }
    const version = previous ? (regenerate ? (previous.version || 1) + 1 : previous.version || 1) : 1;
    const payload = {
      university_id: universityId,
      opportunity_id: ctx.opportunity.id,
      student_id: ctx.application.student_id,
      template_id: resolved.template.id,
      template_version: resolved.template.version,
      policy_id: policy.id || null,
      policy_version: policy.version || 1,
      eligibility_status: calculated.eligibilityStatus,
      final_status: calculated.finalStatus,
      eligibility_reasons: calculated.eligibilityReasons,
      attendance_component_score: calculated.attendanceComponentScore,
      tasks_component_score: calculated.tasksComponentScore,
      post_assessment_component_score: calculated.postAssessmentComponentScore,
      professional_component_score: calculated.professionalComponentScore,
      pre_assessment_score: calculated.preAssessmentScore,
      post_assessment_score: calculated.postAssessmentScore,
      improvement_percentage: calculated.improvementPercentage,
      criterion_1_score: calculated.criterion1Score,
      criterion_2_score: calculated.criterion2Score,
      criterion_3_score: calculated.criterion3Score,
      criterion_4_score: calculated.criterion4Score,
      criterion_5_score: calculated.criterion5Score,
      criterion_6_score: calculated.criterion6Score,
      criterion_7_score: calculated.criterion7Score,
      criterion_8_score: calculated.criterion8Score,
      criterion_9_score: calculated.criterion9Score,
      criterion_10_score: calculated.criterion10Score,
      professional_total: calculated.professionalTotal,
      professional_percentage: calculated.professionalPercentage,
      final_score: calculated.finalScore,
      final_percentage: calculated.finalPercentage,
      auto_comment: autoComment,
      general_comments: generalComments,
      score_evidence_json: {
        scoring: ctx.scoringInput,
        templatePayload: identitySnapshot(fillFields),
      },
      is_current: true,
      version,
      regeneration_reason: regenerate ? regenerationReason : null,
      generated_by_id: user.userId,
      generated_at: new Date(),
      finalized_at: finalize ? evaluationDate : previous?.finalized_at || null,
      finalized_by_id: finalize ? user.userId : previous?.finalized_by_id || null,
      updated_at: new Date(),
    };

    let created;
    try {
      created = await upsertCurrentEvaluationRow(applicationId, payload);
    } catch (err) {
      results.push({
        applicationId,
        generated: false,
        code: err?.code || 'EVALUATION_SAVE_FAILED',
        error: err?.message || 'save_failed',
      });
      continue;
    }

    try {
      const { buffer: templateBufferBytes } = await templateBuffer(resolved.template);
      const filledDocx = await fillDocxTemplate(templateBufferBytes, buildPlaceholderMap(fillFields));
      const inspection = await inspectFilledDocx(filledDocx);
      if (inspection.unresolvedPlaceholders.length) {
        results.push({
          applicationId,
          generated: false,
          code: UNRESOLVED_PLACEHOLDERS_CODE,
          error: inspection.unresolvedPlaceholders.join(', '),
        });
        continue;
      }
      const pdfBuffer = await convertFilledDocxToPdf(filledDocx);
      const filename = buildEvaluationPdfFilename({
        studentName: fillFields.student_name,
        universityNumber: fillFields.student_number,
      });
      if (!filename) {
        results.push({
          applicationId,
          generated: false,
          code: STUDENT_NUMBER_UNRESOLVED_CODE,
          missingFields: ['student_number'],
        });
        continue;
      }
      const stored = await persistGeneratedFiles(user, created.id, filledDocx, pdfBuffer, filename);
      await prisma.field_training_final_evaluations.update({
        where: { id: created.id },
        data: {
          pdf_file_id: stored.pdfFile.id,
          filled_docx_file_id: stored.docxFile.id,
          updated_at: new Date(),
        },
      });
      await audit(
        user,
        regenerate ? 'FT_EVAL_REPORT_REGENERATED' : 'FT_EVAL_REPORT_GENERATED',
        'field_training_final_evaluation',
        created.id,
        {
          universityId,
          opportunityId: ctx.opportunity.id,
          studentId: ctx.application.student_id,
          meta: { version, finalStatus: calculated.finalStatus },
        }
      );
      results.push({
        applicationId,
        evaluationId: created.id,
        generated: true,
        finalStatus: calculated.finalStatus,
        filename,
      });
    } catch (err) {
      results.push({
        applicationId,
        evaluationId: created?.id,
        generated: false,
        code: err?.code || PDF_RENDER_FAILED_CODE,
        error: err?.message || 'pdf_failed',
      });
    }
  }
  return { results, missingTemplate };
}

async function generateOne(user, applicationId, options) {
  const out = await generateForApplications(user, [applicationId], options);
  const first = out.results[0];
  if (first?.code === TEMPLATE_MISSING_CODE) {
    throw new ApiError(409, 'لا يوجد قالب تقييم معتمد لهذه الجامعة/الفرصة', null, TEMPLATE_MISSING_CODE);
  }
  if (first?.code === 'TEMPLATE_VALIDATION_FAILED') {
    throw new ApiError(409, 'القالب ناقص الحقول المطلوبة ولا يمكن إنشاء التقرير', null, 'TEMPLATE_VALIDATION_FAILED');
  }
  if (first?.code === DATA_INCOMPLETE_CODE) {
    throw new ApiError(
      422,
      'بيانات الطالب غير مكتملة ولا يمكن إصدار تقرير تقييم رسمي',
      { missingFields: first.missingFields || [] },
      DATA_INCOMPLETE_CODE
    );
  }
  if (first?.code === STUDENT_NUMBER_UNRESOLVED_CODE) {
    throw new ApiError(
      422,
      'لا يمكن إصدار التقرير: الرقم الجامعي غير متوفر. يجب حفظه في الملف الشخصي أو استخراجه من البريد الجامعي الموثّق بصيغة رقم طالب صحيحة.',
      { missingFields: ['student_number'] },
      STUDENT_NUMBER_UNRESOLVED_CODE
    );
  }
  if (first?.code === PROFESSIONAL_INCOMPLETE_CODE) {
    throw new ApiError(
      422,
      'التقييم المهني غير مكتمل. يجب تعبئة المعايير العشرة من 1 إلى 5 دون تكرار أو قيم خارج النطاق.',
      { missingFields: first.missingFields || [] },
      PROFESSIONAL_INCOMPLETE_CODE
    );
  }
  if (first?.code === UNRESOLVED_PLACEHOLDERS_CODE) {
    throw new ApiError(
      422,
      'فشل تجهيز القالب: ما زالت حقول غير مستبدلة في التقرير.',
      { unresolved: first.error },
      UNRESOLVED_PLACEHOLDERS_CODE
    );
  }
  if (first?.code === PDF_RENDER_FAILED_CODE || first?.code === 'PDF_RENDER_FAILED') {
    throw new ApiError(500, 'فشل تحويل التقرير إلى PDF.', { error: first.error }, PDF_RENDER_FAILED_CODE);
  }
  return first;
}

async function generateForOpportunity(user, opportunityId, options = {}) {
  const opportunity = await prisma.field_training_opportunities.findUnique({
    where: { id: opportunityId },
    include: {
      field_training_opportunity_eligibility: {
        where: { is_active: true },
        select: { university_id: true },
        take: 8,
      },
    },
  });
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  access.assertCanGenerate(user, opportunity);
  await ftAccess.assertManageOpportunityAccess(user, opportunity);

  const universityId =
    opportunity.university_id ||
    opportunity.field_training_opportunity_eligibility?.[0]?.university_id ||
    user.universityId ||
    null;
  const template = await findUsableTemplate({ opportunity, universityId, user });
  if (!templateIsUsable(template)) {
    throw new ApiError(
      409,
      template
        ? 'القالب ناقص الحقول المطلوبة ولا يمكن إنشاء التقرير'
        : 'لا يوجد قالب تقييم معتمد لهذه الجامعة/الفرصة',
      template?.validation_json || null,
      template ? 'TEMPLATE_VALIDATION_FAILED' : TEMPLATE_MISSING_CODE
    );
  }

  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunityId, status: 'approved' },
    select: { id: true },
  });
  if (!apps.length) {
    return { results: [], missingTemplate: [], skipped: 'NO_APPROVED_APPLICATIONS' };
  }
  const existing = await prisma.field_training_final_evaluations.findMany({
    where: {
      application_id: { in: apps.map((row) => row.id) },
      is_current: true,
      pdf_file_id: { not: null },
    },
    select: { application_id: true, score_evidence_json: true },
  });
  const complete = new Set(
    existing
      .filter((row) => {
        const snap = row.score_evidence_json?.templatePayload;
        return snap && missingRequiredIdentityFields(snap).length === 0;
      })
      .map((row) => row.application_id)
  );
  const ids = apps.map((row) => row.id).filter((id) => !complete.has(id));
  if (!ids.length) {
    return { results: [], missingTemplate: [], skipped: 'ALL_GENERATED' };
  }
  return generateForApplications(user, ids, options);
}

function mapEvaluationListRow(row) {
  return {
    id: row.id,
    universityId: row.university_id,
    opportunityId: row.opportunity_id,
    applicationId: row.application_id,
    studentId: row.student_id,
    studentName: row.student?.full_name,
    universityNumber: row.student?.university_student_number || '',
    universityName: row.universities?.name,
    opportunityTitle: row.field_training_opportunities?.title,
    trainingStart: row.field_training_opportunities?.start_date,
    trainingEnd: row.field_training_opportunities?.end_date,
    attendance: num(row.attendance_component_score),
    actualHours: num(row.field_training_applications?.completed_training_hours),
    professionalTotal: row.professional_total,
    finalScore: num(row.final_score),
    finalStatus: row.final_status,
    eligibilityStatus: row.eligibility_status,
    eligibilityReasons: row.eligibility_reasons,
    reportStatus: row.pdf_file_id ? 'generated' : 'missing_file',
    generatedAt: row.generated_at,
    templateVersion: row.template_version,
    version: row.version,
    hasPdf: Boolean(row.pdf_file_id),
    applicationStatus: row.field_training_applications?.status || 'approved',
    opportunityStatus: row.field_training_opportunities?.status,
  };
}

async function attachTaskProgressToReportRows(list) {
  const apps = (list || [])
    .filter((row) => row.applicationId && row.opportunityId)
    .map((row) => ({
      id: row.applicationId,
      opportunity_id: row.opportunityId,
      student_id: row.studentId,
      status: row.applicationStatus || 'approved',
      opportunity_status: row.opportunityStatus,
    }));
  if (!apps.length) return list || [];
  const opportunitiesById = new Map();
  for (const row of list) {
    if (row.opportunityId) {
      opportunitiesById.set(row.opportunityId, { status: row.opportunityStatus });
    }
  }
  const progressByApp = await taskProgress.calculateTaskProgressForApplications(apps, {
    opportunitiesById,
  });
  return list.map((row) => ({
    ...row,
    task_progress: row.applicationId ? progressByApp.get(row.applicationId) || null : null,
  }));
}

async function listFinalReports(user, query = {}) {
  const scoped = access.assertCanViewReports(user, query.university_id);
  const universityId = scoped.universityId || query.university_id;
  if (!universityId && !access.isSuperAdmin(user) && !scoped.instructor && !query.opportunity_id) {
    throw new ApiError(400, 'يرجى تحديد الجامعة', null, 'UNIVERSITY_REQUIRED');
  }
  const where = { is_current: true };
  if (universityId) where.university_id = universityId;
  if (query.opportunity_id) where.opportunity_id = query.opportunity_id;
  if (query.final_status) where.final_status = query.final_status;
  if (query.from || query.to) {
    where.generated_at = {};
    if (query.from) where.generated_at.gte = new Date(query.from);
    if (query.to) where.generated_at.lte = new Date(query.to);
  }
  if (scoped.instructor && user.userId) {
    where.field_training_opportunities = { assigned_instructor_id: user.userId };
  }

  const studentFilter = {};
  if (query.student_name) studentFilter.full_name = { contains: query.student_name, mode: 'insensitive' };
  if (query.university_number) studentFilter.university_student_number = { contains: query.university_number, mode: 'insensitive' };
  if (Object.keys(studentFilter).length) where.student = studentFilter;

  if (query.semester || query.academic_year) {
    /* filtered in memory after fetch of opportunity dates — keep SQL lean */
  }

  const generated = query.generated;
  const rows = await prisma.field_training_final_evaluations.findMany({
    where,
    include: {
      student: { select: { id: true, full_name: true, university_student_number: true } },
      universities: { select: { id: true, name: true, short_name: true } },
      field_training_opportunities: {
        select: {
          id: true,
          title: true,
          start_date: true,
          end_date: true,
          assigned_instructor_id: true,
          status: true,
        },
      },
      field_training_applications: { select: { id: true, completed_training_hours: true, status: true } },
    },
    orderBy: { generated_at: 'desc' },
    take: 2000,
  });

  let list = rows.map(mapEvaluationListRow);
  if (query.academic_year) {
    list = list.filter((row) => academicPeriod(row.trainingStart).academicYear === query.academic_year);
  }
  if (query.semester) {
    list = list.filter((row) => academicPeriod(row.trainingStart).semester === query.semester);
  }
  if (generated === 'no') {
    const appWhere = { status: 'approved' };
    if (universityId) appWhere.field_training_opportunities = { university_id: universityId };
    if (query.opportunity_id) appWhere.opportunity_id = query.opportunity_id;
    const apps = await prisma.field_training_applications.findMany({
      where: appWhere,
      include: {
        field_training_opportunities: {
          select: { id: true, title: true, start_date: true, end_date: true, university_id: true, status: true },
        },
      },
      take: 2000,
    });
    const studentIds = [...new Set(apps.map((a) => a.student_id))];
    const students = await prisma.users.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, full_name: true, university_student_number: true },
    });
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const have = new Set(rows.map((r) => r.application_id));
    list = apps
      .filter((a) => !have.has(a.id))
      .map((a) => ({
        id: null,
        applicationId: a.id,
        studentId: a.student_id,
        studentName: studentMap.get(a.student_id)?.full_name,
        universityNumber: studentMap.get(a.student_id)?.university_student_number || '',
        opportunityId: a.opportunity_id,
        opportunityTitle: a.field_training_opportunities?.title,
        trainingStart: a.field_training_opportunities?.start_date,
        trainingEnd: a.field_training_opportunities?.end_date,
        reportStatus: 'not_generated',
        finalStatus: null,
        hasPdf: false,
        applicationStatus: a.status,
        opportunityStatus: a.field_training_opportunities?.status,
      }));
  } else if (generated === 'yes') {
    list = list.filter((row) => row.hasPdf);
  }

  list = await attachTaskProgressToReportRows(list);

  return {
    reports: list,
    capabilities: {
      canGenerate: !access.isReviewer(user),
      canRegenerate: !access.isReviewer(user) && (access.isSuperAdmin(user) || access.isUniversityAdmin(user) || access.isInstructor(user)),
      readOnly: access.isReviewer(user),
      canBulkZip: true,
      canManageTemplates: access.isSuperAdmin(user) || access.isUniversityAdmin(user),
    },
  };
}

async function getEvaluation(user, evaluationId) {
  const row = await prisma.field_training_final_evaluations.findUnique({
    where: { id: evaluationId },
    include: {
      student: { select: { id: true, full_name: true, university_student_number: true } },
      field_training_opportunities: true,
    },
  });
  if (!row) throw new ApiError(404, 'Evaluation not found');
  access.assertCanDownloadEvaluation(user, row);
  if (access.isInstructor(user) && !access.isUniversityAdmin(user) && !access.isSuperAdmin(user) && !access.isReviewer(user)) {
    if (!ftAccess.isAssignedInstructor(user, row.field_training_opportunities)) {
      throw new ApiError(403, access.MSG.instructorUnassigned, null, 'FIELD_TRAINING_FORBIDDEN');
    }
  }
  return row;
}

async function downloadPdf(user, evaluationId) {
  const row = await getEvaluation(user, evaluationId);
  if (!row.pdf_file_id) throw new ApiError(404, 'Report file not found', null, 'REPORT_FILE_MISSING');
  const { file, buffer } = await loadFileBuffer(row.pdf_file_id);
  const snapshotNumber = row.score_evidence_json?.templatePayload?.student_number;
  const filename = buildEvaluationPdfFilename({
    studentName: row.student?.full_name,
    universityNumber: row.student?.university_student_number || snapshotNumber,
    student: row.student,
  });
  if (!filename) {
    throw new ApiError(
      422,
      'لا يمكن تنزيل التقرير: الرقم الجامعي أو اسم الطالب غير صالح لاسم الملف.',
      null,
      STUDENT_NUMBER_UNRESOLVED_CODE
    );
  }
  return { buffer, filename, mimeType: file.mime_type || 'application/pdf' };
}

async function updateComments(user, evaluationId, comments) {
  const row = await getEvaluation(user, evaluationId);
  if (access.isReviewer(user)) throw new ApiError(403, access.MSG.readOnly, null, 'REPORT_READ_ONLY');
  access.assertCanGenerate(user, row.field_training_opportunities);
  const updated = await prisma.field_training_final_evaluations.update({
    where: { id: evaluationId },
    data: {
      general_comments: comments,
      comments_edited_by_id: user.userId,
      comments_edited_at: new Date(),
      updated_at: new Date(),
    },
  });
  return { evaluation: updated };
}

async function bulkZip(user, { evaluationIds = [], applicationIds = [], query = {} }) {
  access.assertCanBulkZip(user, query.university_id);
  let rows = [];
  if (evaluationIds.length) {
    rows = await prisma.field_training_final_evaluations.findMany({
      where: { id: { in: evaluationIds }, is_current: true },
      include: {
        student: { select: { id: true, full_name: true, university_student_number: true } },
        universities: { select: { name: true, short_name: true } },
        field_training_opportunities: { select: { id: true, title: true, start_date: true, assigned_instructor_id: true } },
      },
    });
    if (rows.length !== evaluationIds.length) {
      const found = new Set(rows.map((r) => r.id));
      const missingRequested = evaluationIds.filter((id) => !found.has(id));
      if (missingRequested.length) {
        /* continue; reported as missing */
      }
    }
  } else if (applicationIds.length) {
    rows = await prisma.field_training_final_evaluations.findMany({
      where: { application_id: { in: applicationIds }, is_current: true },
      include: {
        student: { select: { id: true, full_name: true, university_student_number: true } },
        universities: { select: { name: true, short_name: true } },
        field_training_opportunities: { select: { id: true, title: true, start_date: true, assigned_instructor_id: true } },
      },
    });
  } else {
    const listed = await listFinalReports(user, { ...query, generated: 'yes' });
    const ids = listed.reports.filter((r) => r.id && r.hasPdf).map((r) => r.id);
    return bulkZip(user, { evaluationIds: ids, query });
  }

  let assignedIds = null;
  if (access.isInstructor(user) && !access.isUniversityAdmin(user) && !access.isSuperAdmin(user) && !access.isReviewer(user)) {
    const assigned = await prisma.field_training_opportunities.findMany({
      where: { assigned_instructor_id: user.userId },
      select: { id: true },
    });
    assignedIds = new Set(assigned.map((o) => o.id));
  }
  const authorized = access.filterEvaluationsForZip(user, rows, { assignedOpportunityIds: assignedIds });
  if (rows.length && authorized.length !== rows.length) {
    throw new ApiError(403, access.MSG.crossUniversity, null, 'FIELD_TRAINING_UNIVERSITY_FORBIDDEN');
  }
  if (!authorized.length && (evaluationIds.length || applicationIds.length)) {
    throw new ApiError(403, access.MSG.forbidden, null, 'FIELD_TRAINING_FORBIDDEN');
  }

  const selected = authorized;
  const missing = selected.filter((row) => !row.pdf_file_id);
  const withFiles = selected.filter((row) => row.pdf_file_id);
  const statuses = new Set(withFiles.map((row) => row.final_status));
  const mixed = statuses.size > 1;
  const provider = getProvider();
  const files = await prisma.files.findMany({
    where: { id: { in: withFiles.map((r) => r.pdf_file_id) }, deleted_at: null },
    select: { id: true, storage_key: true },
  });
  const fileById = new Map(files.map((f) => [f.id, f]));

  const CHUNK = 15;
  const zipEntries = [];
  const failed = [];
  for (let i = 0; i < withFiles.length; i += CHUNK) {
    const chunk = withFiles.slice(i, i + CHUNK);
    const buffers = await Promise.all(
      chunk.map(async (row) => {
        const file = fileById.get(row.pdf_file_id);
        if (!file) return { row, buffer: null };
        try {
          return { row, buffer: await provider.getObjectBuffer(file.storage_key) };
        } catch {
          return { row, buffer: null };
        }
      })
    );
    for (const item of buffers) {
      if (!item.buffer) failed.push(item.row);
      else {
        zipEntries.push({
          finalStatus: item.row.final_status,
          filename: buildEvaluationPdfFilename({
            studentName: item.row.student?.full_name,
            student: item.row.student,
          }),
          buffer: item.buffer,
        });
      }
    }
  }

  const built = await zipUtil.buildReportsZip(zipEntries, { mixedFolders: mixed });
  const first = authorized[0];
  const filename = zipUtil.buildZipFilename({
    universityName: first?.universities?.short_name || first?.universities?.name,
    opportunityTitle: query.opportunity_id ? first?.field_training_opportunities?.title : 'All',
    academicYear: query.academic_year || academicPeriod(first?.field_training_opportunities?.start_date).academicYear,
  });
  await audit(user, 'FT_EVAL_BULK_ZIP_DOWNLOADED', 'field_training_final_evaluation', null, {
    universityId: first?.university_id || user.universityId,
    meta: { selected: selected.length, included: built.included.length, missing: missing.length, failed: failed.length + built.failed.length },
  });
  return {
    buffer: built.buffer,
    filename,
    summary: {
      selected: selected.length,
      included: built.included.length,
      missing: missing.length,
      failed: failed.length + built.failed.length,
      missingIds: missing.map((r) => r.id),
      failedIds: failed.map((r) => r.id),
    },
  };
}

async function studentOwnPdf(user, applicationId) {
  if (!access.isStudent(user) && !access.isSuperAdmin(user)) {
    throw new ApiError(403, access.MSG.forbidden, null, 'FIELD_TRAINING_FORBIDDEN');
  }
  const row = await prisma.field_training_final_evaluations.findFirst({
    where: { application_id: applicationId, is_current: true },
    include: {
      student: { select: { id: true, full_name: true, university_student_number: true } },
      field_training_opportunities: true,
    },
  });
  if (!row) throw new ApiError(404, 'Evaluation not found');
  if (String(row.student_id) !== String(user.userId) && !access.isSuperAdmin(user)) {
    throw new ApiError(403, access.MSG.studentOwnOnly, null, 'FIELD_TRAINING_FORBIDDEN');
  }
  if (!row.finalized_at || !row.pdf_file_id) {
    throw new ApiError(404, 'Report file not found', null, 'REPORT_FILE_MISSING');
  }
  return downloadPdf(user, row.id);
}

module.exports = {
  listTemplates,
  uploadTemplate,
  setDefaultTemplate,
  getOpportunityTemplateState,
  assignOpportunityTemplate,
  previewTemplate,
  previewApplicationPayload,
  downloadTemplateFile,
  getPolicy,
  upsertPolicy,
  saveSupervisorRating,
  listSupervisorRatings,
  generateForApplications,
  generateForOpportunity,
  generateOne,
  listFinalReports,
  getEvaluation,
  downloadPdf,
  updateComments,
  bulkZip,
  studentOwnPdf,
  resolveTemplate,
  loadBatchContext,
  buildFillFields,
  academicPeriod,
};
