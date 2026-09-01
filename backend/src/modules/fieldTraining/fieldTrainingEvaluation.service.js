'use strict';

const crypto = require('crypto');
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
const {
  convertFilledDocxToPdf,
  findSoffice,
  assertOfficialRendererAvailable,
  getOfficialDocumentRendererStatus,
} = require('./fieldTrainingEvaluation.pdf');
const { preflightEvaluationTemplate } = require('./fieldTrainingEvaluation.preflight');
const { verifyFilledDocxFidelity } = require('./fieldTrainingEvaluation.fidelity');
const { buildFieldTrainingEligibilityReasons, reportEligibilityStatus } = require('./fieldTrainingEvaluation.eligibilityReasons');
const { toMissingFieldEntries } = require('./fieldTrainingEvaluation.missingFields');
const {
  TEMPLATE_MISSING_CODE,
  DATA_INCOMPLETE_CODE,
  STUDENT_NUMBER_UNRESOLVED_CODE,
  UNRESOLVED_PLACEHOLDERS_CODE,
  PDF_RENDER_FAILED_CODE,
  TEMPLATE_FIDELITY_FAIL,
  TEMPLATE_FONT_UNAVAILABLE,
  PROFESSIONAL_INCOMPLETE_CODE,
  GATE_REASONS,
  GATE_REASON_LABELS_AR,
  ACCEPTED_TASK_STATUSES,
  STORAGE_FOLDER,
  DEFAULT_POLICY,
  ALREADY_GENERATED,
  MISSING_REQUIRED_DATA,
  READY_STATUS,
  MANUAL_AUTHORIZED_EVALUATION,
  MANUAL_AUTHORIZED_BULK_RATING,
  BULK_RATING_REASON_AR,
  READY_AUTOMATIC,
  READY_WITH_MANUAL_RATING,
  MISSING_STATIC_DATA,
  MISSING_PROFESSIONAL_EVIDENCE,
  GENERATED_STATUS,
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
  missingFieldEntries,
  publicPreviewPayload,
  identitySnapshot,
  summarizeAttendance,
  shouldReuseStoredPdf,
  templatePayloadHash,
} = require('./fieldTrainingEvaluation.payload');
const ftRepo = require('./fieldTraining.repository');
const zipUtil = require('./fieldTrainingEvaluation.zip');
const taskProgress = require('./fieldTraining.taskProgress');
const readinessMod = require('./fieldTrainingEvaluation.readiness');
const bulkRatingMod = require('./fieldTrainingEvaluation.bulkRating');
const readinessAggregate = require('./fieldTrainingEvaluation.readinessAggregate');
const supervisorScope = require('./fieldTraining.supervisorScope');
const academicSupervisorResolve = require('./fieldTrainingEvaluation.academicSupervisorResolve');
const officialPopulation = require('./fieldTrainingEvaluation.officialPopulation');
const supervisorNames = require('./fieldTraining.supervisorName');
const { buildFieldTrainingStudentPerformanceSnapshot } = require('./fieldTrainingEvaluation.performanceSnapshot');

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function resolveOpportunityUniversityName(opportunity = {}) {
  return (
    opportunity.universities?.name ||
    opportunity.universities?.short_name ||
    opportunity.universities?.name_en ||
    opportunity.field_training_opportunity_eligibility?.[0]?.universities?.name ||
    opportunity.field_training_opportunity_eligibility?.[0]?.universities?.short_name ||
    ''
  );
}

function resolveOpportunityUniversityId(opportunity = {}, user = {}) {
  return (
    opportunity.university_id ||
    opportunity.field_training_opportunity_eligibility?.[0]?.university_id ||
    user.universityId ||
    null
  );
}

function templateIsUsable(template) {
  if (!template || template.archived_at) return false;
  if (template.validation_status === 'valid') return true;
  return template.validation_json?.fillMode === 'label_form';
}

function sourceTemplateFileIdOf(row = {}) {
  return (
    row.source_template_file_id ||
    row.score_evidence_json?.sourceTemplateFileId ||
    null
  );
}

function hasVerifiedFidelityArtifact(row = {}, expectedTemplate = null) {
  const sourceTemplateFileId = sourceTemplateFileIdOf(row);
  const baseVerified = Boolean(
    row.pdf_file_id &&
      sourceTemplateFileId &&
      row.score_evidence_json?.fidelity &&
      Number(row.score_evidence_json?.generatedPageCount) === 2 &&
      row.score_evidence_json?.pdfSha256
  );
  if (!baseVerified) return false;
  const template = expectedTemplate || row.template || null;
  if (!template) return true;
  return Boolean(
    String(row.template_id || '') === String(template.id || '') &&
      Number(row.template_version) === Number(template.version) &&
      String(sourceTemplateFileId) ===
        String(template.original_file_id || template.originalFileId || '')
  );
}

async function stageEvaluationVersion(applicationId, payload, previous = null) {
  return prisma.field_training_final_evaluations.create({
    data: {
      ...payload,
      application_id: applicationId,
      is_current: false,
      supersedes_evaluation_id: previous?.id || null,
    },
  });
}

async function publishEvaluationVersion({ applicationId, stagedId, stored }) {
  return prisma.$transaction(async (tx) => {
    await tx.field_training_final_evaluations.updateMany({
      where: {
        application_id: applicationId,
        is_current: true,
        id: { not: stagedId },
      },
      data: { is_current: false, updated_at: new Date() },
    });
    return tx.field_training_final_evaluations.update({
      where: { id: stagedId },
      data: {
        is_current: true,
        pdf_file_id: stored.pdfFile.id,
        filled_docx_file_id: stored.docxFile.id,
        updated_at: new Date(),
      },
    });
  });
}

async function findUsableTemplate({ opportunity, universityId }) {
  const resolved = await resolveTemplate({ ...opportunity, university_id: universityId });
  return resolved.template || null;
}

function resolveEvalUniversityId(ctx, user) {
  return (
    ctx?.opportunity?.university_id ||
    ctx?.opportunity?.field_training_opportunity_eligibility?.[0]?.university_id ||
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
    version: row.version ?? null,
    versionLabel: row.version != null ? String(row.version) : null,
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
  return resolveEvaluationTemplate({
    opportunity,
    assignedTemplate: assigned,
    universityDefault,
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
  const templatePreflight = labelForm
    ? await preflightEvaluationTemplate(file.buffer, {
        requireStamp: true,
        requireSignature: true,
      })
    : null;
  if (templatePreflight) {
    validation = {
      ...validation,
      valid: Boolean(validation.valid && templatePreflight.ok),
      fillMode: 'label_form',
      preflight: templatePreflight.inspection,
      issues: [
        ...(validation.issues || validation.errors || []),
        ...(templatePreflight.issues || []),
      ],
    };
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
    const opportunity = await prisma.field_training_opportunities.findUnique({
      where: { id: opportunityId },
      include: {
        field_training_opportunity_eligibility: {
          where: { is_active: true },
          select: { university_id: true },
          take: 1,
        },
      },
    });
    if (!opportunity) throw new ApiError(404, 'Opportunity not found');
    await ftAccess.assertAdminOpportunityAccess(user, opportunity);
    const universityId = resolveOpportunityUniversityId(opportunity, user);
    const resolved = await resolveTemplate({ ...opportunity, university_id: universityId });
    const universityDefault = universityId
      ? await prisma.field_training_evaluation_templates.findFirst({
          where: { university_id: universityId, is_default: true, is_active: true, archived_at: null },
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
      resolvedUniversityId: universityId,
      missing: !resolved.template,
      code: !resolved.template ? TEMPLATE_MISSING_CODE : null,
    };
  } catch (err) {
    remapSchemaMismatch(err);
  }
}

async function assignOpportunityTemplate(user, opportunityId, templateId) {
  const opportunity = await prisma.field_training_opportunities.findUnique({
    where: { id: opportunityId },
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
  const universityId = resolveOpportunityUniversityId(opportunity, user);
  if (!templateId) {
    await prisma.field_training_opportunities.update({
      where: { id: opportunityId },
      data: { evaluation_template_id: null, updated_at: new Date() },
    });
    await audit(user, 'FT_EVAL_OPPORTUNITY_OVERRIDE_CHANGED', 'field_training_opportunity', opportunityId, {
      universityId,
      opportunityId,
      meta: { templateId: null },
    });
    return getOpportunityTemplateState(user, opportunityId);
  }
  const template = await prisma.field_training_evaluation_templates.findUnique({ where: { id: templateId } });
  if (!template || template.archived_at) throw new ApiError(404, 'Template not found');
  if (universityId && String(template.university_id) !== String(universityId)) {
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
    universityId,
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
  const preflight = await preflightEvaluationTemplate(buffer, { requireStamp: true, requireSignature: true });
  if (!preflight.ok) {
    return {
      template: mapTemplateRow(row),
      previewMode: 'blocked',
      code: preflight.issues[0]?.code || 'TEMPLATE_VALIDATION_FAILED',
      preflight,
      pdfBase64: null,
      html: '',
    };
  }
  if (!findSoffice()) {
    return {
      template: mapTemplateRow(row),
      previewMode: 'blocked',
      code: 'VISUAL_QA_BLOCKED',
      preflight,
      pdfBase64: null,
      html: '',
    };
  }
  const pdfBuffer = await convertFilledDocxToPdf(buffer, {
    fontIssues: preflight.issues.filter((i) => i.code === TEMPLATE_FONT_UNAVAILABLE),
    expectedPageCount: preflight.inspection.expectedPageCount || 2,
  });
  return {
    template: mapTemplateRow(row),
    previewMode: 'pdf',
    preflight,
    pdfBase64: Buffer.from(pdfBuffer).toString('base64'),
    sourceTemplateFileId: row.original_file_id,
    pageCount: preflight.inspection.expectedPageCount || 2,
    html: '',
  };
}

async function previewApplicationPayload(user, applicationId) {
  const { byId } = await loadBatchContext([applicationId]);
  const ctx = byId.get(applicationId);
  if (!ctx) throw new ApiError(404, 'Application not found');
  const universityId = resolveEvalUniversityId(ctx, user);
  access.assertCanViewReports(user, universityId);
  await ftAccess.assertAdminOpportunityAccess(user, ctx.opportunity);
  const resolved = await resolveTemplate({
    ...ctx.opportunity,
    university_id: universityId,
  });
  const policy = { ...ctx.policy };
  if (policy.requiredTrainingHours == null) policy.requiredTrainingHours = ctx.scoringInput.requiredHours;
  const calculated = scoring.calculateFinalEvaluation(ctx.scoringInput, policy);
  const official = buildOfficialComment(ctx, calculated);
  const evaluationDate = new Date();
  const payload = buildFillFields(
    ctx,
    {
      ...calculated,
      eligibilityStatus: official.eligibilityStatus,
      eligibilityReasons: official.reasons.codes,
      eligibilityReasonLabels: official.reasons.labelsAr,
      generalComments: official.comment,
      autoComment: official.comment,
      evaluationDate,
      fieldSupervisorDate: evaluationDate,
      academicSupervisorDate: evaluationDate,
    },
    resolved.template
  );
  const missing = missingFieldEntries(payload);
  const academicUnassigned = !payload.academic_supervisor_name;
  const readinessInfo = readinessMod.classifyEvaluationReadiness({
    missingFieldEntries: missing,
    criterionEvidence: calculated.criterionEvidence,
    usesManualRating: calculated.usesManualRating,
  });
  return {
    payload: publicPreviewPayload(payload),
    missingFields: missing.map((row) => row.code),
    missingFieldDetails: missing,
    academicSupervisorUnassigned: academicUnassigned,
    canGenerate: Boolean(resolved.template) && missing.length === 0,
    readiness: readinessInfo.readiness,
    readinessCategory: readinessInfo.readinessCategory,
    criterionEvidence: Object.fromEntries(
      Object.entries(calculated.criterionEvidence || {}).map(([key, row]) => [
        key,
        readinessMod.explainCriterionEvidence(key, calculated.criterionEvidence),
      ])
    ),
    performanceSnapshot: calculated.performanceSnapshot,
    missingProfessionalCriteria: readinessMod.missingProfessionalCriteria(calculated.criterionEvidence),
    usesManualRating: calculated.usesManualRating,
    eligibilityStatus: official.eligibilityStatus,
    templateId: resolved.template?.id || null,
    templateVersion: resolved.template?.version || null,
    sourceTemplateFileId: resolved.template?.original_file_id || null,
    templateSource: resolved.source,
    filename: missing.length
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
    include: {
      field_training_opportunities: {
        include: {
          field_training_opportunity_eligibility: {
            where: { is_active: true },
            select: { university_id: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!application) throw new ApiError(404, 'Application not found');
  const opportunity = application.field_training_opportunities;
  access.assertCanGenerate(user, opportunity);
  await ftAccess.assertManageOpportunityAccess(user, opportunity);
  const dbFields = [
    'thinking_and_initiative',
    'problem_solving',
    'teamwork',
    'professional_conduct',
    'supervisor_cooperation',
    'rules_compliance',
  ];
  const camelMap = {
    thinking_and_initiative: 'thinkingAndInitiative',
    problem_solving: 'problemSolving',
    teamwork: 'teamwork',
    professional_conduct: 'professionalConduct',
    supervisor_cooperation: 'supervisorCooperation',
    rules_compliance: 'rulesCompliance',
  };
  const provided = dbFields.filter((field) => body[field] != null && body[field] !== '');
  if (!provided.length) {
    throw new ApiError(400, 'يرجى إدخال تقييم واحد على الأقل', null, 'INVALID_RATING');
  }
  const existingRows = await prisma.field_training_supervisor_ratings.findMany({
    where: { application_id: applicationId },
    orderBy: { rated_at: 'asc' },
  });
  const aggregated = scoring.averageSupervisorRatings(existingRows.map(mapRatingRow)) || {};
  const { byId } = await loadBatchContext([applicationId]);
  const ctx = byId.get(applicationId);
  const policy = { ...ctx?.policy };
  if (policy.requiredTrainingHours == null) policy.requiredTrainingHours = ctx?.scoringInput?.requiredHours;
  const calculated = ctx ? scoring.calculateFinalEvaluation(ctx.scoringInput, policy) : null;
  const derivedMap = {
    thinking_and_initiative: calculated?.criterion3Score,
    problem_solving: calculated?.criterion4Score,
    teamwork: calculated?.criterion6Score,
    professional_conduct: calculated?.criterion7Score,
    supervisor_cooperation: calculated?.criterion8Score,
    rules_compliance: calculated?.criterion10Score,
  };
  const BEHAVIORAL_ONLY_DB_FIELDS = new Set([
    'teamwork',
    'professional_conduct',
    'supervisor_cooperation',
  ]);
  const data = {};
  for (const field of dbFields) {
    if (body[field] != null && body[field] !== '') {
      const n = scoring.clampScore15(body[field]);
      if (n == null) {
        throw new ApiError(400, 'جميع تقييمات المشرف يجب أن تكون من 1 إلى 5', null, 'INVALID_RATING');
      }
      data[field] = n;
      continue;
    }
    const camel = camelMap[field];
    const existing = aggregated[camel];
    const derived = derivedMap[field];
    const fallback = BEHAVIORAL_ONLY_DB_FIELDS.has(field) ? existing : existing ?? derived;
    if (fallback == null) {
      throw new ApiError(
        400,
        'لا يمكن حفظ التقييم الجزئي دون استكمال بقية المعايير السلوكية الناقصة',
        { field },
        'PARTIAL_RATING_INCOMPLETE'
      );
    }
    data[field] = fallback;
  }
  const source = body.source === MANUAL_AUTHORIZED_EVALUATION ? MANUAL_AUTHORIZED_EVALUATION : 'SUPERVISOR';
  const universityId =
    resolveOpportunityUniversityId(ctx?.opportunity || opportunity, user) ||
    resolveOpportunityUniversityId(opportunity, user) ||
    opportunity?.university_id ||
    user.universityId;
  if (!universityId) throw new ApiError(400, 'يرجى تحديد الجامعة', null, 'UNIVERSITY_REQUIRED');
  const row = await prisma.field_training_supervisor_ratings.create({
    data: {
      university_id: universityId,
      opportunity_id: opportunity.id,
      application_id: applicationId,
      student_id: application.student_id,
      ...data,
      notes: [
        source === MANUAL_AUTHORIZED_EVALUATION ? `[${MANUAL_AUTHORIZED_EVALUATION}]` : '',
        provided.length < dbFields.length ? `[PARTIAL:${provided.join(',')}]` : '',
        body.notes || '',
      ]
        .filter(Boolean)
        .join(' ')
        .trim() || null,
      rated_by_id: user.userId,
    },
  });
  await audit(user, 'FT_EVAL_MANUAL_RATING_SAVED', 'field_training_supervisor_rating', row.id, {
    universityId,
    opportunityId: opportunity.id,
    studentId: application.student_id,
    meta: { source, applicationId, providedFields: provided },
  });
  return { rating: row, source, providedFields: provided };
}

async function createSupervisorRatingWithFields(user, applicationId, { fieldsAtFive = [], source, notes, auditAction }) {
  const application = await prisma.field_training_applications.findUnique({
    where: { id: applicationId },
    include: {
      field_training_opportunities: {
        include: {
          field_training_opportunity_eligibility: {
            where: { is_active: true },
            select: { university_id: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!application) throw new ApiError(404, 'Application not found');
  const opportunity = application.field_training_opportunities;
  access.assertCanGenerate(user, opportunity);
  await ftAccess.assertManageOpportunityAccess(user, opportunity);

  const dbFields = bulkRatingMod.DB_SUPERVISOR_FIELDS;
  const camelMap = bulkRatingMod.DB_TO_CAMEL;
  const fieldsToSet = new Set(fieldsAtFive.filter((field) => dbFields.includes(field)));
  if (!fieldsToSet.size) {
    throw new ApiError(400, 'لا توجد حقول تقييم لتعبئتها', null, 'INVALID_RATING');
  }

  const existingRows = await prisma.field_training_supervisor_ratings.findMany({
    where: { application_id: applicationId },
    orderBy: { rated_at: 'asc' },
  });
  const aggregated = scoring.averageSupervisorRatings(existingRows.map(mapRatingRow)) || {};
  const { byId } = await loadBatchContext([applicationId]);
  const ctx = byId.get(applicationId);
  const policy = { ...ctx?.policy };
  if (policy.requiredTrainingHours == null) policy.requiredTrainingHours = ctx?.scoringInput?.requiredHours;
  const calculated = ctx ? scoring.calculateFinalEvaluation(ctx.scoringInput, policy) : null;
  const derivedMap = {
    thinking_and_initiative: calculated?.criterion3Score,
    problem_solving: calculated?.criterion4Score,
    teamwork: calculated?.criterion6Score,
    professional_conduct: calculated?.criterion7Score,
    supervisor_cooperation: calculated?.criterion8Score,
    rules_compliance: calculated?.criterion10Score,
  };
  const BEHAVIORAL_ONLY_DB_FIELDS = new Set(['teamwork', 'professional_conduct', 'supervisor_cooperation']);
  const data = {};
  let overwritten = 0;
  for (const field of dbFields) {
    const camel = camelMap[field];
    const existing = aggregated[camel];
    const derived = derivedMap[field];
    if (fieldsToSet.has(field)) {
      if (existing != null || derived != null) {
        data[field] = existing ?? derived;
        continue;
      }
      data[field] = 5;
      continue;
    }
    const fallback = BEHAVIORAL_ONLY_DB_FIELDS.has(field) ? existing : existing ?? derived;
    if (fallback == null) {
      throw new ApiError(
        400,
        'لا يمكن استكمال التقييم الجزئي دون بقية المعايير المهنية',
        { field, applicationId },
        'PARTIAL_RATING_INCOMPLETE'
      );
    }
    data[field] = fallback;
  }

  const universityId =
    resolveOpportunityUniversityId(ctx?.opportunity || opportunity, user) ||
    resolveOpportunityUniversityId(opportunity, user) ||
    opportunity?.university_id ||
    user.universityId;
  if (!universityId) throw new ApiError(400, 'يرجى تحديد الجامعة', null, 'UNIVERSITY_REQUIRED');
  const row = await prisma.field_training_supervisor_ratings.create({
    data: {
      university_id: universityId,
      opportunity_id: opportunity.id,
      application_id: applicationId,
      student_id: application.student_id,
      ...data,
      notes: notes || null,
      rated_by_id: user.userId,
    },
  });
  await audit(user, auditAction || 'FT_EVAL_MANUAL_RATING_SAVED', 'field_training_supervisor_rating', row.id, {
    universityId,
    opportunityId: opportunity.id,
    studentId: application.student_id,
    meta: { source, applicationId, fieldsAtFive: [...fieldsToSet], overwrittenPrevented: true },
  });
  return { rating: row, source, fieldsAtFive: [...fieldsToSet], overwritten };
}

async function analyzeOpportunityBulkGaps(user, opportunityId, { applicationIds = null } = {}) {
  const opportunity = await prisma.field_training_opportunities.findUnique({
    where: { id: opportunityId },
    include: {
      field_training_opportunity_eligibility: {
        where: { is_active: true },
        select: { university_id: true },
        take: 1,
      },
    },
  });
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  const universityId = resolveOpportunityUniversityId(opportunity, user);
  access.assertCanViewReports(user, universityId);
  await ftAccess.assertAdminOpportunityAccess(user, opportunity);

  const apps = await prisma.field_training_applications.findMany({
    where: {
      opportunity_id: opportunityId,
      status: 'approved',
      ...(Array.isArray(applicationIds) && applicationIds.length ? { id: { in: applicationIds } } : {}),
    },
    select: { id: true },
  });
  const { byId } = await loadBatchContext(apps.map((row) => row.id));
  const students = [];
  for (const app of apps) {
    const ctx = byId.get(app.id);
    if (!ctx) continue;
    const policy = { ...ctx.policy };
    if (policy.requiredTrainingHours == null) policy.requiredTrainingHours = ctx.scoringInput.requiredHours;
    const calculated = scoring.calculateFinalEvaluation(ctx.scoringInput, policy);
    const official = buildOfficialComment(ctx, calculated);
    const payload = buildFillFields(ctx, {
      ...calculated,
      eligibilityStatus: official.eligibilityStatus,
      eligibilityReasons: official.reasons.codes,
      eligibilityReasonLabels: official.reasons.labelsAr,
      generalComments: official.comment,
      autoComment: official.comment,
      evaluationDate: new Date(),
      fieldSupervisorDate: new Date(),
      academicSupervisorDate: new Date(),
    });
    const missing = missingFieldEntries(payload);
    const readinessInfo = readinessMod.classifyEvaluationReadiness({
      missingFieldEntries: missing,
      criterionEvidence: calculated.criterionEvidence,
      usesManualRating: calculated.usesManualRating,
    });
    const analysis = bulkRatingMod.analyzeStudentBulkGaps({
      calculated,
      eligibilityStatus: official.eligibilityStatus,
      studentName: payload.student_name,
      universityNumber: payload.student_number,
      applicationId: app.id,
    });
    students.push({
      ...analysis,
      readinessCategory: readinessInfo.readinessCategory,
      professionalTotal: calculated.professionalTotal,
      criteriaComplete: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(
        (index) => calculated[`criterion${index}Score`] != null
      ).length,
    });
  }
  return {
    opportunityId,
    summary: bulkRatingMod.summarizeBulkPreview(students),
    students,
    capabilities: {
      canApplyBulk: !access.isReviewer(user),
      readOnly: access.isReviewer(user),
    },
  };
}

async function getBulkEligibleRatingPreview(user, opportunityId, query = {}) {
  return analyzeOpportunityBulkGaps(user, opportunityId, {
    applicationIds: query.application_ids,
  });
}

async function applyBulkEligibleProfessionalRatings(user, opportunityId, body = {}) {
  if (body.confirmed !== true) {
    throw new ApiError(
      400,
      'يجب تأكيد اعتماد 5/5 للبنود المهنية الناقصة للطلاب المؤهلين',
      null,
      'BULK_RATING_CONFIRMATION_REQUIRED'
    );
  }
  const opportunity = await prisma.field_training_opportunities.findUnique({
    where: { id: opportunityId },
  });
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  access.assertCanGenerate(user, opportunity);
  await ftAccess.assertManageOpportunityAccess(user, opportunity);

  const preview = await analyzeOpportunityBulkGaps(user, opportunityId, {
    applicationIds: body.application_ids,
  });
  const targets = preview.students.filter((row) => bulkRatingMod.rowEligibleForBulk(row));
  if (!targets.length) {
    return {
      applied: false,
      summary: preview.summary,
      studentsAffected: 0,
      ratingsApplied: 0,
      existingScoresOverwritten: 0,
      notEligibleModified: 0,
      students: [],
    };
  }

  const authorizedRole = access.rolesOf(user).join(',') || 'unknown';
  let ratingsApplied = 0;
  let existingScoresOverwritten = 0;
  const appliedStudents = [];

  for (const target of targets) {
    if (String(target.eligibilityStatus).toUpperCase() !== 'ELIGIBLE') continue;
    const dbFields = target.missingProfessionalCriteria.map((row) => row.dbField);
    const notes = bulkRatingMod.buildBulkRatingNotes(dbFields, body.reason || BULK_RATING_REASON_AR);
    const result = await createSupervisorRatingWithFields(user, target.applicationId, {
      fieldsAtFive: dbFields,
      source: MANUAL_AUTHORIZED_BULK_RATING,
      notes,
      auditAction: 'FT_EVAL_BULK_ELIGIBLE_RATING_SAVED',
    });
    ratingsApplied += dbFields.length;
    existingScoresOverwritten += result.overwritten;
    appliedStudents.push({
      applicationId: target.applicationId,
      studentName: target.studentName,
      universityNumber: target.universityNumber,
      criteriaApplied: target.missingProfessionalCriteria.map((row) => ({
        criterionKey: row.criterionKey,
        labelAr: row.labelAr,
        score: 5,
        source: MANUAL_AUTHORIZED_BULK_RATING,
        previousValue: row.previousValue,
      })),
      ratingId: result.rating.id,
    });
  }

  await audit(user, 'FT_EVAL_BULK_ELIGIBLE_RATING_APPLIED', 'field_training_opportunity', opportunityId, {
    universityId: opportunity.university_id,
    opportunityId,
    meta: {
      studentsAffected: appliedStudents.length,
      ratingsApplied,
      existingScoresOverwritten,
      authorizedRole,
      reason: body.reason || BULK_RATING_REASON_AR,
      applicationIds: appliedStudents.map((row) => row.applicationId),
    },
  });

  const after = await analyzeOpportunityBulkGaps(user, opportunityId, {
    applicationIds: body.application_ids,
  });

  return {
    applied: true,
    summary: after.summary,
    studentsAffected: appliedStudents.length,
    ratingsApplied,
    existingScoresOverwritten,
    notEligibleModified: 0,
    students: appliedStudents,
    readiness: after,
  };
}

async function listSupervisorRatings(user, applicationId) {
  const application = await prisma.field_training_applications.findUnique({
    where: { id: applicationId },
    include: {
      field_training_opportunities: {
        include: {
          field_training_opportunity_eligibility: {
            where: { is_active: true },
            select: { university_id: true },
            take: 1,
          },
        },
      },
    },
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
          field_training_opportunity_eligibility: {
            where: { is_active: true },
            select: {
              university_id: true,
              universities: { select: { id: true, name: true, name_en: true, short_name: true } },
            },
            take: 1,
          },
        },
      },
    },
  });
  const studentIds = [...new Set(applications.map((a) => a.student_id))];
  const opportunityIds = [...new Set(applications.map((a) => a.opportunity_id))];
  const universityIds = [
    ...new Set(
      applications
        .map((a) => resolveOpportunityUniversityId(a.field_training_opportunities))
        .filter(Boolean)
    ),
  ];

  const instructorIds = [...new Set(applications.map((a) => a.field_training_opportunities?.assigned_instructor_id).filter(Boolean))];
  const [students, tasks, submissions, attendance, ratings, policies, instructorUsers, assignmentsByApp, importBatches] =
    await Promise.all([
    ftRepo.findStudentProfilesByIds(studentIds),
    prisma.field_training_tasks.findMany({
      where: { opportunity_id: { in: opportunityIds } },
      select: {
        id: true,
        opportunity_id: true,
        grading_mode: true,
        is_required: true,
      },
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
    supervisorScope.loadAssignmentsByApplicationIds(ids),
    opportunityIds.length
      ? prisma.field_training_supervisor_import_batches.findMany({
          where: { opportunity_id: { in: opportunityIds }, status: 'applied' },
          select: { id: true, preview_json: true, status: true },
          orderBy: { created_at: 'desc' },
        })
      : Promise.resolve([]),
  ]);
  const importSupervisorIndex = academicSupervisorResolve.buildImportSupervisorIndex(importBatches);

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
    const progress = taskProgress.countProgressFromLoadedRows({
      application: app,
      tasks: oppTasks,
      submissions: appSubs,
    });
    const requiredTaskIds = new Set(
      oppTasks
        .filter((task) => taskProgress.isTaskAssignedToStudent(task, app.student_id))
        .map((task) => String(task.id))
    );
    const accepted = appSubs.filter(
      (s) => requiredTaskIds.has(String(s.task_id)) && ACCEPTED_TASK_STATUSES.includes(s.review_status)
    );
    const rejected = appSubs.filter(
      (s) => requiredTaskIds.has(String(s.task_id)) && s.review_status === 'rejected'
    );
    const graded = appSubs.filter(
      (s) =>
        requiredTaskIds.has(String(s.task_id)) &&
        ACCEPTED_TASK_STATUSES.includes(s.review_status) &&
        s.manual_score != null &&
        s.max_score
    );
    const onTimeAccepted = accepted.filter((s) => !s.is_late);
    const scorePercents = graded.map((s) => (Number(s.manual_score) / Number(s.max_score)) * 100);
    const att = attByApp.get(app.id) || [];
    const attendanceSummary = summarizeAttendance(att, app);
    const specialtyName =
      ftRepo.formatSpecialtyLabel(student?.specialty, null) ||
      ftRepo.formatSpecialtyLabel(student?.canonical_specialty, null) ||
      '';
    const scoringInput = {
      applicationId: app.id,
      studentId: app.student_id,
      attendancePercentage: num(app.attendance_percentage),
      attendedDays: attendanceSummary.attendedDays,
      absenceDays: attendanceSummary.absenceDays,
      completedHours: attendanceSummary.actualHours,
      requiredHours: num(opp?.required_training_hours),
      attendanceDataLoaded: attendanceSummary.attendanceDataLoaded,
      hoursDataLoaded: attendanceSummary.hoursDataLoaded,
      latenessTracked: appSubs.some((s) => s.is_late != null),
      lateDays: null,
      violationsTracked: false,
      violationCount: null,
      requiredTaskCount: progress.total_required,
      submittedTaskCount: progress.submitted_required,
      acceptedTaskCount: accepted.length,
      gradedTaskCount: graded.length,
      rejectedTaskCount: rejected.length,
      lateTaskCount: accepted.filter((s) => s.is_late).length,
      onTimeTaskCount: onTimeAccepted.length,
      requiredSubmissionCount: progress.total_required,
      taskCompletionPercent:
        progress.total_required > 0 ? (accepted.length / progress.total_required) * 100 : null,
      taskScoreAveragePercent: scorePercents.length
        ? scorePercents.reduce((sum, n) => sum + n, 0) / scorePercents.length
        : null,
      preAssessmentScore: num(app.pre_assessment_score),
      postAssessmentScore: num(app.post_assessment_score),
      completionEligibilityStatus: app.completion_eligibility_status,
      supervisorRatings: scoring.averageSupervisorRatings((ratingsByApp.get(app.id) || []).map(mapRatingRow)),
      bulkAuthorizedSupervisorFields: bulkRatingMod.bulkAuthorizedSupervisorFields(ratingsByApp.get(app.id) || []),
    };
    const assignment = assignmentsByApp.get(app.id) || null;
    const exclusion = officialPopulation.classifyOfficialReportExclusion({
      student,
      opportunity: opp,
    });
    const supervisorResolved = academicSupervisorResolve.resolveAcademicSupervisorName({
      application: app,
      student,
      assignment,
      importIndex: importSupervisorIndex,
    });
    const applicationForPayload = supervisorResolved.name
      ? {
          ...app,
          academic_supervisor_name: supervisorResolved.name,
        }
      : app;
    byId.set(app.id, {
      application: applicationForPayload,
      applicationRaw: app,
      academicSupervisorResolved: supervisorResolved,
      officialReportExcluded: exclusion,
      opportunity: opp,
      student,
      specialtyName,
      tasks: oppTasks,
      submissions: appSubs,
      attendanceRows: att,
      ratings: ratingsByApp.get(app.id) || [],
      policy: mapPolicyRow(policyByUni.get(resolveOpportunityUniversityId(opp)) || null),
      instructor: instructorById.get(opp?.assigned_instructor_id) || null,
      scoringInput,
      performanceSnapshot: buildFieldTrainingStudentPerformanceSnapshot(scoringInput, mapPolicyRow(policyByUni.get(resolveOpportunityUniversityId(opp)) || null)),
    });
  }
  return { applications, byId };
}

function buildFillFields(ctx, evaluation, template = null) {
  const templateConfig = {
    fillMode: template?.validation_json?.fillMode || ctx.template?.validation_json?.fillMode,
    trainingHoursDisplayMode:
      template?.validation_json?.trainingHoursDisplayMode ||
      ctx.template?.validation_json?.trainingHoursDisplayMode,
    mutahOfficial: Boolean(template?.validation_json?.fillMode === 'label_form' || ctx.template?.validation_json?.fillMode === 'label_form'),
  };
  return buildFieldTrainingEvaluationTemplatePayload({
    student: ctx.student || {},
    application: ctx.application || {},
    opportunity: ctx.opportunity || {},
    instructor: ctx.instructor,
    attendanceRows: ctx.attendanceRows || [],
    specialtyLabel: ctx.specialtyName,
    academicSupervisorName:
      ctx.academicSupervisorResolved?.name || ctx.application?.academic_supervisor_name || null,
    templateConfig,
    evaluation: {
      ...evaluation,
      reasonLabels: GATE_REASON_LABELS_AR,
    },
  });
}

function buildOfficialComment(ctx, calculated) {
  const storedStatus = ctx.application?.completion_eligibility_status;
  let eligibilityStatus;
  if (storedStatus) {
    eligibilityStatus = reportEligibilityStatus(ctx.application);
  } else {
    const scoringReasons = (calculated.eligibilityReasons || []).filter(
      (code) => code !== GATE_REASONS.PROFESSIONAL_EVALUATION_INCOMPLETE
    );
    eligibilityStatus = scoringReasons.length ? 'NOT_ELIGIBLE' : 'ELIGIBLE';
  }
  const reasons = buildFieldTrainingEligibilityReasons({
    application: ctx.application,
    evidence: {
      attendancePercentage: ctx.scoringInput?.attendancePercentage,
      minimumAttendancePercentage: ctx.opportunity?.minimum_attendance_percentage,
      completedHours: ctx.scoringInput?.completedHours,
      requiredHours: ctx.scoringInput?.requiredHours,
      requiredTaskCount: ctx.scoringInput?.requiredTaskCount,
      acceptedTaskCount: ctx.scoringInput?.acceptedTaskCount,
    },
  });
  return {
    eligibilityStatus,
    reasons,
    comment: buildAutoComment(
      { ...calculated, eligibilityStatus, eligibilityReasonLabels: reasons.labelsAr },
      { eligibilityStatus, reasonLabels: reasons.labelsAr }
    ),
  };
}

function officialUniversityNumber(student = {}) {
  return resolveOfficialUniversityNumber(student).number;
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

  function resolveFromCache(opportunity, universityId) {
    const assigned = opportunity.evaluation_template_id
      ? assignedById.get(opportunity.evaluation_template_id)
      : null;
    const universityDefault = universityId ? defaultByUni.get(universityId) : null;
    return resolveEvaluationTemplate({
      opportunity,
      assignedTemplate: assigned,
      universityDefault,
    });
  }

  const templateFileCache = new Map();
  const templatePreflightCache = new Map();
  async function templateBuffer(template) {
    if (templateFileCache.has(template.original_file_id)) return templateFileCache.get(template.original_file_id);
    const loaded = await loadFileBuffer(template.original_file_id);
    templateFileCache.set(template.original_file_id, loaded);
    return loaded;
  }
  async function templatePreflight(template) {
    if (templatePreflightCache.has(template.id)) return templatePreflightCache.get(template.id);
    const { buffer } = await templateBuffer(template);
    const result = await preflightEvaluationTemplate(buffer, { requireStamp: true, requireSignature: true });
    templatePreflightCache.set(template.id, result);
    return result;
  }

  const uniqueTemplates = [];
  const seenTemplates = new Set();
  for (const ctx of contexts) {
    const resolved = resolveFromCache(ctx.opportunity, resolveEvalUniversityId(ctx, user));
    if (resolved.template && !seenTemplates.has(resolved.template.id)) {
      seenTemplates.add(resolved.template.id);
      uniqueTemplates.push(resolved.template);
    }
  }
  for (const template of uniqueTemplates) {
    const preflight = await templatePreflight(template);
    if (!preflight.ok) {
      const issue = preflight.issues[0] || {};
      throw new ApiError(
        409,
        issue.messageAr || 'تعذر التحقق من قالب التقييم.',
        { issues: preflight.issues, inspection: preflight.inspection },
        issue.code || 'TEMPLATE_VALIDATION_FAILED'
      );
    }
  }
  if (uniqueTemplates.length) assertOfficialRendererAvailable();

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
    const official = buildOfficialComment(ctx, calculated);
    const previous = previousByApp.get(applicationId);
    const evaluationDate =
      previous && !regenerate && hasVerifiedFidelityArtifact(previous)
        ? previous.finalized_at || previous.generated_at || new Date()
        : new Date();
    const studentNumber = officialUniversityNumber(ctx.student);
    if (studentNumber) ctx.student.university_student_number = studentNumber;
    const generalComments = previous?.comments_edited_at ? previous.general_comments : official.comment;
    const fillFields = buildFillFields(
      ctx,
      {
        ...calculated,
        eligibilityStatus: official.eligibilityStatus,
        eligibilityReasons: official.reasons.codes,
        eligibilityReasonLabels: official.reasons.labelsAr,
        generalComments,
        autoComment: official.comment,
        evaluationDate,
        fieldSupervisorDate: evaluationDate,
        academicSupervisorDate: evaluationDate,
        finalizedAt: evaluationDate,
      },
      resolved.template
    );
    const sourceHash = templatePayloadHash(fillFields, resolved.template);
    if (shouldReuseStoredPdf(previous, { regenerate, sourceHash })) {
      results.push({
        applicationId,
        evaluationId: previous.id,
        generated: false,
        reused: true,
        code: ALREADY_GENERATED,
        finalStatus: previous.final_status,
        eligibilityStatus: previous.eligibility_status,
      });
      continue;
    }
    if (!fillFields.student_number) {
      results.push({
        applicationId,
        studentName: fillFields.student_name,
        universityNumber: fillFields.student_number,
        generated: false,
        code: STUDENT_NUMBER_UNRESOLVED_CODE,
        missingFields: ['STUDENT_NUMBER_MISSING'],
        missingFieldDetails: toMissingFieldEntries(['student_number']),
      });
      continue;
    }
    const missingFields = missingRequiredCompleteFields(fillFields);
    if (missingFields.length) {
      const details = missingFieldEntries(fillFields);
      const code = missingFields.some((key) => String(key).startsWith('criterion_'))
        ? PROFESSIONAL_INCOMPLETE_CODE
        : DATA_INCOMPLETE_CODE;
      results.push({
        applicationId,
        studentName: fillFields.student_name,
        universityNumber: fillFields.student_number,
        generated: false,
        code,
        readiness: MISSING_REQUIRED_DATA,
        missingFields: details.map((row) => row.code),
        missingFieldDetails: details,
      });
      continue;
    }
    const version = previous ? (previous.version || 1) + 1 : 1;
    let created;
    try {
      const preflight = await templatePreflight(resolved.template);
      if (!preflight.ok) {
        const issue = preflight.issues[0] || {};
        throw new ApiError(
          409,
          issue.messageAr || 'تعذر التحقق من قالب التقييم.',
          { issues: preflight.issues, inspection: preflight.inspection },
          issue.code || 'TEMPLATE_VALIDATION_FAILED'
        );
      }
      const {
        file: sourceTemplateFile,
        buffer: templateBufferBytes,
      } = await templateBuffer(resolved.template);
      const isolatedTemplate = Buffer.from(templateBufferBytes);
      const isolatedPayload = JSON.parse(JSON.stringify(fillFields));
      const filledDocx = await fillDocxTemplate(isolatedTemplate, buildPlaceholderMap(isolatedPayload));
      const inspection = await inspectFilledDocx(filledDocx);
      if (inspection.unresolvedPlaceholders.length) {
        throw new ApiError(
          422,
          'تعذر إنشاء التقرير من قالب الجامعة الرسمي. لم يتم إنشاء تقرير بديل.',
          { unresolvedPlaceholders: inspection.unresolvedPlaceholders },
          UNRESOLVED_PLACEHOLDERS_CODE
        );
      }
      const fidelity = await verifyFilledDocxFidelity({
        templateBuffer: isolatedTemplate,
        filledBuffer: filledDocx,
        payload: isolatedPayload,
      });
      const expectedPageCount = preflight.inspection.expectedPageCount || 2;
      const pdfBuffer = await convertFilledDocxToPdf(filledDocx, {
        fontIssues: preflight.issues.filter((row) => row.code === TEMPLATE_FONT_UNAVAILABLE),
        expectedPageCount,
      });
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

      const payload = {
        university_id: universityId,
        opportunity_id: ctx.opportunity.id,
        student_id: ctx.application.student_id,
        template_id: resolved.template.id,
        template_version: resolved.template.version,
        source_template_file_id: sourceTemplateFile.id,
        policy_id: policy.id || null,
        policy_version: policy.version || 1,
        eligibility_status: official.eligibilityStatus,
        final_status:
          official.eligibilityStatus === 'ELIGIBLE'
            ? calculated.finalStatus
            : 'NOT_ELIGIBLE',
        eligibility_reasons: official.reasons.items.map((item) => ({
          code: item.code,
          text: item.text,
        })),
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
        auto_comment: official.comment,
        general_comments: generalComments,
        score_evidence_json: {
          scoring: ctx.scoringInput,
          performanceSnapshot: calculated.performanceSnapshot,
          criterionEvidence: calculated.criterionEvidence,
          templatePayload: identitySnapshot(fillFields),
          sourceHash,
          templateId: resolved.template.id,
          templateVersion: resolved.template.version,
          sourceTemplateFileId: sourceTemplateFile.id,
          sourceTemplateSha256: fidelity.sourceTemplateSha256,
          filledDocxSha256: fidelity.filledDocxSha256,
          pdfSha256: sha256Buffer(pdfBuffer),
          expectedPageCount,
          generatedPageCount: expectedPageCount,
          fidelity: {
            mediaPreserved: fidelity.mediaPreserved,
            tableGeometryPreserved: fidelity.tableGeometryPreserved,
            pageGeometryPreserved: fidelity.pageGeometryPreserved,
          },
          generatedAt: new Date().toISOString(),
          academic_supervisor_name: fillFields.academic_supervisor_name,
          field_supervisor_name: fillFields.field_supervisor_name,
        },
        version,
        regeneration_reason: previous
          ? regenerationReason || (regenerate ? 'MANUAL_REGENERATION' : 'SOURCE_OR_TEMPLATE_CHANGED')
          : null,
        generated_by_id: user.userId,
        generated_at: new Date(),
        finalized_at: finalize ? evaluationDate : previous?.finalized_at || null,
        finalized_by_id: finalize ? user.userId : previous?.finalized_by_id || null,
        updated_at: new Date(),
      };

      created = await stageEvaluationVersion(applicationId, payload, previous);
      const stored = await persistGeneratedFiles(user, created.id, filledDocx, pdfBuffer, filename);
      await publishEvaluationVersion({
        applicationId,
        stagedId: created.id,
        stored,
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
        finalStatus: official.eligibilityStatus === 'ELIGIBLE' ? calculated.finalStatus : 'NOT_ELIGIBLE',
        eligibilityStatus: official.eligibilityStatus,
        filename,
        templateId: resolved.template.id,
        templateVersion: resolved.template.version,
        sourceTemplateFileId: sourceTemplateFile.id,
        pageCount: expectedPageCount,
      });
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.code === TEMPLATE_FONT_UNAVAILABLE || err.code === 'TEMPLATE_VALIDATION_FAILED')
      ) {
        throw err;
      }
      results.push({
        applicationId,
        evaluationId: created?.id,
        generated: false,
        code: err?.code || PDF_RENDER_FAILED_CODE,
        error: err?.message || 'pdf_failed',
        details: err?.details || null,
      });
    }
  }
  return summarizeGeneration(results, missingTemplate);
}

function summarizeGeneration(results = [], missingTemplate = []) {
  const missingData = results.filter((row) => row.readiness === MISSING_REQUIRED_DATA || row.code === DATA_INCOMPLETE_CODE || row.code === PROFESSIONAL_INCOMPLETE_CODE || row.code === STUDENT_NUMBER_UNRESOLVED_CODE);
  const generated = results.filter((row) => row.generated);
  const alreadyGenerated = results.filter((row) => row.reused || row.code === ALREADY_GENERATED);
  const failed = results.filter(
    (row) =>
      row.generated === false &&
      !row.reused &&
      row.code !== DATA_INCOMPLETE_CODE &&
      row.code !== PROFESSIONAL_INCOMPLETE_CODE &&
      row.code !== STUDENT_NUMBER_UNRESOLVED_CODE &&
      row.code !== ALREADY_GENERATED
  );
  return {
    results,
    missingTemplate,
    summary: {
      total: results.length,
      ready: generated.length + alreadyGenerated.length + missingData.length === results.length
        ? results.length - missingData.length - failed.length
        : generated.length + alreadyGenerated.length,
      generated: generated.length,
      alreadyGenerated: alreadyGenerated.length,
      missingData: missingData.length,
      failed: failed.length,
    },
    missingStudents: missingData.map((row) => ({
      applicationId: row.applicationId,
      studentName: row.studentName || '',
      universityNumber: row.universityNumber || '',
      missingFields: row.missingFieldDetails || toMissingFieldEntries(row.missingFields || []),
    })),
  };
}

async function generateOne(user, applicationId, options) {
  const out = await generateForApplications(user, [applicationId], options);
  const first = out.results[0];
  if (first?.code === TEMPLATE_MISSING_CODE) {
    throw new ApiError(409, 'لا يوجد قالب تقييم معتمد لهذه الجامعة/الفرصة', null, TEMPLATE_MISSING_CODE);
  }
  if (first?.code === TEMPLATE_FONT_UNAVAILABLE) {
    throw new ApiError(409, first.error || 'الخط المستخدم في القالب غير متوفر', first.missingFieldDetails, TEMPLATE_FONT_UNAVAILABLE);
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
  if (first?.code === TEMPLATE_FIDELITY_FAIL) {
    throw new ApiError(
      422,
      'تعذر إنشاء التقرير من قالب الجامعة الرسمي. لم يتم إنشاء تقرير بديل.',
      first.details || { error: first.error },
      TEMPLATE_FIDELITY_FAIL
    );
  }
  if (first?.code === PDF_RENDER_FAILED_CODE || first?.code === 'PDF_RENDER_FAILED') {
    throw new ApiError(
      500,
      'تعذر إنشاء التقرير من قالب الجامعة الرسمي. لم يتم إنشاء تقرير بديل.',
      first.details || { error: first.error },
      PDF_RENDER_FAILED_CODE
    );
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
    return { results: [], missingTemplate: [], skipped: 'NO_APPROVED_APPLICATIONS', summary: { total: 0, ready: 0, generated: 0, alreadyGenerated: 0, missingData: 0, failed: 0 } };
  }
  return generateForApplications(user, apps.map((row) => row.id), options);
}

function mapEvaluationListRow(row) {
  const sourceTemplateFileId = sourceTemplateFileIdOf(row);
  const fidelityVerified = hasVerifiedFidelityArtifact(row);
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
    actualHours:
      num(row.score_evidence_json?.templatePayload?.actual_training_hours) ??
      num(row.field_training_applications?.completed_training_hours),
    professionalTotal: row.professional_total,
    finalScore: num(row.final_score),
    finalStatus: row.final_status,
    eligibilityStatus: row.eligibility_status,
    academicSupervisorName:
      row.field_training_applications?.academic_supervisor_name ||
      row.score_evidence_json?.academic_supervisor_name ||
      '',
    eligibilityReasons: row.eligibility_reasons,
    reportStatus: !row.pdf_file_id
      ? 'missing_file'
      : fidelityVerified
        ? 'generated'
        : 'fidelity_unverified',
    generatedAt: row.generated_at,
    templateId: row.template_id,
    templateVersion: row.template_version,
    sourceTemplateFileId,
    pageCount: row.score_evidence_json?.generatedPageCount || null,
    fidelityStatus: fidelityVerified
      ? 'PASS'
      : row.pdf_file_id
        ? 'LEGACY_UNVERIFIED'
        : 'MISSING_ARTIFACT',
    version: row.version,
    hasPdf: fidelityVerified,
    hasStoredPdf: Boolean(row.pdf_file_id),
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
  Object.assign(where, require('./fieldTraining.supervisorScope').evaluationSupervisorWhere(user));

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
      field_training_applications: { select: { id: true, completed_training_hours: true, status: true, academic_supervisor_name: true } },
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
    const appWhere = { status: 'approved', ...require('./fieldTraining.supervisorScope').applicationSupervisorWhere(user) };
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
      template: { select: { id: true, version: true, original_file_id: true } },
    },
  });
  if (!row) throw new ApiError(404, 'Evaluation not found');
  access.assertCanDownloadEvaluation(user, row);
  await require('./fieldTraining.supervisorScope').assertReviewerCanAccessApplication(user, {
    id: row.application_id,
  });
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
  const recordedSourceFileId = sourceTemplateFileIdOf(row);
  const verifiedFidelityArtifact = hasVerifiedFidelityArtifact(row, row.template);
  if (!verifiedFidelityArtifact) {
    throw new ApiError(
      409,
      'هذا التقرير قديم أو لم يجتز فحص مطابقة قالب الجامعة الرسمي. يجب إعادة إصداره من القالب الحالي.',
      {
        templateId: row.template_id,
        templateVersion: row.template_version,
        sourceTemplateFileId: recordedSourceFileId,
      },
      'EVALUATION_ARTIFACT_FIDELITY_UNVERIFIED'
    );
  }
  if (
    recordedSourceFileId &&
    row.template?.original_file_id &&
    String(recordedSourceFileId) !== String(row.template.original_file_id)
  ) {
    throw new ApiError(
      409,
      'تعذر التحقق من أن التقرير ناتج عن نسخة القالب الرسمية المسجلة.',
      {
        templateId: row.template_id,
        templateVersion: row.template_version,
        sourceTemplateFileId: recordedSourceFileId,
      },
      'EVALUATION_ARTIFACT_TEMPLATE_MISMATCH'
    );
  }
  const { file, buffer } = await loadFileBuffer(row.pdf_file_id);
  if (sha256Buffer(buffer) !== row.score_evidence_json.pdfSha256) {
    throw new ApiError(
      409,
      'تعذر التحقق من سلامة ملف التقرير الرسمي المخزن.',
      { evaluationId: row.id },
      'EVALUATION_ARTIFACT_HASH_MISMATCH'
    );
  }
  const snapshot = row.score_evidence_json?.templatePayload || {};
  const snapshotNumber = row.score_evidence_json?.templatePayload?.student_number;
  const filename = buildEvaluationPdfFilename({
    studentName: snapshot.student_name || row.student?.full_name,
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
  return {
    buffer,
    filename,
    mimeType: file.mime_type || 'application/pdf',
    templateId: row.template_id,
    templateVersion: row.template_version,
    sourceTemplateFileId: recordedSourceFileId || row.template?.original_file_id || null,
  };
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
        field_training_applications: { select: { academic_supervisor_name: true } },
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
        field_training_applications: { select: { academic_supervisor_name: true } },
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
  const missing = selected.filter((row) => !hasVerifiedFidelityArtifact(row));
  const withFiles = selected.filter((row) => hasVerifiedFidelityArtifact(row));
  if (!withFiles.length) {
    throw new ApiError(
      404,
      'لا توجد تقارير تقييم جاهزة للتنزيل.',
      { totalStudents: selected.length, generatedReports: 0, missingReports: missing.length || selected.length },
      'NO_GENERATED_REPORTS'
    );
  }
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
          const buffer = await provider.getObjectBuffer(file.storage_key);
          if (sha256Buffer(buffer) !== row.score_evidence_json?.pdfSha256) {
            return { row, buffer: null };
          }
          return { row, buffer };
        } catch {
          return { row, buffer: null };
        }
      })
    );
    for (const item of buffers) {
      if (!item.buffer) failed.push(item.row);
      else {
        const snapshot = item.row.score_evidence_json?.templatePayload || {};
        zipEntries.push({
          universityName: item.row.universities?.name || item.row.universities?.short_name,
          academicSupervisorName:
            item.row.field_training_applications?.academic_supervisor_name ||
            item.row.score_evidence_json?.academic_supervisor_name ||
            '',
          eligibilityStatus: item.row.eligibility_status,
          studentName: snapshot.student_name || item.row.student?.full_name,
          universityNumber:
            snapshot.student_number || item.row.student?.university_student_number,
          filename: buildEvaluationPdfFilename({
            studentName: snapshot.student_name || item.row.student?.full_name,
            universityNumber:
              snapshot.student_number || item.row.student?.university_student_number,
            student: item.row.student,
          }),
          buffer: item.buffer,
        });
      }
    }
  }

  const built = await zipUtil.buildReportsZip(zipEntries, { officialFolders: true, mixedFolders: false });
  const first = authorized[0];
  const filename = zipUtil.buildZipFilename({
    universityName: first?.universities?.name || first?.universities?.short_name,
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

async function getOpportunityReportReadiness(user, opportunityId) {
  const opportunity = await prisma.field_training_opportunities.findUnique({
    where: { id: opportunityId },
    include: {
      universities: { select: { id: true, name: true, name_en: true, short_name: true } },
      field_training_opportunity_eligibility: {
        where: { is_active: true },
        select: {
          university_id: true,
          universities: { select: { id: true, name: true, name_en: true, short_name: true } },
        },
        take: 8,
      },
    },
  });
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  const universityId = resolveOpportunityUniversityId(opportunity, user);
  access.assertCanViewReports(user, universityId);
  await ftAccess.assertAdminOpportunityAccess(user, opportunity);

  const resolved = await resolveTemplate({ ...opportunity, university_id: universityId });
  let templatePreflight = null;
  if (resolved.template?.original_file_id) {
    try {
      const { buffer } = await loadFileBuffer(resolved.template.original_file_id);
      templatePreflight = await preflightEvaluationTemplate(buffer, { requireStamp: true, requireSignature: true });
    } catch (err) {
      templatePreflight = {
        ok: false,
        issues: [{ code: err?.code || 'TEMPLATE_UNREADABLE', messageAr: err?.message || 'تعذر قراءة القالب.' }],
      };
    }
  } else {
    templatePreflight = {
      ok: false,
      issues: [
        {
          code: TEMPLATE_MISSING_CODE,
          messageAr: 'لا يوجد قالب تقييم معتمد لهذه الجامعة/الفرصة.',
        },
      ],
    };
  }
  if (templatePreflight?.ok && !findSoffice()) {
    templatePreflight = {
      ...templatePreflight,
      ok: false,
      issues: [
        ...(templatePreflight.issues || []),
        {
          code: readinessAggregate.RENDERER_NOT_AVAILABLE,
          messageAr: 'تعذر إنشاء التقرير من قالب الجامعة الرسمي. لم يتم إنشاء تقرير بديل.',
        },
      ],
    };
  }

  const templateReadiness = await readinessAggregate.buildTemplateGenerationReadiness({
    template: resolved.template,
    templatePreflight,
    loadFileBuffer,
  });

  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunityId, status: 'approved' },
    select: {
      id: true,
      student_id: true,
      training_status: true,
      completion_eligibility_status: true,
    },
  });
  const { byId } = await loadBatchContext(apps.map((row) => row.id));
  const skippedAppIds = apps.filter((app) => !byId.get(app.id)).map((app) => app.id);
  const existing = await prisma.field_training_final_evaluations.findMany({
    where: { application_id: { in: apps.map((row) => row.id) }, is_current: true },
    select: {
      application_id: true,
      pdf_file_id: true,
      eligibility_status: true,
      final_status: true,
      template_id: true,
      template_version: true,
      source_template_file_id: true,
      score_evidence_json: true,
    },
  });
  const existingByApp = new Map(existing.map((row) => [row.application_id, row]));

  const students = [];
  const excludedOfficial = [];
  for (const app of apps) {
    const ctx = byId.get(app.id);
    if (!ctx) continue;
    if (ctx.officialReportExcluded?.excluded) {
      excludedOfficial.push({
        applicationId: app.id,
        studentName: ctx.student?.full_name || ctx.student?.name,
        code: ctx.officialReportExcluded.code,
        reason: ctx.officialReportExcluded.reason,
      });
      continue;
    }
    const policy = { ...ctx.policy };
    if (policy.requiredTrainingHours == null) policy.requiredTrainingHours = ctx.scoringInput.requiredHours;
    const calculated = scoring.calculateFinalEvaluation(ctx.scoringInput, policy);
    const official = buildOfficialComment(ctx, calculated);
    const evaluationDate = new Date();
    const payload = buildFillFields(ctx, {
      ...calculated,
      eligibilityStatus: official.eligibilityStatus,
      eligibilityReasons: official.reasons.codes,
      eligibilityReasonLabels: official.reasons.labelsAr,
      generalComments: official.comment,
      autoComment: official.comment,
      evaluationDate,
      fieldSupervisorDate: evaluationDate,
      academicSupervisorDate: evaluationDate,
    }, resolved.template);
    const missing = missingFieldEntries(payload);
    const generatedRow = existingByApp.get(app.id);
    const artifactMatchesCurrentTemplate = hasVerifiedFidelityArtifact(
      generatedRow,
      resolved.template
    );
    const readinessInfo = readinessMod.classifyEvaluationReadiness({
      missingFieldEntries: missing,
      criterionEvidence: calculated.criterionEvidence,
      generated: artifactMatchesCurrentTemplate,
      usesManualRating: calculated.usesManualRating,
    });
    const bulkAnalysis = bulkRatingMod.analyzeStudentBulkGaps({
      calculated,
      eligibilityStatus: official.eligibilityStatus,
      studentName: payload.student_name,
      universityNumber: payload.student_number,
      applicationId: app.id,
    });
    students.push({
      applicationId: app.id,
      studentId: ctx.application.student_id,
      studentName: payload.student_name,
      universityNumber: payload.student_number,
      academicSupervisorName: payload.academic_supervisor_name,
      eligibilityStatus: official.eligibilityStatus,
      readiness: readinessInfo.readiness,
      readinessCategory: readinessInfo.readinessCategory,
      missingFields: missing.map((row) => row.code),
      missingFieldDetails: missing,
      staticMissingFields: readinessInfo.staticMissing,
      professionalMissingFields: readinessInfo.professionalMissing,
      missingProfessionalCriteria: bulkAnalysis.missingProfessionalCriteria,
      missingBulkCriteria: bulkAnalysis.missingProfessionalCriteria,
      ratingsToApply: bulkAnalysis.ratingsToApply,
      eligibleForBulk: bulkAnalysis.eligibleForBulk,
      bulkEligibleForApproval: bulkAnalysis.eligibleForBulk,
      automaticallyDerivedCriteria: bulkAnalysis.automaticallyDerived,
      criteriaComplete: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(
        (index) => calculated[`criterion${index}Score`] != null
      ).length,
      professionalTotal: calculated.professionalTotal,
      criterionEvidence: Object.fromEntries(
        Object.entries(calculated.criterionEvidence || {}).map(([key]) => [
          key,
          readinessMod.explainCriterionEvidence(key, calculated.criterionEvidence),
        ])
      ),
      usesManualRating: calculated.usesManualRating,
      generated: artifactMatchesCurrentTemplate,
      artifactMatchesCurrentTemplate,
      generatedArtifactStatus: !generatedRow?.pdf_file_id
        ? 'NOT_GENERATED'
        : artifactMatchesCurrentTemplate
          ? 'CURRENT_TEMPLATE'
          : 'OUTDATED_TEMPLATE',
      generatedTemplateId: generatedRow?.template_id || null,
      generatedTemplateVersion: generatedRow?.template_version || null,
      generationFailed: Boolean(generatedRow && !generatedRow.pdf_file_id),
      currentValue: payload,
    });
  }

  const ready = students.filter((row) => row.readiness === READY_STATUS || row.readinessCategory === GENERATED_STATUS);
  const missingData = students.filter((row) => row.readiness === MISSING_REQUIRED_DATA);
  const readyAutomatic = students.filter((row) => row.readinessCategory === READY_AUTOMATIC);
  const readyWithManual = students.filter((row) => row.readinessCategory === READY_WITH_MANUAL_RATING);
  const missingStatic = students.filter((row) => row.readinessCategory === MISSING_STATIC_DATA);
  const missingProfessional = students.filter((row) => row.readinessCategory === MISSING_PROFESSIONAL_EVIDENCE);
  const eligible = students.filter((row) => row.eligibilityStatus === 'ELIGIBLE');
  const notEligible = students.filter((row) => row.eligibilityStatus !== 'ELIGIBLE');
  const generated = students.filter((row) => row.generated);
  const notGenerated = students.filter((row) => !row.generated);
  const generationFailed = students.filter((row) => row.generationFailed);
  const outdatedArtifacts = students.filter(
    (row) => row.generatedArtifactStatus === 'OUTDATED_TEMPLATE'
  );
  const population = readinessAggregate.buildPopulationSummary(apps, students, skippedAppIds);
  population.excluded.officialReportPopulation = excludedOfficial.length;
  population.excludedOfficial = excludedOfficial;
  const generation = readinessAggregate.computeGenerationCounts(
    students,
    templateReadiness.templateGenerationReady
  );
  const bulkSummary = bulkRatingMod.summarizeBulkPreview(students);

  return {
    opportunityId,
    universityName: resolveOpportunityUniversityName(opportunity),
    template: mapTemplateRow(resolved.template),
    templatePreflight,
    templateReadiness,
    documentRenderer: getOfficialDocumentRendererStatus(),
    templateFidelityStatus: templateReadiness.templateGenerationReady ? 'PASS' : 'BLOCKED',
    population,
    eligibility: {
      eligible: population.eligible,
      notEligible: population.notEligible,
      pending: population.eligibilityPending,
      excluded: population.excluded,
    },
    professionalEvaluation: generation.professionalEvaluation,
    studentData: {
      complete: generation.dataReady,
      missing: missingData.length,
    },
    generation: {
      dataReady: generation.dataReady,
      finalReady: generation.finalReady,
      generated: generation.generated,
      failed: generation.failed,
    },
    counts: {
      totalStudents: population.totalApplicationsConsidered,
      evaluatedPopulation: population.evaluatedPopulation,
      dataReady: generation.dataReady,
      ready: generation.finalReady,
      finalReady: generation.finalReady,
      missingData: missingData.length,
      readyAutomatic: readyAutomatic.length,
      readyWithManualRating: readyWithManual.length,
      missingStaticData: missingStatic.length,
      missingProfessionalEvidence: missingProfessional.length,
      needsAuthorizedRating: generation.professionalEvaluation.needsAuthorizedRating,
      missingCriteriaCount: generation.professionalEvaluation.missingCriteriaCount,
      eligible: population.eligible,
      notEligible: population.notEligible,
      eligibilityPending: population.eligibilityPending,
      generated: generated.length,
      notGenerated: notGenerated.length,
      generationFailed: generationFailed.length,
      outdatedArtifacts: outdatedArtifacts.length,
    },
    manualRatingStudents: students
      .filter((row) => bulkRatingMod.rowEligibleForBulk(row) || row.readinessCategory === MISSING_PROFESSIONAL_EVIDENCE)
      .map((row) => ({
        applicationId: row.applicationId,
        studentName: row.studentName,
        universityNumber: row.universityNumber,
        eligibilityStatus: row.eligibilityStatus,
        missingProfessionalCriteria: row.missingBulkCriteria?.length
          ? row.missingBulkCriteria
          : row.missingProfessionalCriteria,
        missingFieldDetails: row.missingFieldDetails.filter((field) =>
          String(field.code || field).startsWith('PROFESSIONAL_RATING_')
        ),
      })),
    bulkEligibleRating: {
      summary: bulkSummary,
      students: students
        .filter((row) => bulkRatingMod.rowEligibleForBulk(row))
        .map((row) => ({
          applicationId: row.applicationId,
          studentName: row.studentName,
          universityNumber: row.universityNumber,
          missingCriteria: row.missingBulkCriteria,
          ratingsToApply: bulkRatingMod.rowBulkRatingsToApply(row),
        })),
    },
    missingStudents: missingData.map((row) => ({
      applicationId: row.applicationId,
      studentName: row.studentName,
      universityNumber: row.universityNumber,
      missingFields: row.missingFieldDetails,
    })),
    students,
    capabilities: {
      canGenerate: !access.isReviewer(user),
      canCompleteMissingRatings: !access.isReviewer(user),
      canApplyBulkEligibleRatings: !access.isReviewer(user),
      readOnly: access.isReviewer(user),
    },
  };
}

async function syncAcademicSupervisorsFromImports(user, opportunityId) {
  const opportunity = await prisma.field_training_opportunities.findUnique({
    where: { id: opportunityId },
    include: {
      field_training_opportunity_eligibility: { where: { is_active: true }, select: { university_id: true } },
    },
  });
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  await ftAccess.assertManageOpportunityAccess(user, opportunity);

  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunityId, status: 'approved' },
    select: { id: true, student_id: true, academic_supervisor_name: true },
  });
  const students = await ftRepo.findStudentProfilesByIds(apps.map((a) => a.student_id));
  const studentById = new Map(students.map((s) => [s.id, s]));
  const assignments = await supervisorScope.loadAssignmentsByApplicationIds(apps.map((a) => a.id));
  const batches = await prisma.field_training_supervisor_import_batches.findMany({
    where: { opportunity_id: opportunityId, status: 'applied' },
    select: { id: true, preview_json: true },
    orderBy: { created_at: 'desc' },
  });
  const importIndex = academicSupervisorResolve.buildImportSupervisorIndex(batches);

  const recovered = [];
  const stillMissing = [];
  for (const app of apps) {
    if (app.academic_supervisor_name?.trim()) continue;
    const resolved = academicSupervisorResolve.resolveAcademicSupervisorName({
      application: app,
      student: studentById.get(app.student_id),
      assignment: assignments.get(app.id),
      importIndex,
    });
    if (!resolved.name) {
      stillMissing.push({
        applicationId: app.id,
        studentName: studentById.get(app.student_id)?.full_name,
        universityNumber: academicSupervisorResolve.normalizeUniversityNumber(studentById.get(app.student_id)),
        code: resolved.code || 'ACADEMIC_SUPERVISOR_MISSING',
      });
      continue;
    }
    await prisma.field_training_applications.update({
      where: { id: app.id },
      data: {
        academic_supervisor_name: resolved.name,
        academic_supervisor_normalized: supervisorNames.normalizeSupervisorKey(resolved.name),
        updated_at: new Date(),
      },
    });
    recovered.push({
      applicationId: app.id,
      studentName: studentById.get(app.student_id)?.full_name,
      universityNumber: academicSupervisorResolve.normalizeUniversityNumber(studentById.get(app.student_id)),
      supervisorName: resolved.name,
      source: resolved.source,
    });
  }

  if (recovered.length) {
    await audit(user, 'FT_EVAL_ACADEMIC_SUPERVISOR_SYNC', 'field_training_opportunity', opportunityId, {
      universityId: opportunity.university_id,
      opportunityId,
      meta: { recoveredCount: recovered.length, stillMissingCount: stillMissing.length },
    });
  }

  return { recovered, stillMissing, recoveredCount: recovered.length, stillMissingCount: stillMissing.length };
}

async function resolveMissingEvaluationDataForOpportunity(user, opportunityId, { applyBulk = true } = {}) {
  const supervisorSync = await syncAcademicSupervisorsFromImports(user, opportunityId);
  let bulkResult = null;
  if (applyBulk) {
    bulkResult = await applyBulkEligibleProfessionalRatings(user, opportunityId, {
      confirmed: true,
      reason: BULK_RATING_REASON_AR,
    });
  }
  const readiness = await getOpportunityReportReadiness(user, opportunityId);
  return {
    supervisorSync,
    bulkResult,
    readiness,
  };
}

async function zipOpportunityReports(user, opportunityId) {
  const opportunity = await prisma.field_training_opportunities.findUnique({
    where: { id: opportunityId },
    include: {
      universities: { select: { name: true, short_name: true } },
      field_training_opportunity_eligibility: {
        where: { is_active: true },
        select: {
          university_id: true,
          universities: { select: { name: true, short_name: true } },
        },
        take: 8,
      },
    },
  });
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  access.assertCanBulkZip(user, opportunity.university_id);
  await ftAccess.assertAdminOpportunityAccess(user, opportunity);
  const apps = await prisma.field_training_applications.findMany({
    where: { opportunity_id: opportunityId, status: 'approved' },
    select: { id: true },
  });
  const result = await bulkZip(user, {
    applicationIds: apps.map((row) => row.id),
    query: {
      university_id: resolveOpportunityUniversityId(opportunity, user),
      opportunity_id: opportunityId,
    },
  });
  result.filename = zipUtil.buildZipFilename({
    universityName: resolveOpportunityUniversityName(opportunity),
    academicYear: academicPeriod(opportunity.start_date).academicYear,
  });
  result.summary.totalStudents = apps.length;
  result.summary.generatedReports = result.summary.included;
  result.summary.missingReports = Math.max(0, apps.length - result.summary.included);
  return result;
}

async function previewApplicationReportPdf(user, applicationId) {
  const preview = await previewApplicationPayload(user, applicationId);
  const context = (await loadBatchContext([applicationId])).byId.get(applicationId);
  const opportunity = context?.opportunity;
  const resolved = await resolveTemplate({
    ...opportunity,
    university_id: resolveEvalUniversityId(context, user),
  });
  if (!resolved.template) {
    throw new ApiError(409, 'لا يوجد قالب تقييم معتمد لهذه الجامعة/الفرصة', null, TEMPLATE_MISSING_CODE);
  }

  const current = await prisma.field_training_final_evaluations.findFirst({
    where: { application_id: applicationId, is_current: true },
    select: {
      id: true,
      pdf_file_id: true,
      template_id: true,
      template_version: true,
      source_template_file_id: true,
      score_evidence_json: true,
    },
  });

  if (current?.pdf_file_id) {
    const sourceTemplateFileId = sourceTemplateFileIdOf(current);
    const matchesCurrentTemplate = Boolean(
      String(current.template_id || '') === String(resolved.template.id || '') &&
        Number(current.template_version) === Number(resolved.template.version) &&
        String(sourceTemplateFileId || '') ===
          String(resolved.template.original_file_id || '')
    );
    if (!matchesCurrentTemplate) {
      throw new ApiError(
        409,
        'التقرير المخزن لا يطابق نسخة القالب المعينة حالياً. يجب إعادة إصدار التقرير قبل المعاينة.',
        {
          evaluationId: current.id,
          storedTemplateId: current.template_id,
          storedTemplateVersion: current.template_version,
          storedSourceTemplateFileId: sourceTemplateFileId,
          assignedTemplateId: resolved.template.id,
          assignedTemplateVersion: resolved.template.version,
          assignedSourceTemplateFileId: resolved.template.original_file_id,
        },
        'EVALUATION_ARTIFACT_TEMPLATE_MISMATCH'
      );
    }
    if (!hasVerifiedFidelityArtifact(current, resolved.template)) {
      throw new ApiError(
        409,
        'هذا التقرير قديم أو لم يجتز فحص مطابقة قالب الجامعة الرسمي. يجب إعادة إصداره قبل المعاينة.',
        { evaluationId: current.id },
        'EVALUATION_ARTIFACT_FIDELITY_UNVERIFIED'
      );
    }
    const stored = await downloadPdf(user, current.id);
    return {
      ...preview,
      previewMode: 'pdf',
      pdfBase64: Buffer.from(stored.buffer).toString('base64'),
      templateId: stored.templateId,
      templateVersion: stored.templateVersion,
      sourceTemplateFileId: stored.sourceTemplateFileId,
      pageCount: Number(current.score_evidence_json?.generatedPageCount) || 2,
      evaluationId: current.id,
      artifactSource: 'stored_verified_pdf',
    };
  }

  if (preview.missingFields?.length) {
    return { ...preview, previewMode: 'payload', pdfBase64: null };
  }
  return {
    ...preview,
    previewMode: 'not_generated',
    code: 'EVALUATION_ARTIFACT_NOT_GENERATED',
    messageAr: 'يجب إصدار التقرير الرسمي أولاً، ثم ستعرض المعاينة ملف PDF المخزن نفسه.',
    pdfBase64: null,
    templateId: resolved.template.id,
    templateVersion: resolved.template.version,
    sourceTemplateFileId: resolved.template.original_file_id,
  };
}

async function saveOpportunityReportDefaults(user, opportunityId, body = {}) {
  const opportunity = await prisma.field_training_opportunities.findUnique({ where: { id: opportunityId } });
  if (!opportunity) throw new ApiError(404, 'Opportunity not found');
  access.assertCanGenerate(user, opportunity);
  await ftAccess.assertManageOpportunityAccess(user, opportunity);
  const current = opportunity.host_organization && typeof opportunity.host_organization === 'object' ? opportunity.host_organization : {};
  const next = {
    ...current,
    department: body.department != null ? String(body.department).trim() : current.department,
    email: body.email != null ? String(body.email).trim() : current.email,
    phone: body.phone != null ? String(body.phone).trim() : current.phone,
    fax: body.fax != null ? String(body.fax).trim() : current.fax,
    address: body.address != null ? String(body.address).trim() : current.address,
    field_supervisor_name:
      body.field_supervisor_name != null ? String(body.field_supervisor_name).trim() : current.field_supervisor_name,
    contact_person: body.contact_person != null ? String(body.contact_person).trim() : current.contact_person,
    semester: body.semester != null ? String(body.semester).trim() : current.semester,
    academic_year: body.academic_year != null ? String(body.academic_year).trim() : current.academic_year,
    trainingHoursDisplayMode: body.trainingHoursDisplayMode || current.trainingHoursDisplayMode,
  };
  if (body.organization_name != null) {
    await prisma.field_training_opportunities.update({
      where: { id: opportunityId },
      data: {
        organization_name: String(body.organization_name).trim() || opportunity.organization_name,
        host_organization: next,
        updated_at: new Date(),
      },
    });
  } else {
    await prisma.field_training_opportunities.update({
      where: { id: opportunityId },
      data: { host_organization: next, updated_at: new Date() },
    });
  }
  return getOpportunityReportReadiness(user, opportunityId);
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
  previewApplicationReportPdf,
  getOpportunityReportReadiness,
  zipOpportunityReports,
  saveOpportunityReportDefaults,
  downloadTemplateFile,
  getPolicy,
  upsertPolicy,
  saveSupervisorRating,
  getBulkEligibleRatingPreview,
  applyBulkEligibleProfessionalRatings,
  syncAcademicSupervisorsFromImports,
  resolveMissingEvaluationDataForOpportunity,
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
