const path = require('path');
const fs = require('fs');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { uniqueSlugFromTitle } = require('./fieldTraining.slug');
const { assertPublishReady } = require('./fieldTraining.publishReadiness');
const { resolveStudentFieldTrainingScope } = require('../../utils/studentScope');
const { getStorageBackend, getProvider } = require('../../shared/storage/storageProvider');
const filesService = require('../files/files.service');
const {
  NO_UNIVERSITY_MSG,
  NO_UNIVERSITY_SPECIALTY_MSG,
  NOT_ELIGIBLE_MSG,
  requireStudentFieldTrainingScope,
  scopeAdminListQuery,
  assertAdminOpportunityAccess,
  assertManageOpportunityAccess,
  assertApplicationStudentAccess,
  resolveApplicationStudentUniversityId,
  manageOpportunityListWhere,
  isSystemWideAdmin,
  isUniversityScopedFieldTrainingUser,
  isFieldTrainingAdmin,
  isAssignedInstructor,
} = require('./fieldTraining.access');
const ftEligibility = require('./fieldTraining.eligibility');
const ftNotify = require('./fieldTraining.notifications');
const hoursMod = require('./fieldTraining.hours');
const repo = require('./fieldTraining.repository');
const workflow = require('./fieldTraining.workflow');
const { INSTRUCTION_MIME, INSTRUCTION_MAX_BYTES } = require('./fieldTraining.upload');
const { assertActiveSpecialty } = require('../specialties/specialties.service');
const { prisma } = require('../../config/db');

function buildAdminWhere(query) {
  const where = {};
  if (query.status) where.status = query.status;
  if (query.training_mode) where.training_mode = query.training_mode;
  if (query.specialty_id) where.specialty_id = query.specialty_id;
  if (query.search) {
    const s = query.search.trim();
    if (s) {
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { organization_name: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { location: { contains: s, mode: 'insensitive' } },
        { specialties: { name_ar: { contains: s, mode: 'insensitive' } } },
        { specialties: { name_en: { contains: s, mode: 'insensitive' } } },
      ];
    }
  }
  return where;
}

function buildStudentWhere(query, studentUniversityId, studentUniversitySpecialtyId) {
  const and = [
    {
      field_training_opportunity_eligibility: {
        some: {
          is_active: true,
          university_id: studentUniversityId,
          university_specialty_id: studentUniversitySpecialtyId,
        },
      },
    },
  ];
  if (query.training_mode) and.push({ training_mode: query.training_mode });
  if (query.search) {
    const s = query.search.trim();
    if (s) {
      and.push({
        OR: [
          { title: { contains: s, mode: 'insensitive' } },
          { organization_name: { contains: s, mode: 'insensitive' } },
          { short_description: { contains: s, mode: 'insensitive' } },
          { specialties: { name_ar: { contains: s, mode: 'insensitive' } } },
          { specialties: { name_en: { contains: s, mode: 'insensitive' } } },
        ],
      });
    }
  }
  return { AND: and };
}

async function assertActiveInstructorUser(userId) {
  if (!userId) return null;
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });
  if (!user || user.status !== 'active') {
    throw new ApiError(400, 'المدرب المحدد غير متاح', null, 'FIELD_TRAINING_INVALID_INSTRUCTOR');
  }
  const instructorRole = await prisma.roles.findFirst({ where: { code: 'instructor' } });
  if (!instructorRole) {
    throw new ApiError(400, 'المستخدم المحدد ليس مدربًا', null, 'FIELD_TRAINING_INVALID_INSTRUCTOR');
  }
  const link = await prisma.user_roles.findFirst({
    where: { user_id: userId, role_id: instructorRole.id },
    select: { id: true },
  });
  if (!link) {
    throw new ApiError(400, 'المستخدم المحدد ليس مدربًا', null, 'FIELD_TRAINING_INVALID_INSTRUCTOR');
  }
  return userId;
}

async function mapBodyToCreateData(body) {
  const specialty = await assertActiveSpecialty(body.specialty_id, {
    requiredMessage: 'يرجى اختيار المسار التدريبي الرئيسي.',
    invalidMessage: 'المسار التدريبي المحدد غير متاح.',
  });
  await ftEligibility.validateEligibilityRows(body.eligibility);
  const assignedInstructorId = body.assigned_instructor_id
    ? await assertActiveInstructorUser(body.assigned_instructor_id)
    : null;
  return {
    title: body.title.trim(),
    specialty_id: specialty.id,
    university_id: null,
    assigned_instructor_id: assignedInstructorId,
    organization_name: body.organization_name?.trim() || null,
    location: body.location.trim(),
    training_mode: body.training_mode,
    short_description: body.short_description ?? null,
    description: body.description ?? null,
    requirements: body.requirements ?? null,
    benefits: body.benefits ?? null,
    seats_limit: body.seats_limit ?? null,
    required_training_hours: body.required_training_hours,
    start_date: repo.toDateOnly(body.start_date),
    end_date: repo.toDateOnly(body.end_date),
    application_deadline: repo.toDateOnly(body.application_deadline),
    requires_pre_assessment: body.requires_pre_assessment ?? true,
    requires_post_assessment: body.requires_post_assessment ?? true,
    requires_final_task: body.requires_final_task ?? true,
    minimum_attendance_percentage: body.minimum_attendance_percentage ?? null,
    minimum_post_assessment_score: body.minimum_post_assessment_score ?? null,
    completion_rules: body.completion_rules ?? null,
    status: 'draft',
  };
}

async function mapBodyToUpdateData(body) {
  const data = {};
  if (body.title != null) data.title = body.title.trim();
  if (body.specialty_id != null) {
    const specialty = await assertActiveSpecialty(body.specialty_id, {
      requiredMessage: 'يرجى اختيار المسار التدريبي الرئيسي.',
      invalidMessage: 'المسار التدريبي المحدد غير متاح.',
    });
    data.specialty_id = specialty.id;
  }
  if (body.assigned_instructor_id !== undefined) {
    data.assigned_instructor_id = body.assigned_instructor_id
      ? await assertActiveInstructorUser(body.assigned_instructor_id)
      : null;
  }
  if (body.organization_name !== undefined) {
    data.organization_name = body.organization_name?.trim() || null;
  }
  if (body.location != null) data.location = body.location.trim();
  if (body.training_mode != null) data.training_mode = body.training_mode;
  if (body.short_description !== undefined) data.short_description = body.short_description;
  if (body.description !== undefined) data.description = body.description;
  if (body.requirements !== undefined) data.requirements = body.requirements;
  if (body.benefits !== undefined) data.benefits = body.benefits;
  if (body.seats_limit !== undefined) data.seats_limit = body.seats_limit;
  if (body.required_training_hours !== undefined) {
    data.required_training_hours = body.required_training_hours;
  }
  if (body.start_date !== undefined) data.start_date = repo.toDateOnly(body.start_date);
  if (body.end_date !== undefined) data.end_date = repo.toDateOnly(body.end_date);
  if (body.application_deadline !== undefined) {
    data.application_deadline = repo.toDateOnly(body.application_deadline);
  }
  if (body.requires_pre_assessment !== undefined) {
    data.requires_pre_assessment = body.requires_pre_assessment;
  }
  if (body.requires_post_assessment !== undefined) {
    data.requires_post_assessment = body.requires_post_assessment;
  }
  if (body.requires_final_task !== undefined) data.requires_final_task = body.requires_final_task;
  if (body.minimum_attendance_percentage !== undefined) {
    data.minimum_attendance_percentage = body.minimum_attendance_percentage;
  }
  if (body.minimum_post_assessment_score !== undefined) {
    data.minimum_post_assessment_score = body.minimum_post_assessment_score;
  }
  if (body.completion_rules !== undefined) data.completion_rules = body.completion_rules;
  return data;
}

async function listAdminOpportunities(query, user) {
  const scopedQuery = scopeAdminListQuery(user, query);
  const page = scopedQuery.page;
  const page_size = scopedQuery.page_size;
  const skip = (page - 1) * page_size;
  const scopeWhere = manageOpportunityListWhere(user);
  const baseWhere = buildAdminWhere(scopedQuery);
  const where =
    Object.keys(scopeWhere).length && Object.keys(baseWhere).length
      ? { AND: [baseWhere, scopeWhere] }
      : { ...baseWhere, ...scopeWhere };
  const { opportunities, total } = await repo.findManyAdmin({
    where,
    skip,
    take: page_size,
  });
  const eligibilityCounts = await ftEligibility.countActiveByOpportunityIds(
    opportunities.map((row) => row.id)
  );
  const eligibilitySummaries = await ftEligibility.summarizeEligibilityByOpportunityIds(
    opportunities.map((row) => row.id)
  );
  const applicationCounts = await repo.aggregateApplicationCountsForOpportunities(
    opportunities.map((row) => row.id),
    {
      studentUniversityId: user?.universityId && !isSystemWideAdmin(user) ? user.universityId : undefined,
    }
  );
  const instructorIds = [
    ...new Set(opportunities.map((row) => row.assigned_instructor_id).filter(Boolean)),
  ];
  const instructors = instructorIds.length ? await repo.findUsersByIds(instructorIds) : [];
  const instructorById = Object.fromEntries(instructors.map((instructor) => [instructor.id, instructor]));
  const opsStats = await repo.aggregateInstructorListStats(opportunities.map((row) => row.id));

  return {
    opportunities: opportunities.map((row) => {
      const base = attachListDisplayMeta(repo.mapOpportunityRow(row, { compact: true }), {
        eligibilityCounts,
        eligibilitySummaries,
        applicationCounts: applicationCounts[row.id] ?? { by_university: [], by_university_specialty: {}, total: 0 },
        instructor: row.assigned_instructor_id
          ? instructorById[row.assigned_instructor_id] ?? null
          : null,
      });
      const stats = opsStats[row.id] ?? {};
      return {
        ...base,
        participants_count: stats.participants_count ?? 0,
        sessions_count: stats.sessions_count ?? 0,
        pending_submissions_count: stats.pending_submissions_count ?? 0,
        average_attendance: stats.average_attendance ?? null,
        next_session: stats.next_session ?? null,
        eligible_count: stats.eligible_count ?? 0,
        at_risk_count: stats.at_risk_count ?? 0,
      };
    }),
    meta: { page, page_size, total, total_pages: Math.max(1, Math.ceil(total / page_size)) },
  };
}

function attachListDisplayMeta(
  opportunity,
  { eligibilityCounts = {}, eligibilitySummaries = {}, applicationCounts = null, instructor = null } = {}
) {
  const summary = eligibilitySummaries[opportunity.id] ?? {
    beneficiary_university_count: 0,
    eligible_specialty_count: 0,
  };
  const activeEligibilityCount = eligibilityCounts[opportunity.id] ?? 0;
  return {
    ...opportunity,
    active_eligibility_count: activeEligibilityCount,
    beneficiary_university_count: summary.beneficiary_university_count,
    eligible_specialty_count: summary.eligible_specialty_count,
    applications_by_university: applicationCounts?.by_university ?? [],
    needs_eligibility_setup: activeEligibilityCount < 1,
    eligibility_setup_message:
      activeEligibilityCount < 1 ? ftEligibility.ELIGIBILITY_SETUP_MSG : null,
    assigned_instructor: instructor
      ? { id: instructor.id, full_name: instructor.full_name, email: instructor.email }
      : null,
  };
}

function attachEligibilityMeta(opportunity, eligibilityCounts = {}) {
  const activeEligibilityCount = eligibilityCounts[opportunity.id] ?? 0;
  return {
    ...opportunity,
    active_eligibility_count: activeEligibilityCount,
    needs_eligibility_setup: activeEligibilityCount < 1,
    eligibility_setup_message:
      activeEligibilityCount < 1 ? ftEligibility.ELIGIBILITY_SETUP_MSG : null,
  };
}

async function getAdminStats(query, user) {
  const scopedQuery = scopeAdminListQuery(user, query);
  const scopeWhere = manageOpportunityListWhere(user);
  const filters = { ...scopedQuery };
  if (scopeWhere.assigned_instructor_id) {
    filters.assigned_instructor_id = scopeWhere.assigned_instructor_id;
  }
  const stats = await repo.getAdminAggregateStats(filters);
  return { stats };
}

const FIELD_TRAINING_READ_ERROR_MSG = 'تعذر تحميل بيانات التدريب الميداني.';

function rethrowFieldTrainingReadError(err) {
  if (err instanceof ApiError) throw err;
  const msg = String(err?.message || '');
  if (
    err?.code === 'P2022' ||
    msg.includes('does not exist in the current database') ||
    (msg.includes('column') && msg.includes('does not exist'))
  ) {
    throw new ApiError(
      503,
      `${FIELD_TRAINING_READ_ERROR_MSG} يرجى تطبيق ترحيل قاعدة البيانات (prisma migrate deploy).`,
      null,
      'FIELD_TRAINING_SCHEMA_MISMATCH'
    );
  }
  throw new ApiError(500, FIELD_TRAINING_READ_ERROR_MSG, null, 'FIELD_TRAINING_READ_ERROR');
}

async function getAdminOpportunityById(id, user) {
  try {
    const row = await repo.findById(id);
    if (!row) throw new ApiError(404, 'Opportunity not found');
    await assertAdminOpportunityAccess(user, row);

    const studentUniversityId =
      user?.universityId && !isSystemWideAdmin(user) ? user.universityId : undefined;
    const eligibility = await ftEligibility.findActiveByOpportunityId(id);
    const applicationCounts = await repo.aggregateApplicationCounts(id, { studentUniversityId });
    const opportunity = attachListDisplayMeta(repo.mapOpportunityRow(row), {
      eligibilityCounts: { [id]: eligibility.length },
      eligibilitySummaries: {
        [id]: {
          beneficiary_university_count: new Set(eligibility.map((row) => row.university_id)).size,
          eligible_specialty_count: eligibility.length,
        },
      },
      applicationCounts,
    });
    opportunity.eligibility = eligibility;
    opportunity.eligibility_grouped = ftEligibility.groupEligibilityByUniversity(
      eligibility,
      applicationCounts.by_university_specialty
    );
    if (row.assigned_instructor_id) {
      const [instructor] = await repo.findUsersByIds([row.assigned_instructor_id]);
      opportunity.assigned_instructor = instructor
        ? { id: instructor.id, full_name: instructor.full_name, email: instructor.email }
        : null;
    } else {
      opportunity.assigned_instructor = null;
    }

    return { opportunity };
  } catch (err) {
    rethrowFieldTrainingReadError(err);
  }
}

async function createAdminOpportunity(body, userId, user) {
  const slug = await uniqueSlugFromTitle(body.title, (s) => repo.slugExists(s));
  const createData = {
    ...(await mapBodyToCreateData(body)),
    slug,
    created_by_id: userId,
  };
  const eligibilityRows = await ftEligibility.validateEligibilityRows(body.eligibility);

  const opportunity = await prisma.$transaction(async (tx) => {
    const created = await tx.field_training_opportunities.create({
      data: createData,
      include: repo.opportunityInclude,
    });
    await ftEligibility.syncOpportunityEligibility(created.id, eligibilityRows, tx);
    return created;
  });

  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_OPPORTUNITY_CREATED',
    entityType: 'field_training_opportunity',
    entityId: opportunity.id,
    newValues: { title: opportunity.title, status: opportunity.status },
  });
  if (opportunity.assigned_instructor_id) {
    await ftNotify.notifyInstructorAssigned({
      instructorId: opportunity.assigned_instructor_id,
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
    });
  }
  const mapped = repo.mapOpportunityRow(opportunity);
  mapped.eligibility = await ftEligibility.findActiveByOpportunityId(opportunity.id);
  return { opportunity: mapped };
}

async function updateAdminOpportunity(id, body, userId, user) {
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Opportunity not found');
  await assertAdminOpportunityAccess(user, existing);

  const data = await mapBodyToUpdateData(body);
  if (data.title && data.title !== existing.title) {
    data.slug = await uniqueSlugFromTitle(data.title, (s) => repo.slugExists(s, id));
  }

  const eligibilityRows = body.eligibility
    ? await ftEligibility.validateEligibilityRows(body.eligibility)
    : null;

  const opportunity = await prisma.$transaction(async (tx) => {
    const updated = await tx.field_training_opportunities.update({
      where: { id },
      data,
      include: repo.opportunityInclude,
    });
    if (eligibilityRows) {
      await ftEligibility.syncOpportunityEligibility(id, eligibilityRows, tx);
    }
    return updated;
  });

  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_OPPORTUNITY_UPDATED',
    entityType: 'field_training_opportunity',
    entityId: id,
    oldValues: { title: existing.title },
    newValues: data,
  });
  if (
    data.assigned_instructor_id &&
    String(data.assigned_instructor_id) !== String(existing.assigned_instructor_id || '')
  ) {
    await ftNotify.notifyInstructorAssigned({
      instructorId: data.assigned_instructor_id,
      opportunityId: id,
      opportunityTitle: opportunity.title,
    });
  }
  const mapped = repo.mapOpportunityRow(opportunity);
  mapped.eligibility = await ftEligibility.findActiveByOpportunityId(id);

  if (data.required_training_hours !== undefined) {
    const participants = await repo.findActiveParticipants(id);
    await Promise.all(participants.map((p) => workflow.persistEligibility(p.id)));
  }

  return { opportunity: mapped };
}

async function publishOpportunity(id, userId, user) {
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Opportunity not found');
  await assertAdminOpportunityAccess(user, existing);
  const activeEligibilityCount = await ftEligibility.countActiveEligibility(id);
  assertPublishReady(existing, { activeEligibilityCount });
  const opportunity = await repo.updateOpportunity(id, {
    status: 'published',
    published_at: new Date(),
  });
  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_OPPORTUNITY_PUBLISHED',
    entityType: 'field_training_opportunity',
    entityId: id,
    newValues: { status: 'published' },
  });
  return { opportunity: repo.mapOpportunityRow(opportunity) };
}

async function archiveOpportunity(id, userId, user) {
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Opportunity not found');
  await assertAdminOpportunityAccess(user, existing);
  const opportunity = await repo.updateOpportunity(id, { status: 'archived' });
  await recordAudit({
    userId,
    actionType: 'FIELD_TRAINING_OPPORTUNITY_ARCHIVED',
    entityType: 'field_training_opportunity',
    entityId: id,
    newValues: { status: 'archived' },
  });
  return { opportunity: repo.mapOpportunityRow(opportunity) };
}

function buildApplicationProgressSummary(app, hoursProgress = null) {
  const parts = [];
  if (app.training_status && app.training_status !== 'none') {
    parts.push(`training:${app.training_status}`);
  }
  if (app.pre_assessment_level) parts.push(`pre:${app.pre_assessment_level}`);
  if (app.attendance_percentage != null) parts.push(`attendance:${app.attendance_percentage}`);
  if (hoursProgress?.hours_completion_percentage != null) {
    parts.push(`hours:${hoursProgress.hours_completion_percentage}`);
  }
  if (app.post_assessment_score != null) parts.push(`post:${app.post_assessment_score}`);
  if (app.final_task_status && app.final_task_status !== 'not_required') {
    parts.push(`task:${app.final_task_status}`);
  }
  if (app.completion_eligibility_status) parts.push(`eligibility:${app.completion_eligibility_status}`);
  return {
    training_status: app.training_status ?? null,
    pre_assessment_level: app.pre_assessment_level ?? null,
    attendance_percentage:
      app.attendance_percentage != null ? Number(app.attendance_percentage) : null,
    post_assessment_score:
      app.post_assessment_score != null ? Number(app.post_assessment_score) : null,
    final_task_status: app.final_task_status ?? null,
    completion_eligibility_status: app.completion_eligibility_status ?? null,
    required_training_hours: hoursProgress?.required_training_hours ?? null,
    completed_training_hours: hoursProgress?.completed_training_hours ?? null,
    remaining_training_hours: hoursProgress?.remaining_training_hours ?? null,
    hours_completion_percentage: hoursProgress?.hours_completion_percentage ?? null,
    hours_completion_status: hoursProgress?.hours_completion_status ?? null,
    summary_key: parts.join('|') || null,
  };
}

function mapApplicationAdminRow(app, profile, opportunity, hoursProgress = null) {
  const universitySpecialty = profile?.university_specialty ?? null;
  const displaySpecialty = profile?.specialty ?? null;
  const hours =
    hoursProgress ||
    hoursMod.buildHoursProgress({
      requiredHours: opportunity?.required_training_hours,
      completedMinutes: 0,
    });
  return {
    ...repo.mapApplicationRow(app),
    opportunity_title: opportunity?.title ?? null,
    opportunity_training_track: repo.mapSpecialtySummary(opportunity?.specialties) ?? null,
    student_name: profile?.full_name ?? 'طالب غير معروف',
    student_email: profile?.email ?? null,
    student_university: profile?.university?.name ?? 'الجامعة غير محددة',
    student_primary_university_id: profile?.primary_university_id ?? null,
    student_university_specialty_id: profile?.university_specialty_id ?? universitySpecialty?.id ?? null,
    student_university_specialty: universitySpecialty,
    student_university_specialty_label: universitySpecialty
      ? repo.formatSpecialtyLabel(universitySpecialty)
      : null,
    student_canonical_specialty: profile?.canonical_specialty ?? null,
    student_canonical_specialty_label: profile?.canonical_specialty
      ? repo.formatSpecialtyLabel(profile.canonical_specialty)
      : null,
    student_specialty: displaySpecialty,
    student_specialty_label: repo.formatSpecialtyLabel(displaySpecialty),
    student_phone: profile?.phone ?? null,
    progress_summary: buildApplicationProgressSummary(app, hours),
    training_hours: hours,
  };
}

async function listOpportunityApplications(opportunityId, query = {}, user) {
  try {
    const opp = await repo.findById(opportunityId);
    if (!opp) throw new ApiError(404, 'Opportunity not found');
    await assertManageOpportunityAccess(user, opp);

    const studentUniversityId = resolveApplicationStudentUniversityId(user, query.university_id);
    const apps = await repo.findApplicationsByOpportunity(opportunityId, {
      status: query.status,
      training_status: query.training_status,
      university_id: query.university_id,
      university_specialty_id: query.university_specialty_id,
      studentUniversityId,
    });

    const profiles = await repo.findStudentProfilesByIds([...new Set(apps.map((a) => a.student_id))]);
    const byId = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));

    const hoursByApp = await hoursMod.calculateHoursProgressForApplications(
      apps.map((app) => ({ id: app.id, opportunity_id: opportunityId })),
      new Map([[opportunityId, opp.required_training_hours ?? null]])
    );

    let applications = apps.map((app) =>
      mapApplicationAdminRow(app, byId[app.student_id], opp, hoursByApp.get(app.id))
    );

    if (query.specialty_id && opp.specialty_id !== query.specialty_id) {
      applications = [];
    } else if (query.search) {
      const q = String(query.search).trim().toLowerCase();
      if (q) {
        applications = applications.filter((app) =>
          [
            app.student_name,
            app.student_email,
            app.student_university,
            app.student_university_specialty_label,
            app.student_canonical_specialty_label,
            app.opportunity_title,
          ].some((field) => String(field ?? '').toLowerCase().includes(q))
        );
      }
    }

    return { applications };
  } catch (err) {
    rethrowFieldTrainingReadError(err);
  }
}

async function reviewApplication(applicationId, body, reviewerId, user) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  const opp = await repo.findById(app.opportunity_id);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  await assertApplicationStudentAccess(user, app.student_id);

  if (isAssignedInstructor(user, opp) && !isFieldTrainingAdmin(user)) {
    throw new ApiError(
      403,
      'موافقة ورفض الطلبات من صلاحيات الإدارة فقط',
      null,
      'FIELD_TRAINING_INSTRUCTOR_CANNOT_REVIEW_APPLICATION'
    );
  }

  if (app.status !== 'pending') {
    throw new ApiError(400, 'Only pending applications can be reviewed');
  }

  const updated = await repo.updateApplication(applicationId, {
    status: body.status,
    admin_note: body.admin_note ?? null,
    reviewed_by_id: reviewerId,
    reviewed_at: new Date(),
    ...(body.status === 'approved'
      ? {
          ...workflow.resolveTrainingStatusOnApproval(opp),
          final_task_status: opp.requires_final_task ? 'pending' : 'not_required',
        }
      : { training_status: 'none' }),
  });

  const actionType =
    body.status === 'approved'
      ? 'FIELD_TRAINING_APPLICATION_APPROVED'
      : 'FIELD_TRAINING_APPLICATION_REJECTED';

  await recordAudit({
    userId: reviewerId,
    actionType,
    entityType: 'field_training_application',
    entityId: applicationId,
    newValues: { status: body.status },
  });

  if (body.status === 'approved') {
    await ftNotify.notifyStudentFieldTrainingApplicationApproved({
      studentId: app.student_id,
      opportunityId: opp.id,
      opportunityTitle: opp.title,
    });
  } else {
    await ftNotify.notifyStudentFieldTrainingApplicationRejected({
      studentId: app.student_id,
      opportunityId: opp.id,
      opportunityTitle: opp.title,
    });
  }

  return { application: repo.mapApplicationRow(updated) };
}

async function listStudentOpportunities(query, studentId) {
  const scope = await resolveStudentFieldTrainingScope({ userId: studentId });
  if (!scope.universityId) {
    return {
      opportunities: [],
      message: NO_UNIVERSITY_MSG,
      profile_incomplete: true,
    };
  }
  if (!scope.universitySpecialtyId) {
    return {
      opportunities: [],
      message: NO_UNIVERSITY_SPECIALTY_MSG,
      profile_incomplete: true,
    };
  }

  const rows = await repo.findPublishedMany({
    where: buildStudentWhere(query, scope.universityId, scope.universitySpecialtyId),
  });
  const oppIds = rows.map((row) => row.id);
  const myApps = await repo.findApplicationsByOpportunityIdsForStudent(oppIds, studentId);
  const appByOpp = Object.fromEntries(myApps.map((app) => [app.opportunity_id, app]));
  const opportunities = rows.map((row) => {
    const app = appByOpp[row.id];
    return {
      ...repo.mapOpportunityRow(row, { compact: true }),
      my_application_status: app?.status ?? null,
      my_application_id: app?.id ?? null,
      my_training_status: app?.training_status ?? null,
    };
  });
  return { opportunities };
}

async function listMyApplications(studentId) {
  const apps = await repo.findApplicationsByStudent(studentId);
  const profiles = await repo.findStudentProfilesByIds([...new Set(apps.map((a) => a.student_id))]);
  const byId = Object.fromEntries(profiles.map((u) => [u.id, u]));
  return {
    applications: apps.map((a) => ({
      ...repo.mapApplicationRow(a),
      student_university: byId[a.student_id]?.university?.name ?? null,
      student_specialty: byId[a.student_id]?.specialty ?? null,
      opportunity: a.field_training_opportunities
        ? {
            id: a.field_training_opportunities.id,
            title: a.field_training_opportunities.title,
            specialty_id: a.field_training_opportunities.specialty_id ?? null,
            specialty: repo.mapSpecialtySummary(a.field_training_opportunities.specialties),
            organization_name: a.field_training_opportunities.organization_name,
            status: a.field_training_opportunities.status,
            training_mode: a.field_training_opportunities.training_mode,
          }
        : null,
    })),
  };
}

async function assertStudentCanAccessOpportunity(opportunity, studentId) {
  const scope = await requireStudentFieldTrainingScope(studentId);
  const eligible = await ftEligibility.isStudentEligible(
    opportunity.id,
    scope.universityId,
    scope.universitySpecialtyId
  );
  if (!eligible) {
    throw new ApiError(403, NOT_ELIGIBLE_MSG, null, 'FIELD_TRAINING_NOT_ELIGIBLE');
  }
}

async function getStudentOpportunityById(id, studentId) {
  const row = await repo.findPublishedById(id);
  if (!row) throw new ApiError(404, 'Opportunity not found');
  await assertStudentCanAccessOpportunity(row, studentId);
  const app = await repo.findApplicationByOpportunityAndStudent(id, studentId);
  const [studentProfile] = await repo.findStudentProfilesByIds([studentId]);
  let assignedInstructor = null;
  if (row.assigned_instructor_id) {
    const instructor = await prisma.users.findUnique({
      where: { id: row.assigned_instructor_id },
      select: { id: true, full_name: true },
    });
    if (instructor) {
      assignedInstructor = { id: instructor.id, full_name: instructor.full_name };
    }
  }
  return {
    opportunity: {
      ...repo.mapOpportunityRow(row),
      my_application_status: app?.status ?? null,
      my_application_id: app?.id ?? null,
      my_application_message: app?.student_message ?? null,
      my_training_status: app?.training_status ?? null,
      my_pre_assessment_level: app?.pre_assessment_level ?? null,
      my_attendance_percentage:
        app?.attendance_percentage != null ? Number(app.attendance_percentage) : null,
      my_completion_eligibility_status: app?.completion_eligibility_status ?? null,
      assigned_instructor: assignedInstructor,
      student_matching_university: studentProfile?.university
        ? { id: studentProfile.university.id, name: studentProfile.university.name }
        : null,
      student_matching_university_specialty: studentProfile?.university_specialty ?? null,
      student_matching_university_specialty_label: studentProfile?.university_specialty
        ? repo.formatSpecialtyLabel(studentProfile.university_specialty)
        : null,
    },
    application: app ? repo.mapApplicationRow(app) : null,
  };
}

async function applyToOpportunity(opportunityId, body, studentId) {
  const opp = await repo.findPublishedById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertStudentCanAccessOpportunity(opp, studentId);

  const existing = await repo.findApplicationByOpportunityAndStudent(opportunityId, studentId);
  if (existing && existing.status !== 'cancelled') {
    throw new ApiError(409, 'You have already applied to this opportunity');
  }

  if (opp.seats_limit != null) {
    const approved = await repo.countApprovedApplications(opportunityId);
    if (approved >= opp.seats_limit) {
      throw new ApiError(400, 'No seats available for this opportunity');
    }
  }

  const [studentProfile] = await repo.findStudentProfilesByIds([studentId]);
  const eligibilityRows = await ftEligibility.findActiveByOpportunityId(opportunityId);
  const eligibilityMatch = eligibilityRows.find(
    (row) =>
      String(row.university_id) === String(studentProfile?.primary_university_id) &&
      String(row.university_specialty_id) === String(studentProfile?.university_specialty_id)
  );
  if (eligibilityMatch?.seats_limit != null) {
    const approvedForSlot = await repo.countApprovedApplicationsForEligibility(
      opportunityId,
      studentProfile.primary_university_id,
      studentProfile.university_specialty_id
    );
    if (approvedForSlot >= eligibilityMatch.seats_limit) {
      throw new ApiError(400, 'لا توجد مقاعد متاحة لتخصص جامعتك في هذه الفرصة');
    }
  }

  if (opp.application_deadline) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const deadline = new Date(opp.application_deadline);
    if (today > deadline) {
      throw new ApiError(400, 'Application deadline has passed');
    }
  }

  let application;
  if (existing?.status === 'cancelled') {
    application = await repo.updateApplication(existing.id, {
      status: 'pending',
      student_message: body.student_message ?? null,
      admin_note: null,
      reviewed_by_id: null,
      reviewed_at: null,
    });
  } else {
    application = await repo.createApplication({
      opportunity_id: opportunityId,
      student_id: studentId,
      status: 'pending',
      student_message: body.student_message ?? null,
    });
  }

  await ftNotify.notifyAdminsFieldTrainingApplicationSubmitted({
    opportunityId: opp.id,
    opportunityTitle: opp.title,
    universityId: studentProfile?.primary_university_id ?? null,
    studentName: studentProfile?.full_name,
  });

  return { application: repo.mapApplicationRow(application) };
}

async function cancelApplication(applicationId, studentId) {
  const app = await repo.findApplicationById(applicationId);
  if (!app) throw new ApiError(404, 'Application not found');
  if (app.student_id !== studentId) {
    throw new ApiError(403, 'Forbidden');
  }
  if (app.status !== 'pending') {
    throw new ApiError(400, 'Only pending applications can be cancelled');
  }
  const updated = await repo.updateApplication(applicationId, { status: 'cancelled' });
  return { application: repo.mapApplicationRow(updated) };
}

async function assertActiveParticipant(opportunityId, studentId, { requireTrainingAccess = false } = {}) {
  const app = await repo.findApplicationByOpportunityAndStudent(opportunityId, studentId);
  if (!app || app.status !== 'approved') {
    throw new ApiError(403, 'يجب قبول طلبك أولًا للوصول إلى هذا المحتوى');
  }
  if (workflow.isExpelled(app)) {
    throw new ApiError(403, 'تم استبعادك من التدريب');
  }
  if (requireTrainingAccess && !workflow.canAccessTrainingContent(app)) {
    throw new ApiError(403, 'التدريب غير نشط بعد');
  }
  return app;
}

/** @deprecated use assertActiveParticipant */
async function assertApprovedApplication(opportunityId, studentId) {
  return assertActiveParticipant(opportunityId, studentId);
}

async function listOpportunityTasks(opportunityId, { studentId, user } = {}) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  if (user) await assertManageOpportunityAccess(user, opp);

  let applicationId;
  if (studentId) {
    const app = await assertActiveParticipant(opportunityId, studentId, {
      requireTrainingAccess: true,
    });
    applicationId = app.id;
  }

  const tasks = await repo.findTasksByOpportunity(opportunityId, {
    applicationId,
    exposeStudentSubmissionAudit: Boolean(applicationId),
  });
  return { tasks };
}

async function resolveInstructionFileInput(fileId, user) {
  if (!fileId) return null;
  const resolved = await filesService.resolveUploadInput({ fileId }, user);
  if (!resolved) throw new ApiError(400, 'ملف التعليمات غير صالح');
  if (resolved.mimeType && !INSTRUCTION_MIME.has(resolved.mimeType)) {
    throw new ApiError(400, 'نوع ملف التعليمات غير مدعوم');
  }
  if (resolved.size && resolved.size > INSTRUCTION_MAX_BYTES) {
    throw new ApiError(400, 'حجم ملف التعليمات كبير جداً');
  }
  return resolved;
}

function instructionFileDataFromResolved(resolved, userId) {
  return {
    instruction_file_path: resolved.filePath,
    instruction_file_name: resolved.fileName,
    instruction_file_mime_type: resolved.mimeType,
    instruction_file_size: resolved.size ?? null,
    instruction_file_uploaded_at: new Date(),
    instruction_file_uploaded_by_id: userId,
  };
}

function clearInstructionFileData() {
  return {
    instruction_file_path: null,
    instruction_file_name: null,
    instruction_file_mime_type: null,
    instruction_file_size: null,
    instruction_file_uploaded_at: null,
    instruction_file_uploaded_by_id: null,
  };
}

async function assertTaskInstructionDownloadAccess(taskId, user, { asAdmin = false, asAcademic = false } = {}) {
  const task = await repo.findTaskById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');
  const opp = task.field_training_opportunities;
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  if (!task.instruction_file_path) throw new ApiError(404, 'Instruction file not found');

  if (asAdmin) {
    await assertManageOpportunityAccess(user, opp);
  } else if (asAcademic) {
    if (!user?.universityId) throw new ApiError(403, 'Forbidden');
    const allowed = await repo.opportunityHasApprovedStudentFromUniversity(opp.id, user.universityId);
    if (!allowed) throw new ApiError(403, 'Forbidden');
  } else {
    await assertActiveParticipant(opp.id, user.userId, { requireTrainingAccess: true });
  }

  return task;
}

async function getTaskInstructionDownloadUrl(taskId, user, options = {}) {
  const task = await assertTaskInstructionDownloadAccess(taskId, user, options);
  const stored = task.instruction_file_path;

  if (getStorageBackend() === 'r2' && String(stored).startsWith('uploads/')) {
    const signed = await getProvider().createPresignedGetUrl({ storageKey: stored });
    return { url: signed.url, expiresIn: signed.expiresIn, file_name: task.instruction_file_name };
  }

  if (!repo.submissionFileExists(stored)) {
    throw new ApiError(404, 'File not found');
  }

  return { delivery: 'stream', file_name: task.instruction_file_name };
}

async function downloadTaskInstructionFile(taskId, user, options = {}) {
  const task = await assertTaskInstructionDownloadAccess(taskId, user, options);
  const stored = task.instruction_file_path;

  if (getStorageBackend() === 'r2' && String(stored).startsWith('uploads/')) {
    const signed = await getProvider().createPresignedGetUrl({ storageKey: stored });
    return {
      redirectUrl: signed.url,
      fileName: task.instruction_file_name,
      mimeType: task.instruction_file_mime_type || 'application/octet-stream',
    };
  }

  if (!repo.submissionFileExists(stored)) {
    throw new ApiError(404, 'File not found');
  }

  return {
    absPath: repo.resolveSubmissionAbsolutePath(stored),
    fileName: task.instruction_file_name,
    mimeType: task.instruction_file_mime_type || 'application/octet-stream',
  };
}

async function createOpportunityTask(opportunityId, body, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);

  const count = await repo.countTasksByOpportunity(opportunityId);
  const task = await repo.createTask({
    opportunity_id: opportunityId,
    title: body.title.trim(),
    description: body.description ?? null,
    sort_order: body.sort_order ?? count,
    due_date: repo.toDateOnly(body.due_date),
    ai_self_evaluation_prompt: body.ai_self_evaluation_prompt ?? null,
    requires_ai_self_evaluation: body.requires_ai_self_evaluation ?? false,
    is_final_task: body.is_final_task ?? false,
  });

  let taskRow = task;
  if (body.instruction_file_id) {
    const resolved = await resolveInstructionFileInput(body.instruction_file_id, user);
    const fileData = instructionFileDataFromResolved(resolved, user.userId);
    taskRow = await repo.updateTask(task.id, fileData);
  }
  await ftNotify.notifyApprovedStudentsNewTask({
    opportunityId,
    opportunityTitle: opp.title,
    taskTitle: taskRow.title,
  });

  return { task: repo.mapTaskRow(taskRow) };
}

async function updateOpportunityTask(taskId, body, user) {
  const task = await repo.findTaskById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');
  await assertManageOpportunityAccess(user, task.field_training_opportunities);

  const data = {};
  if (body.title != null) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description;
  if (body.sort_order != null) data.sort_order = body.sort_order;
  if (body.due_date !== undefined) data.due_date = repo.toDateOnly(body.due_date);
  if (body.ai_self_evaluation_prompt !== undefined) {
    data.ai_self_evaluation_prompt = body.ai_self_evaluation_prompt;
  }
  if (body.requires_ai_self_evaluation !== undefined) {
    data.requires_ai_self_evaluation = body.requires_ai_self_evaluation;
  }
  if (body.is_final_task !== undefined) data.is_final_task = body.is_final_task;
  if (body.remove_instruction_file) {
    Object.assign(data, clearInstructionFileData());
  }
  if (body.instruction_file_id) {
    const resolved = await resolveInstructionFileInput(body.instruction_file_id, user);
    Object.assign(data, instructionFileDataFromResolved(resolved, user.userId));
  }

  const updated = await repo.updateTask(taskId, data);
  return { task: repo.mapTaskRow(updated) };
}

async function deleteOpportunityTask(taskId, user) {
  const task = await repo.findTaskById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');
  await assertManageOpportunityAccess(user, task.field_training_opportunities);
  await repo.deleteTask(taskId);
  return { ok: true };
}

async function listOpportunitySubmissions(opportunityId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);
  const submissions = await repo.findSubmissionsByOpportunity(opportunityId);
  const profiles = await repo.findStudentProfilesByIds([...new Set(submissions.map((s) => s.student_id))]);
  const byId = Object.fromEntries(profiles.map((u) => [u.id, u]));
  const scopedSubmissions =
    isUniversityScopedFieldTrainingUser(user) && user?.universityId
      ? submissions.filter(
          (submission) =>
            String(byId[submission.student_id]?.primary_university_id ?? '') ===
            String(user.universityId)
        )
      : submissions;
  return {
    submissions: scopedSubmissions.map((s) => ({
      ...s,
      student_name: byId[s.student_id]?.full_name ?? null,
      student_email: byId[s.student_id]?.email ?? null,
      student_university: byId[s.student_id]?.university?.name ?? null,
      student_specialty: byId[s.student_id]?.specialty ?? null,
    })),
  };
}

async function assertSubmissionDownloadAccess(submissionId, user, { asAdmin = false } = {}) {
  const submission = await repo.findSubmissionById(submissionId);
  if (!submission) throw new ApiError(404, 'Submission not found');
  const opp = submission.field_training_tasks?.field_training_opportunities;
  if (!opp) throw new ApiError(404, 'Opportunity not found');

  if (asAdmin) {
    await assertManageOpportunityAccess(user, opp);
    await assertApplicationStudentAccess(user, submission.student_id);
  } else {
    if (submission.student_id !== user.userId) {
      throw new ApiError(403, 'Forbidden');
    }
    await assertStudentCanAccessOpportunity(opp, user.userId);
  }

  if (!submission.file_path) {
    throw new ApiError(404, 'File not found');
  }

  return submission;
}

async function getSubmissionDownloadUrl(submissionId, user, { asAdmin = false } = {}) {
  const submission = await assertSubmissionDownloadAccess(submissionId, user, { asAdmin });

  if (getStorageBackend() === 'r2' && String(submission.file_path).startsWith('uploads/')) {
    const signed = await getProvider().createPresignedGetUrl({ storageKey: submission.file_path });
    return {
      url: signed.url,
      expiresIn: signed.expiresIn,
    };
  }

  if (!repo.submissionFileExists(submission.file_path)) {
    throw new ApiError(404, 'File not found');
  }

  return { delivery: 'stream' };
}

async function downloadSubmissionFile(submissionId, user, { asAdmin = false } = {}) {
  const submission = await assertSubmissionDownloadAccess(submissionId, user, { asAdmin });

  if (getStorageBackend() === 'r2' && String(submission.file_path).startsWith('uploads/')) {
    const signed = await getProvider().createPresignedGetUrl({ storageKey: submission.file_path });
    return {
      redirectUrl: signed.url,
      fileName: submission.file_name,
      mimeType: submission.mime_type || 'application/octet-stream',
    };
  }

  if (!repo.submissionFileExists(submission.file_path)) {
    throw new ApiError(404, 'File not found');
  }

  return {
    absPath: repo.resolveSubmissionAbsolutePath(submission.file_path),
    fileName: submission.file_name,
    mimeType: submission.mime_type || 'application/octet-stream',
  };
}

async function submitTaskFile(taskId, file, studentId, body = {}, user = { userId: studentId }) {
  const projectUrl = body.project_url?.trim() || null;
  const resolved = await filesService.resolveUploadInput(
    {
      file,
      fileId: body.fileId || body.analysis_file_id || null,
      localPathBuilder: (f) => repo.buildRelativeFilePath(taskId, path.basename(f.filename)),
    },
    user
  );

  if (!resolved && !projectUrl) {
    throw new ApiError(400, 'أرفق ملف الحل أو أدخل رابط المشروع');
  }

  const task = await repo.findTaskById(taskId);
  if (!task) throw new ApiError(404, 'Task not found');
  const oppStatus = task.field_training_opportunities?.status;
  if (!['published', 'in_progress'].includes(oppStatus)) {
    throw new ApiError(400, 'الفرصة غير متاحة');
  }

  const app = await assertActiveParticipant(task.opportunity_id, studentId, {
    requireTrainingAccess: true,
  });

  if (task.requires_ai_self_evaluation) {
    if (!body.student_self_evaluation_input?.trim()) {
      throw new ApiError(400, 'التقييم الذاتي مطلوب قبل التسليم');
    }
    if (!body.ai_response_inserted_text?.trim() || !body.ai_raw_response?.trim()) {
      throw new ApiError(400, 'يجب إجراء تحليل الذكاء الاصطناعي قبل التسليم');
    }
    const fileOk = ['ok', 'partial'].includes(body.file_extraction_status);
    const urlOk = body.url_extraction_status === 'ok';
    if (!fileOk && !urlOk) {
      throw new ApiError(
        400,
        'يجب توفر مصدر قابل للتحليل (ملف أو رابط) قبل التسليم'
      );
    }
  }

  if (projectUrl) {
    const urlFetch = require('./fieldTraining.urlFetch');
    if (!urlFetch.isValidHttpUrlShape(projectUrl)) {
      throw new ApiError(400, 'الرابط يجب أن يكون عامًا ومتاحًا.');
    }
  }

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isLate = dueDate ? new Date() > dueDate : false;

  const submission = await repo.upsertSubmissionExtended({
    taskId,
    applicationId: app.id,
    studentId,
    filePath: resolved?.filePath ?? null,
    fileName: resolved?.fileName ?? null,
    mimeType: resolved?.mimeType ?? null,
    extra: {
      student_self_evaluation_input: body.student_self_evaluation_input ?? null,
      ai_prompt_used: body.ai_prompt_used ?? null,
      ai_model_provider: body.ai_model_provider ?? null,
      ai_model_name: body.ai_model_name ?? null,
      ai_raw_response: body.ai_raw_response ?? null,
      ai_response_inserted_text: body.ai_response_inserted_text ?? null,
      final_student_notes: body.final_student_notes ?? null,
      project_url: projectUrl,
      analysis_file_id: body.analysis_file_id || body.fileId || resolved?.fileId || null,
      file_extraction_status: body.file_extraction_status ?? null,
      file_extracted_text: body.file_extracted_text ?? null,
      url_extraction_status: body.url_extraction_status ?? null,
      url_extracted_text: body.url_extracted_text ?? null,
      extraction_errors: body.extraction_errors ?? null,
      ai_evaluated_at: body.ai_evaluated_at
        ? new Date(body.ai_evaluated_at)
        : body.ai_raw_response
          ? new Date()
          : null,
      is_late: isLate,
      review_status: 'pending',
    },
  });

  const appUpdate = { training_status: 'task_submitted' };
  if (task.is_final_task) {
    appUpdate.final_task_status = 'submitted';
  }
  await repo.updateApplication(app.id, appUpdate);

  const opp = await repo.findById(task.opportunity_id);
  const profiles = await repo.findStudentProfilesByIds([studentId]);
  await ftNotify.notifyFieldTrainingTaskSubmitted({
    opportunityId: task.opportunity_id,
    opportunityTitle: task.field_training_opportunities?.title,
    universityId: profiles[0]?.primary_university_id ?? null,
    studentName: profiles[0]?.full_name,
    taskTitle: task.title,
    instructorId: opp?.assigned_instructor_id,
  });

  return { submission: repo.mapSubmissionRow(submission, { exposeStudentOwnAudit: true }) };
}

async function listStudentOpportunityTasks(opportunityId, studentId) {
  const published = await repo.findPublishedById(opportunityId);
  if (!published) throw new ApiError(404, 'Opportunity not found');
  await assertStudentCanAccessOpportunity(published, studentId);
  return listOpportunityTasks(opportunityId, { studentId });
}

async function reviewSubmission(submissionId, body, user) {
  const submission = await repo.findSubmissionById(submissionId);
  if (!submission) throw new ApiError(404, 'Submission not found');
  const opp = submission.field_training_tasks?.field_training_opportunities;
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);

  const updated = await repo.updateSubmissionReview(submissionId, {
    review_status: body.review_status,
    instructor_feedback: body.instructor_feedback,
    reviewed_by_id: user.userId,
  });

  if (body.review_status === 'approved' && submission.field_training_tasks?.is_final_task) {
    const app = await repo.findApplicationById(submission.application_id);
    if (app) {
      await repo.updateApplication(app.id, { final_task_status: 'approved' });
      await workflow.persistEligibility(app.id);
    }
  }

  const oppFull = await repo.findById(opp.id);
  await ftNotify.notifyStudentTaskReviewed({
    studentId: submission.student_id,
    opportunityId: opp.id,
    opportunityTitle: oppFull?.title || opp.title,
    taskTitle: submission.field_training_tasks?.title,
    reviewStatus: body.review_status,
  });

  await recordAudit({
    userId: user.userId,
    actionType: 'FIELD_TRAINING_SUBMISSION_REVIEWED',
    entityType: 'field_training_task_submission',
    entityId: submissionId,
    newValues: { review_status: body.review_status },
  });

  return { submission: repo.mapSubmissionRow(updated) };
}

async function getEligibilityCatalog() {
  const universities = await ftEligibility.findEligibilityCatalog();
  return { universities };
}

async function listOpportunityEligibility(opportunityId, user) {
  const opp = await repo.findById(opportunityId);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  await assertManageOpportunityAccess(user, opp);

  const studentUniversityId = resolveApplicationStudentUniversityId(user, undefined);
  const apps = await repo.findApplicationsByOpportunity(opportunityId, {
    status: 'approved',
    studentUniversityId,
  });
  const profiles = await repo.findStudentProfilesByIds([...new Set(apps.map((a) => a.student_id))]);
  const byId = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));

  const hoursByApp = await hoursMod.calculateHoursProgressForApplications(
    apps.map((app) => ({ id: app.id, opportunity_id: opportunityId })),
    new Map([[opportunityId, opp.required_training_hours ?? null]])
  );

  const finalTasks = await prisma.field_training_tasks.findMany({
    where: { opportunity_id: opportunityId, is_final_task: true },
    select: {
      id: true,
      requires_ai_self_evaluation: true,
      field_training_task_submissions: {
        select: {
          application_id: true,
          review_status: true,
          student_self_evaluation_input: true,
          ai_response_inserted_text: true,
          ai_evaluated_at: true,
        },
      },
    },
  });

  const participants = apps.map((app) => {
    const mapped = mapApplicationAdminRow(app, byId[app.student_id], opp, hoursByApp.get(app.id));
    const finalTaskSubs = finalTasks.flatMap((task) =>
      (task.field_training_task_submissions || [])
        .filter((sub) => sub.application_id === app.id)
        .map((sub) => ({
          task_id: task.id,
          requires_ai_self_evaluation: task.requires_ai_self_evaluation,
          review_status: sub.review_status,
          ai_self_evaluation_completed: Boolean(
            sub.student_self_evaluation_input || sub.ai_response_inserted_text || sub.ai_evaluated_at
          ),
        }))
    );
    const aiRequired = finalTasks.some((t) => t.requires_ai_self_evaluation);
    const aiCompleted = !aiRequired
      ? null
      : finalTaskSubs.some((s) => s.requires_ai_self_evaluation && s.ai_self_evaluation_completed);

    return {
      application_id: mapped.id,
      student_id: mapped.student_id,
      student_name: mapped.student_name,
      student_email: mapped.student_email,
      student_university: mapped.student_university,
      student_university_specialty_label: mapped.student_university_specialty_label,
      training_status: mapped.training_status,
      attendance_percentage: mapped.attendance_percentage,
      minimum_attendance_percentage: opp.minimum_attendance_percentage ?? null,
      training_hours: mapped.training_hours,
      final_task_status: mapped.final_task_status,
      post_assessment_score: mapped.post_assessment_score,
      minimum_post_assessment_score:
        opp.minimum_post_assessment_score != null ? Number(opp.minimum_post_assessment_score) : null,
      ai_self_evaluation_completed: aiCompleted,
      eligibility_status: mapped.completion_eligibility_status,
      eligibility_reason: mapped.eligibility_reason,
      expelled_at: mapped.expelled_at,
      expulsion_reason: mapped.expulsion_reason,
      completion_letter_issued_at: mapped.completion_letter_issued_at,
    };
  });

  return {
    opportunity: {
      id: opp.id,
      title: opp.title,
      minimum_attendance_percentage: opp.minimum_attendance_percentage ?? null,
      required_training_hours:
        opp.required_training_hours != null ? Number(opp.required_training_hours) : null,
      minimum_post_assessment_score:
        opp.minimum_post_assessment_score != null ? Number(opp.minimum_post_assessment_score) : null,
      requires_final_task: opp.requires_final_task ?? true,
      requires_post_assessment: opp.requires_post_assessment ?? true,
    },
    participants,
  };
}

module.exports = {
  getEligibilityCatalog,
  listOpportunityEligibility,
  listAdminOpportunities,
  getAdminStats,
  getAdminOpportunityById,
  createAdminOpportunity,
  updateAdminOpportunity,
  publishOpportunity,
  archiveOpportunity,
  listOpportunityApplications,
  reviewApplication,
  listStudentOpportunities,
  listMyApplications,
  getStudentOpportunityById,
  applyToOpportunity,
  cancelApplication,
  listOpportunityTasks,
  createOpportunityTask,
  updateOpportunityTask,
  deleteOpportunityTask,
  listOpportunitySubmissions,
  getSubmissionDownloadUrl,
  downloadSubmissionFile,
  getTaskInstructionDownloadUrl,
  downloadTaskInstructionFile,
  submitTaskFile,
  listStudentOpportunityTasks,
  reviewSubmission,
};
