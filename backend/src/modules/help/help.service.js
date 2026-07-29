'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { isSystemWideAdmin } = require('../../utils/universityScope');
const {
  assertContentAdmin,
  assertSuperAdminRestore,
  sanitizeHtml,
  syncPublishedFlags,
  primaryRole,
  CONTENT_ADMIN_FORBIDDEN_MSG,
  assertTargetUniversitiesInScope,
  nowUtc,
  OFFICIAL_ROLES,
} = require('../contentCms/contentCms.shared');
const {
  FIELD_TRAINING_STUDENT_GUIDE_KEY,
  FIELD_TRAINING_STUDENT_GUIDE_VERSION,
  FIELD_TRAINING_INSTRUCTOR_GUIDE_KEY,
  FIELD_TRAINING_INSTRUCTOR_GUIDE_VERSION,
  FIELD_TRAINING_REVIEWER_GUIDE_KEY,
  FIELD_TRAINING_REVIEWER_GUIDE_VERSION,
  TOUR_STEP_COUNT,
} = require('./help.constants');

const OPTIMISTIC_LOCK_MSG =
  'تم تعديل هذا المحتوى بواسطة مستخدم آخر. راجع آخر نسخة قبل الحفظ.';

const OFFICIAL_ROLE_SET = new Set(OFFICIAL_ROLES);

const KNOWN_GUIDE_DEFAULTS = Object.freeze({
  [FIELD_TRAINING_STUDENT_GUIDE_KEY]: {
    guide_version: FIELD_TRAINING_STUDENT_GUIDE_VERSION,
    target_role: 'student',
    step_count: TOUR_STEP_COUNT,
  },
  [FIELD_TRAINING_INSTRUCTOR_GUIDE_KEY]: {
    guide_version: FIELD_TRAINING_INSTRUCTOR_GUIDE_VERSION,
    target_role: 'instructor',
    step_count: TOUR_STEP_COUNT,
  },
  [FIELD_TRAINING_REVIEWER_GUIDE_KEY]: {
    guide_version: FIELD_TRAINING_REVIEWER_GUIDE_VERSION,
    target_role: 'reviewer',
    step_count: TOUR_STEP_COUNT,
  },
});

function normalizeRoles(user) {
  const { normalizeRoleCodes } = require('../../utils/roleCanon');
  return normalizeRoleCodes(user?.roles || []);
}

function stripHtml(input) {
  return sanitizeHtml(input);
}

function normalizeTargetRoles(roles, fallback = ['student']) {
  if (!Array.isArray(roles)) return fallback;
  const filtered = [...new Set(roles.filter((r) => OFFICIAL_ROLE_SET.has(r)))];
  return filtered.length ? filtered : fallback;
}

function assertOptimisticLock(row, body = {}) {
  if (body.expected_version != null && Number(body.expected_version) !== Number(row.version)) {
    throw new ApiError(409, OPTIMISTIC_LOCK_MSG, null, 'CONTENT_VERSION_CONFLICT');
  }
  if (body.expected_updated_at != null) {
    const expected = new Date(body.expected_updated_at).getTime();
    const actual = new Date(row.updated_at).getTime();
    if (!Number.isNaN(expected) && expected !== actual) {
      throw new ApiError(409, OPTIMISTIC_LOCK_MSG, null, 'CONTENT_UPDATED_AT_CONFLICT');
    }
  }
}

function resolveCategoryStatus(body, existing = null) {
  if (body.status != null) return body.status;
  if (body.is_active != null) return body.is_active ? 'PUBLISHED' : 'ARCHIVED';
  return existing?.status || 'DRAFT';
}

function resolveArticleStatus(body, existing = null) {
  if (body.status != null) return body.status;
  if (body.is_published != null) return body.is_published ? 'PUBLISHED' : 'DRAFT';
  return existing?.status || 'DRAFT';
}

function universityVisibilityWhere(user) {
  const uni = user?.universityId || null;
  if (!uni) {
    return { target_university_ids: { equals: [] } };
  }
  return {
    OR: [{ target_university_ids: { equals: [] } }, { target_university_ids: { has: uni } }],
  };
}

function adminTargetScopeWhere(user) {
  if (isSystemWideAdmin(user)) return {};
  const uni = user?.universityId;
  if (!uni) {
    throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
  }
  return {
    OR: [{ target_university_ids: { has: uni } }, { target_university_ids: { equals: [] } }],
  };
}

function assertAdminCanAccessTargets(user, targetUniversityIds) {
  if (isSystemWideAdmin(user)) return;
  const uni = user?.universityId;
  if (!uni) {
    throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
  }
  const targets = targetUniversityIds || [];
  if (targets.length === 0) return;
  if (!targets.includes(uni)) {
    throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
  }
}

function coerceTargetUniversities(user, ids) {
  let list = Array.isArray(ids) ? [...ids] : [];
  if (!isSystemWideAdmin(user)) {
    const uni = user?.universityId;
    if (!uni) {
      throw new ApiError(403, CONTENT_ADMIN_FORBIDDEN_MSG, null, 'CONTENT_ADMIN_FORBIDDEN');
    }
    if (list.length === 0) list = [uni];
  }
  assertTargetUniversitiesInScope(user, list);
  return list;
}

function mapCategory(row, { articleCount = null } = {}) {
  return {
    id: row.id,
    title_ar: row.title_ar,
    title_en: row.title_en,
    slug: row.slug,
    description_ar: row.description_ar,
    description_en: row.description_en,
    icon: row.icon,
    sort_order: row.sort_order,
    is_active: row.is_active,
    status: row.status,
    target_roles: row.target_roles || [],
    target_university_ids: row.target_university_ids || [],
    created_by_id: row.created_by_id ?? undefined,
    updated_by_id: row.updated_by_id ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    articles_count: articleCount != null ? articleCount : row._count?.help_articles ?? undefined,
  };
}

function mapArticle(row, { includeContent = true } = {}) {
  const base = {
    id: row.id,
    category_id: row.category_id,
    category_slug: row.help_categories?.slug ?? null,
    category_title_ar: row.help_categories?.title_ar ?? null,
    title_ar: row.title_ar,
    title_en: row.title_en,
    slug: row.slug,
    summary_ar: row.summary_ar,
    summary_en: row.summary_en,
    keywords: row.keywords || [],
    sort_order: row.sort_order,
    is_published: row.is_published,
    status: row.status,
    version: row.version,
    published_at: row.published_at,
    published_by_id: row.published_by_id,
    target_roles: row.target_roles || [],
    target_university_ids: row.target_university_ids || [],
    target_opportunity_id: row.target_opportunity_id,
    related_route: row.related_route,
    contextual_key: row.contextual_key,
    show_in_contextual: row.show_in_contextual,
    guide_version: row.guide_version,
    is_faq: row.is_faq,
    view_count: row.view_count,
    created_by_id: row.created_by_id,
    updated_by_id: row.updated_by_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (includeContent) {
    base.content_ar = row.content_ar;
    base.content_en = row.content_en;
  }
  return base;
}

function mapArticleVersion(row) {
  return {
    id: row.id,
    article_id: row.article_id,
    version: row.version,
    title_ar: row.title_ar,
    summary_ar: row.summary_ar,
    content_ar: row.content_ar,
    keywords: row.keywords || [],
    target_roles: row.target_roles || [],
    related_route: row.related_route,
    contextual_key: row.contextual_key,
    is_faq: row.is_faq,
    snapshot_json: row.snapshot_json,
    created_by_id: row.created_by_id,
    published_by_id: row.published_by_id,
    created_at: row.created_at,
  };
}

function mapGuideStep(row) {
  return {
    id: row.id,
    guide_id: row.guide_id,
    title_ar: row.title_ar,
    body_ar: row.body_ar,
    icon: row.icon,
    image_url: row.image_url,
    tour_target: row.tour_target,
    related_route: row.related_route,
    sort_order: row.sort_order,
    is_required: row.is_required,
    can_skip: row.can_skip,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapGuide(row, { includeSteps = false } = {}) {
  const base = {
    id: row.id,
    name_ar: row.name_ar,
    guide_key: row.guide_key,
    guide_version: row.guide_version,
    target_role: row.target_role,
    status: row.status,
    version: row.version,
    auto_show: row.auto_show,
    show_conditions: row.show_conditions,
    can_skip: row.can_skip,
    reshow_on_new_version: row.reshow_on_new_version,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    created_by_id: row.created_by_id,
    updated_by_id: row.updated_by_id,
    published_by_id: row.published_by_id,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    steps_count: row._count?.user_guide_steps ?? row.user_guide_steps?.length ?? undefined,
  };
  if (includeSteps) {
    base.steps = (row.user_guide_steps || []).map(mapGuideStep);
  }
  return base;
}

function mapOnboarding(row, opts = {}) {
  const {
    shouldShow = false,
    updateAvailable = false,
    guideKey = FIELD_TRAINING_STUDENT_GUIDE_KEY,
    guideVersion = FIELD_TRAINING_STUDENT_GUIDE_VERSION,
    stepCount = TOUR_STEP_COUNT,
    guide = null,
    steps = null,
  } = opts;
  return {
    guide_key: guideKey,
    guide_version: guideVersion,
    step_count: stepCount,
    should_show: shouldShow,
    update_available: updateAvailable,
    status: row?.status || 'not_started',
    last_step: row?.last_step ?? 0,
    started_at: row?.started_at ?? null,
    completed_at: row?.completed_at ?? null,
    dismissed_at: row?.dismissed_at ?? null,
    guide,
    steps,
  };
}

function buildArticleSnapshot(article) {
  return {
    id: article.id,
    category_id: article.category_id,
    title_ar: article.title_ar,
    title_en: article.title_en,
    slug: article.slug,
    summary_ar: article.summary_ar,
    summary_en: article.summary_en,
    content_ar: article.content_ar,
    content_en: article.content_en,
    keywords: article.keywords || [],
    sort_order: article.sort_order,
    is_published: article.is_published,
    status: article.status,
    version: article.version,
    target_roles: article.target_roles || [],
    target_university_ids: article.target_university_ids || [],
    target_opportunity_id: article.target_opportunity_id,
    related_route: article.related_route,
    contextual_key: article.contextual_key,
    show_in_contextual: article.show_in_contextual,
    guide_version: article.guide_version,
    is_faq: article.is_faq,
  };
}

async function createArticleVersionRow(tx, article, userId) {
  return tx.help_article_versions.create({
    data: {
      article_id: article.id,
      version: article.version,
      title_ar: article.title_ar,
      summary_ar: article.summary_ar,
      content_ar: article.content_ar,
      keywords: article.keywords || [],
      target_roles: article.target_roles || [],
      related_route: article.related_route,
      contextual_key: article.contextual_key,
      is_faq: article.is_faq ?? false,
      snapshot_json: buildArticleSnapshot(article),
      created_by_id: userId || null,
      published_by_id: article.published_by_id || null,
    },
  });
}

async function studentHasActiveFieldTraining(userId) {
  const approved = await prisma.field_training_applications.count({
    where: {
      student_id: userId,
      status: 'approved',
      training_status: { not: 'expelled' },
      expelled_at: null,
    },
  });
  if (approved > 0) return true;

  const activeOppApps = await prisma.field_training_applications.count({
    where: {
      student_id: userId,
      status: { in: ['pending', 'approved'] },
      expelled_at: null,
      field_training_opportunities: {
        status: { in: ['published', 'in_progress'] },
      },
    },
  });
  return activeOppApps > 0;
}

async function loadPublishedGuide(guideKey, targetRole) {
  const now = nowUtc();
  return prisma.user_guides.findFirst({
    where: {
      guide_key: guideKey,
      target_role: targetRole,
      status: 'PUBLISHED',
      AND: [
        { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
        { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
      ],
    },
    include: {
      user_guide_steps: {
        where: { status: 'PUBLISHED' },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
      },
    },
    orderBy: [{ published_at: 'desc' }, { version: 'desc' }],
  });
}

async function getActiveOnboarding(user, guideKey) {
  const role = primaryRole(user);
  const defaults = KNOWN_GUIDE_DEFAULTS[guideKey] || null;
  const guide = role ? await loadPublishedGuide(guideKey, role) : null;

  if (guide && guide.target_role !== role) {
    throw new ApiError(403, 'هذه الجولة غير متاحة لدورك', null, 'ONBOARDING_ROLE_MISMATCH');
  }

  if (!guide && defaults && defaults.target_role !== role) {
    return mapOnboarding(null, {
      shouldShow: false,
      guideKey,
      guideVersion: defaults.guide_version,
      stepCount: defaults.step_count,
    });
  }

  if (!guide && !defaults) {
    throw new ApiError(404, 'الجولة غير موجودة', null, 'GUIDE_NOT_FOUND');
  }

  const guideVersion = guide?.guide_version || defaults.guide_version;
  const stepCount = guide?.user_guide_steps?.length || defaults?.step_count || TOUR_STEP_COUNT;
  const mappedGuide = guide ? mapGuide(guide, { includeSteps: true }) : null;
  const steps = mappedGuide?.steps || null;

  if (guideKey === FIELD_TRAINING_STUDENT_GUIDE_KEY && role === 'student') {
    const account = await prisma.users.findUnique({
      where: { id: user.userId },
      select: { status: true, email_verified_at: true },
    });
    if (!account || account.status !== 'active' || !account.email_verified_at) {
      return mapOnboarding(null, {
        shouldShow: false,
        guideKey,
        guideVersion,
        stepCount,
        guide: mappedGuide,
        steps,
      });
    }
  }

  const current = await prisma.user_onboarding_progress.findUnique({
    where: {
      user_id_guide_key_guide_version: {
        user_id: user.userId,
        guide_key: guideKey,
        guide_version: guideVersion,
      },
    },
  });

  const olderCompleted = await prisma.user_onboarding_progress.findFirst({
    where: {
      user_id: user.userId,
      guide_key: guideKey,
      guide_version: { not: guideVersion },
      status: 'completed',
    },
    orderBy: { completed_at: 'desc' },
  });

  const reshow = guide?.reshow_on_new_version === true;
  const updateAvailable =
    Boolean(olderCompleted) &&
    (!current || current.status !== 'completed') &&
    (reshow || !guide);

  let eligible = true;
  if (guideKey === FIELD_TRAINING_STUDENT_GUIDE_KEY && role === 'student') {
    eligible = await studentHasActiveFieldTraining(user.userId);
  }

  const autoShow = guide ? guide.auto_show !== false : true;
  const completedCurrent = current?.status === 'completed';
  const dismissed = current?.status === 'dismissed';
  const shouldShow = Boolean(eligible && autoShow && !completedCurrent && !dismissed);

  return mapOnboarding(current, {
    shouldShow,
    updateAvailable,
    guideKey,
    guideVersion,
    stepCount,
    guide: mappedGuide,
    steps,
  });
}

async function getStudentOnboardingState(user) {
  return getActiveOnboarding(user, FIELD_TRAINING_STUDENT_GUIDE_KEY);
}

async function resolveGuideVersionForUser(user, guideKey) {
  const role = primaryRole(user);
  const defaults = KNOWN_GUIDE_DEFAULTS[guideKey];
  if (defaults && defaults.target_role !== role) {
    throw new ApiError(403, 'هذه الجولة غير متاحة لدورك', null, 'ONBOARDING_ROLE_MISMATCH');
  }
  const guide = role ? await loadPublishedGuide(guideKey, role) : null;
  if (guide) return { guide, guideVersion: guide.guide_version, stepCount: guide.user_guide_steps.length };
  if (defaults) {
    return { guide: null, guideVersion: defaults.guide_version, stepCount: defaults.step_count };
  }
  throw new ApiError(404, 'الجولة غير موجودة', null, 'GUIDE_NOT_FOUND');
}

async function upsertOnboarding(userId, guideKey, guideVersion, data) {
  return prisma.user_onboarding_progress.upsert({
    where: {
      user_id_guide_key_guide_version: {
        user_id: userId,
        guide_key: guideKey,
        guide_version: guideVersion,
      },
    },
    create: {
      user_id: userId,
      guide_key: guideKey,
      guide_version: guideVersion,
      ...data,
    },
    update: {
      ...data,
      updated_at: new Date(),
    },
  });
}

async function startOnboarding(user, guideKey = FIELD_TRAINING_STUDENT_GUIDE_KEY) {
  const { guide, guideVersion, stepCount } = await resolveGuideVersionForUser(user, guideKey);
  const now = new Date();
  const row = await upsertOnboarding(user.userId, guideKey, guideVersion, {
    status: 'in_progress',
    started_at: now,
    last_step: 0,
    dismissed_at: null,
    completed_at: null,
  });
  return mapOnboarding(row, {
    shouldShow: true,
    guideKey,
    guideVersion,
    stepCount,
    guide: guide ? mapGuide(guide, { includeSteps: true }) : null,
    steps: guide ? guide.user_guide_steps.map(mapGuideStep) : null,
  });
}

async function updateOnboardingProgress(user, body, guideKey = FIELD_TRAINING_STUDENT_GUIDE_KEY) {
  const { guide, guideVersion, stepCount } = await resolveGuideVersionForUser(user, guideKey);
  const step = Number(body.last_step ?? body.step ?? 0);
  const existing = await prisma.user_onboarding_progress.findUnique({
    where: {
      user_id_guide_key_guide_version: {
        user_id: user.userId,
        guide_key: guideKey,
        guide_version: guideVersion,
      },
    },
  });
  const row = await upsertOnboarding(user.userId, guideKey, guideVersion, {
    status: existing?.status === 'completed' ? 'completed' : 'in_progress',
    last_step: step,
    started_at: existing?.started_at || new Date(),
  });
  return mapOnboarding(row, {
    shouldShow: row.status !== 'completed',
    guideKey,
    guideVersion,
    stepCount,
    guide: guide ? mapGuide(guide, { includeSteps: true }) : null,
    steps: guide ? guide.user_guide_steps.map(mapGuideStep) : null,
  });
}

async function completeOnboarding(user, guideKey = FIELD_TRAINING_STUDENT_GUIDE_KEY) {
  const { guide, guideVersion, stepCount } = await resolveGuideVersionForUser(user, guideKey);
  const now = new Date();
  const row = await upsertOnboarding(user.userId, guideKey, guideVersion, {
    status: 'completed',
    completed_at: now,
    last_step: stepCount,
    started_at: now,
    dismissed_at: null,
  });
  return mapOnboarding(row, {
    shouldShow: false,
    guideKey,
    guideVersion,
    stepCount,
    guide: guide ? mapGuide(guide, { includeSteps: true }) : null,
    steps: guide ? guide.user_guide_steps.map(mapGuideStep) : null,
  });
}

async function dismissOnboarding(user, guideKey = FIELD_TRAINING_STUDENT_GUIDE_KEY) {
  const { guide, guideVersion, stepCount } = await resolveGuideVersionForUser(user, guideKey);
  if (guide && guide.can_skip === false) {
    throw new ApiError(400, 'لا يمكن تخطي هذه الجولة', null, 'ONBOARDING_NOT_SKIPPABLE');
  }
  const now = new Date();
  const existing = await prisma.user_onboarding_progress.findUnique({
    where: {
      user_id_guide_key_guide_version: {
        user_id: user.userId,
        guide_key: guideKey,
        guide_version: guideVersion,
      },
    },
  });
  if (existing?.status === 'completed') {
    return mapOnboarding(existing, {
      shouldShow: false,
      guideKey,
      guideVersion,
      stepCount,
      guide: guide ? mapGuide(guide, { includeSteps: true }) : null,
      steps: guide ? guide.user_guide_steps.map(mapGuideStep) : null,
    });
  }
  const row = await upsertOnboarding(user.userId, guideKey, guideVersion, {
    status: 'dismissed',
    dismissed_at: now,
    started_at: existing?.started_at || now,
    last_step: existing?.last_step ?? 0,
  });
  return mapOnboarding(row, {
    shouldShow: false,
    guideKey,
    guideVersion,
    stepCount,
    guide: guide ? mapGuide(guide, { includeSteps: true }) : null,
    steps: guide ? guide.user_guide_steps.map(mapGuideStep) : null,
  });
}

async function restartOnboarding(user, guideKey = FIELD_TRAINING_STUDENT_GUIDE_KEY) {
  const { guide, guideVersion, stepCount } = await resolveGuideVersionForUser(user, guideKey);
  const now = new Date();
  const row = await upsertOnboarding(user.userId, guideKey, guideVersion, {
    status: 'in_progress',
    started_at: now,
    completed_at: null,
    dismissed_at: null,
    last_step: 0,
  });
  return mapOnboarding(row, {
    shouldShow: true,
    guideKey,
    guideVersion,
    stepCount,
    guide: guide ? mapGuide(guide, { includeSteps: true }) : null,
    steps: guide ? guide.user_guide_steps.map(mapGuideStep) : null,
  });
}

function publishedCatalogWhere(user) {
  const role = primaryRole(user) || 'student';
  return {
    status: 'PUBLISHED',
    target_roles: { has: role },
    ...universityVisibilityWhere(user),
  };
}

async function listPublishedCategories(user) {
  const role = primaryRole(user) || 'student';
  const uniWhere = universityVisibilityWhere(user);
  const rows = await prisma.help_categories.findMany({
    where: {
      status: 'PUBLISHED',
      is_active: true,
      target_roles: { has: role },
      ...uniWhere,
    },
    orderBy: [{ sort_order: 'asc' }, { title_ar: 'asc' }],
    include: {
      _count: {
        select: {
          help_articles: {
            where: {
              status: 'PUBLISHED',
              is_published: true,
              target_roles: { has: role },
              ...uniWhere,
            },
          },
        },
      },
    },
  });
  return { categories: rows.map((r) => mapCategory(r)) };
}

async function listPublishedArticles(user, { categorySlug = null, faqOnly = false } = {}) {
  const where = {
    ...publishedCatalogWhere(user),
    is_published: true,
  };
  if (faqOnly) where.is_faq = true;
  if (categorySlug) {
    where.help_categories = { slug: categorySlug, status: 'PUBLISHED', is_active: true };
  }
  const rows = await prisma.help_articles.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { title_ar: 'asc' }],
    include: { help_categories: { select: { slug: true, title_ar: true } } },
  });
  return { articles: rows.map((r) => mapArticle(r, { includeContent: false })) };
}

async function getPublishedArticleBySlug(user, slug) {
  const row = await prisma.help_articles.findFirst({
    where: {
      slug,
      ...publishedCatalogWhere(user),
      is_published: true,
      help_categories: { status: 'PUBLISHED', is_active: true },
    },
    include: { help_categories: { select: { slug: true, title_ar: true, id: true } } },
  });
  if (!row) throw new ApiError(404, 'المقال غير موجود');
  return { article: mapArticle(row) };
}

async function recordArticleView(user, articleId) {
  const article = await prisma.help_articles.findFirst({
    where: {
      id: articleId,
      ...publishedCatalogWhere(user),
      is_published: true,
    },
    select: { id: true },
  });
  if (!article) throw new ApiError(404, 'المقال غير موجود');

  await prisma.$transaction([
    prisma.help_article_views.create({
      data: { article_id: articleId, user_id: user.userId || null },
    }),
    prisma.help_articles.update({
      where: { id: articleId },
      data: { view_count: { increment: 1 }, updated_at: new Date() },
    }),
  ]);
  return { ok: true };
}

function scoreArticle(article, tokens) {
  let score = 0;
  const title = String(article.title_ar || '').toLowerCase();
  const summary = String(article.summary_ar || '').toLowerCase();
  const content = String(article.content_ar || '').toLowerCase();
  const keywords = (article.keywords || []).map((k) => String(k).toLowerCase());
  for (const token of tokens) {
    if (title.includes(token)) score += 8;
    if (keywords.some((k) => k.includes(token) || token.includes(k))) score += 6;
    if (summary.includes(token)) score += 3;
    if (content.includes(token)) score += 1;
  }
  return score;
}

async function searchHelp(user, query, limit = 20) {
  const q = String(query || '').trim();
  const tokens = q
    .toLowerCase()
    .split(/[\s,،]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const articles = await prisma.help_articles.findMany({
    where: {
      ...publishedCatalogWhere(user),
      is_published: true,
      help_categories: { status: 'PUBLISHED', is_active: true },
    },
    include: { help_categories: { select: { slug: true, title_ar: true } } },
  });

  const ranked = articles
    .map((a) => ({ article: a, score: scoreArticle(a, tokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => mapArticle(x.article, { includeContent: false }));

  await prisma.help_search_logs.create({
    data: {
      user_id: user.userId || null,
      query: q.slice(0, 500),
      results_count: ranked.length,
    },
  });

  return {
    query: q,
    results: ranked,
    empty: ranked.length === 0,
    support_hint: ranked.length === 0,
  };
}

async function getContextualHelp(user, { route, key } = {}) {
  const role = primaryRole(user) || 'student';
  const routePath = route ? String(route).split('?')[0] : null;
  const or = [];
  if (key) or.push({ contextual_key: key });
  if (routePath) or.push({ related_route: { contains: routePath } });
  or.push({ show_in_contextual: true });

  const rows = await prisma.help_articles.findMany({
    where: {
      status: 'PUBLISHED',
      is_published: true,
      target_roles: { has: role },
      ...universityVisibilityWhere(user),
      OR: or,
    },
    orderBy: [{ sort_order: 'asc' }, { title_ar: 'asc' }],
    take: 8,
    include: { help_categories: { select: { slug: true, title_ar: true } } },
  });

  const guidePathByRole = {
    student: '/student/user-guide',
    instructor: '/instructor/user-guide',
    reviewer: '/reviewer/user-guide',
    admin: '/admin/content-hub/help',
    super_admin: '/admin/content-hub/help',
  };

  return {
    articles: rows.map((r) => mapArticle(r, { includeContent: false })),
    guide_path: guidePathByRole[role] || '/help',
  };
}

function makeReferenceCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ST-${stamp}-${rand}`;
}

async function createSupportTicket(user, body) {
  if (primaryRole(user) !== 'student') {
    throw new ApiError(403, 'إنشاء تذاكر الدعم متاح للطلاب', null, 'SUPPORT_STUDENT_ONLY');
  }
  const ticket = await prisma.support_tickets.create({
    data: {
      reference_code: makeReferenceCode(),
      user_id: user.userId,
      category: body.category,
      title: body.title.trim(),
      description: stripHtml(body.description),
      opportunity_id: body.opportunity_id || null,
      session_id: body.session_id || null,
      task_id: body.task_id || null,
      assessment_id: body.assessment_id || null,
      browser_info: body.browser_info || null,
      device_info: body.device_info || null,
      attachment_file_id: body.attachment_file_id || null,
    },
  });
  return { ticket };
}

async function listMySupportTickets(user) {
  if (primaryRole(user) !== 'student') {
    throw new ApiError(403, 'غير مصرح', null, 'SUPPORT_STUDENT_ONLY');
  }
  const tickets = await prisma.support_tickets.findMany({
    where: { user_id: user.userId },
    orderBy: { created_at: 'desc' },
  });
  return { tickets };
}

async function getMySupportTicket(user, id) {
  if (primaryRole(user) !== 'student') {
    throw new ApiError(403, 'غير مصرح', null, 'SUPPORT_STUDENT_ONLY');
  }
  const ticket = await prisma.support_tickets.findFirst({
    where: { id, user_id: user.userId },
  });
  if (!ticket) throw new ApiError(404, 'التذكرة غير موجودة');
  return { ticket };
}

/* -------- Admin categories / articles -------- */

async function adminListCategories(user) {
  assertContentAdmin(user);
  const rows = await prisma.help_categories.findMany({
    where: adminTargetScopeWhere(user),
    orderBy: [{ sort_order: 'asc' }, { title_ar: 'asc' }],
    include: { _count: { select: { help_articles: true } } },
  });
  return { categories: rows.map((r) => mapCategory(r)) };
}

async function adminCreateCategory(user, body) {
  assertContentAdmin(user);
  const status = resolveCategoryStatus(body);
  const flags = syncPublishedFlags(status);
  const targetUniversities = coerceTargetUniversities(user, body.target_university_ids);
  const row = await prisma.help_categories.create({
    data: {
      title_ar: body.title_ar,
      title_en: body.title_en || null,
      slug: body.slug,
      description_ar: body.description_ar || null,
      description_en: body.description_en || null,
      icon: body.icon || null,
      sort_order: body.sort_order ?? 0,
      status,
      is_active: flags.is_active,
      target_roles: normalizeTargetRoles(body.target_roles),
      target_university_ids: targetUniversities,
      created_by_id: user.userId,
      updated_by_id: user.userId,
    },
  });
  await recordAudit({
    userId: user.userId,
    actionType: 'HELP_CATEGORY_CREATED',
    entityType: 'help_categories',
    entityId: row.id,
    newValues: { slug: row.slug, title_ar: row.title_ar, status: row.status },
  });
  return { category: mapCategory(row) };
}

async function adminUpdateCategory(user, id, body) {
  assertContentAdmin(user);
  const existing = await prisma.help_categories.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'القسم غير موجود');
  assertAdminCanAccessTargets(user, existing.target_university_ids);
  assertOptimisticLock({ version: 1, updated_at: existing.updated_at }, body);

  const data = {
    updated_by_id: user.userId,
    updated_at: nowUtc(),
  };
  for (const key of [
    'title_ar',
    'title_en',
    'slug',
    'description_ar',
    'description_en',
    'icon',
    'sort_order',
  ]) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.target_roles) data.target_roles = normalizeTargetRoles(body.target_roles);
  if (body.target_university_ids !== undefined) {
    data.target_university_ids = coerceTargetUniversities(user, body.target_university_ids);
  }
  if (body.status != null || body.is_active != null) {
    const status = resolveCategoryStatus(body, existing);
    const flags = syncPublishedFlags(status);
    data.status = status;
    data.is_active = flags.is_active;
  }

  const row = await prisma.help_categories.update({ where: { id }, data });
  await recordAudit({
    userId: user.userId,
    actionType: 'HELP_CATEGORY_UPDATED',
    entityType: 'help_categories',
    entityId: id,
    oldValues: { slug: existing.slug, status: existing.status, is_active: existing.is_active },
    newValues: { slug: row.slug, status: row.status, is_active: row.is_active },
  });
  return { category: mapCategory(row) };
}

async function adminArchiveCategory(user, id) {
  assertContentAdmin(user);
  const existing = await prisma.help_categories.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'القسم غير موجود');
  assertAdminCanAccessTargets(user, existing.target_university_ids);
  const flags = syncPublishedFlags('ARCHIVED');
  const row = await prisma.help_categories.update({
    where: { id },
    data: {
      status: 'ARCHIVED',
      is_active: flags.is_active,
      updated_by_id: user.userId,
      updated_at: nowUtc(),
    },
  });
  await recordAudit({
    userId: user.userId,
    actionType: 'HELP_CATEGORY_ARCHIVED',
    entityType: 'help_categories',
    entityId: id,
    oldValues: { status: existing.status },
    newValues: { status: row.status },
  });
  return { category: mapCategory(row) };
}

async function adminDeleteCategory(user, id) {
  return adminArchiveCategory(user, id);
}

async function adminListArticles(user, { categoryId } = {}) {
  assertContentAdmin(user);
  const where = {
    ...adminTargetScopeWhere(user),
    ...(categoryId ? { category_id: categoryId } : {}),
  };
  const rows = await prisma.help_articles.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { title_ar: 'asc' }],
    include: { help_categories: { select: { slug: true, title_ar: true } } },
  });
  return { articles: rows.map((r) => mapArticle(r)) };
}

async function adminCreateArticle(user, body) {
  assertContentAdmin(user);
  const status = resolveArticleStatus(body);
  const flags = syncPublishedFlags(status);
  const targetUniversities = coerceTargetUniversities(user, body.target_university_ids);
  const now = nowUtc();
  const row = await prisma.help_articles.create({
    data: {
      category_id: body.category_id,
      title_ar: body.title_ar,
      title_en: body.title_en || null,
      slug: body.slug,
      summary_ar: body.summary_ar || null,
      summary_en: body.summary_en || null,
      content_ar: sanitizeHtml(body.content_ar),
      content_en: body.content_en ? sanitizeHtml(body.content_en) : null,
      keywords: body.keywords || [],
      sort_order: body.sort_order ?? 0,
      status,
      is_published: flags.is_published,
      version: 1,
      published_at: status === 'PUBLISHED' ? now : null,
      published_by_id: status === 'PUBLISHED' ? user.userId : null,
      target_roles: normalizeTargetRoles(body.target_roles),
      target_university_ids: targetUniversities,
      target_opportunity_id: body.target_opportunity_id || null,
      related_route: body.related_route || null,
      contextual_key: body.contextual_key || null,
      show_in_contextual: body.show_in_contextual ?? false,
      guide_version: body.guide_version || FIELD_TRAINING_STUDENT_GUIDE_VERSION,
      is_faq: body.is_faq ?? false,
      created_by_id: user.userId,
      updated_by_id: user.userId,
    },
    include: { help_categories: { select: { slug: true, title_ar: true } } },
  });
  await recordAudit({
    userId: user.userId,
    actionType: 'HELP_ARTICLE_CREATED',
    entityType: 'help_articles',
    entityId: row.id,
    newValues: { slug: row.slug, title_ar: row.title_ar, status: row.status, version: row.version },
  });
  return { article: mapArticle(row) };
}

async function adminUpdateArticle(user, id, body) {
  assertContentAdmin(user);
  const existing = await prisma.help_articles.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'المقال غير موجود');
  assertAdminCanAccessTargets(user, existing.target_university_ids);
  assertOptimisticLock(existing, body);

  const data = {
    updated_by_id: user.userId,
    updated_at: nowUtc(),
  };
  for (const key of [
    'category_id',
    'title_ar',
    'title_en',
    'slug',
    'summary_ar',
    'summary_en',
    'keywords',
    'sort_order',
    'target_opportunity_id',
    'related_route',
    'contextual_key',
    'show_in_contextual',
    'guide_version',
    'is_faq',
  ]) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.target_roles) data.target_roles = normalizeTargetRoles(body.target_roles);
  if (body.target_university_ids !== undefined) {
    data.target_university_ids = coerceTargetUniversities(user, body.target_university_ids);
  }
  if (body.content_ar !== undefined) data.content_ar = sanitizeHtml(body.content_ar);
  if (body.content_en !== undefined) {
    data.content_en = body.content_en ? sanitizeHtml(body.content_en) : null;
  }
  if (body.status != null || body.is_published != null) {
    const status = resolveArticleStatus(body, existing);
    const flags = syncPublishedFlags(status);
    data.status = status;
    data.is_published = flags.is_published;
    if (status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      data.published_at = nowUtc();
      data.published_by_id = user.userId;
    }
  }

  const wasPublished = existing.status === 'PUBLISHED' || existing.is_published;
  const contentTouched = [
    'title_ar',
    'title_en',
    'summary_ar',
    'summary_en',
    'content_ar',
    'content_en',
    'keywords',
    'target_roles',
    'related_route',
    'contextual_key',
    'is_faq',
    'show_in_contextual',
  ].some((k) => body[k] !== undefined);

  const row = await prisma.$transaction(async (tx) => {
    if (wasPublished && contentTouched) {
      await createArticleVersionRow(tx, existing, user.userId);
      data.version = (existing.version || 1) + 1;
    }
    return tx.help_articles.update({
      where: { id },
      data,
      include: { help_categories: { select: { slug: true, title_ar: true } } },
    });
  });

  await recordAudit({
    userId: user.userId,
    actionType: data.is_published === false ? 'HELP_ARTICLE_UNPUBLISHED' : 'HELP_ARTICLE_UPDATED',
    entityType: 'help_articles',
    entityId: id,
    oldValues: { slug: existing.slug, status: existing.status, version: existing.version },
    newValues: { slug: row.slug, status: row.status, version: row.version },
  });
  return { article: mapArticle(row) };
}

async function adminPublishArticle(user, id, publish = true) {
  assertContentAdmin(user);
  const existing = await prisma.help_articles.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'المقال غير موجود');
  assertAdminCanAccessTargets(user, existing.target_university_ids);

  const status = publish ? 'PUBLISHED' : 'DRAFT';
  const flags = syncPublishedFlags(status);
  const now = nowUtc();

  const row = await prisma.$transaction(async (tx) => {
    if (publish && existing.status === 'PUBLISHED') {
      await createArticleVersionRow(tx, existing, user.userId);
    }
    return tx.help_articles.update({
      where: { id },
      data: {
        status,
        is_published: flags.is_published,
        published_at: publish ? existing.published_at || now : existing.published_at,
        published_by_id: publish ? user.userId : existing.published_by_id,
        version:
          publish && existing.status === 'PUBLISHED'
            ? (existing.version || 1) + 1
            : existing.version,
        updated_by_id: user.userId,
        updated_at: now,
      },
      include: { help_categories: { select: { slug: true, title_ar: true } } },
    });
  });

  await recordAudit({
    userId: user.userId,
    actionType: publish ? 'HELP_ARTICLE_PUBLISHED' : 'HELP_ARTICLE_UNPUBLISHED',
    entityType: 'help_articles',
    entityId: id,
    oldValues: { status: existing.status, version: existing.version },
    newValues: { status: row.status, version: row.version },
  });
  return { article: mapArticle(row) };
}

async function adminArchiveArticle(user, id) {
  assertContentAdmin(user);
  const existing = await prisma.help_articles.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'المقال غير موجود');
  assertAdminCanAccessTargets(user, existing.target_university_ids);
  const flags = syncPublishedFlags('ARCHIVED');
  const row = await prisma.help_articles.update({
    where: { id },
    data: {
      status: 'ARCHIVED',
      is_published: flags.is_published,
      updated_by_id: user.userId,
      updated_at: nowUtc(),
    },
    include: { help_categories: { select: { slug: true, title_ar: true } } },
  });
  await recordAudit({
    userId: user.userId,
    actionType: 'HELP_ARTICLE_ARCHIVED',
    entityType: 'help_articles',
    entityId: id,
    oldValues: { status: existing.status },
    newValues: { status: row.status },
  });
  return { article: mapArticle(row) };
}

async function adminDeleteArticle(user, id) {
  return adminArchiveArticle(user, id);
}

async function adminListArticleVersions(user, id) {
  assertContentAdmin(user);
  const existing = await prisma.help_articles.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'المقال غير موجود');
  assertAdminCanAccessTargets(user, existing.target_university_ids);
  const rows = await prisma.help_article_versions.findMany({
    where: { article_id: id },
    orderBy: { version: 'desc' },
  });
  return { versions: rows.map(mapArticleVersion), current_version: existing.version };
}

async function adminRestoreArticleVersion(user, id, version) {
  assertSuperAdminRestore(user);
  const existing = await prisma.help_articles.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'المقال غير موجود');

  const snapshot = await prisma.help_article_versions.findFirst({
    where: { article_id: id, version: Number(version) },
  });
  if (!snapshot) throw new ApiError(404, 'الإصدار غير موجود');

  const snap = snapshot.snapshot_json && typeof snapshot.snapshot_json === 'object'
    ? snapshot.snapshot_json
    : null;

  const row = await prisma.$transaction(async (tx) => {
    await createArticleVersionRow(tx, existing, user.userId);
    const nextVersion = (existing.version || 1) + 1;
    return tx.help_articles.update({
      where: { id },
      data: {
        title_ar: snap?.title_ar ?? snapshot.title_ar,
        title_en: snap?.title_en ?? existing.title_en,
        summary_ar: snap?.summary_ar ?? snapshot.summary_ar,
        summary_en: snap?.summary_en ?? existing.summary_en,
        content_ar: snap?.content_ar ?? snapshot.content_ar,
        content_en: snap?.content_en ?? existing.content_en,
        keywords: snap?.keywords ?? snapshot.keywords ?? [],
        target_roles: snap?.target_roles ?? snapshot.target_roles ?? existing.target_roles,
        related_route: snap?.related_route ?? snapshot.related_route,
        contextual_key: snap?.contextual_key ?? snapshot.contextual_key,
        is_faq: snap?.is_faq ?? snapshot.is_faq,
        show_in_contextual:
          snap?.show_in_contextual != null ? snap.show_in_contextual : existing.show_in_contextual,
        version: nextVersion,
        updated_by_id: user.userId,
        updated_at: nowUtc(),
      },
      include: { help_categories: { select: { slug: true, title_ar: true } } },
    });
  });

  await recordAudit({
    userId: user.userId,
    actionType: 'HELP_ARTICLE_VERSION_RESTORED',
    entityType: 'help_articles',
    entityId: id,
    oldValues: { version: existing.version },
    newValues: { restored_from: Number(version), version: row.version },
  });
  return { article: mapArticle(row) };
}

async function adminReorderArticles(user, items) {
  assertContentAdmin(user);
  await prisma.$transaction(
    items.map((item) =>
      prisma.help_articles.update({
        where: { id: item.id },
        data: { sort_order: item.sort_order, updated_at: new Date() },
      })
    )
  );
  await recordAudit({
    userId: user.userId,
    actionType: 'HELP_ARTICLES_REORDERED',
    entityType: 'help_articles',
    entityId: null,
    newValues: { count: items.length },
  });
  return { ok: true };
}

async function adminHelpAnalytics(user) {
  assertContentAdmin(user);
  const guideWhere = {
    guide_key: FIELD_TRAINING_STUDENT_GUIDE_KEY,
    guide_version: FIELD_TRAINING_STUDENT_GUIDE_VERSION,
  };
  const [started, completed, dismissed, topArticles, emptySearches, ticketGroups] =
    await Promise.all([
      prisma.user_onboarding_progress.count({
        where: { ...guideWhere, status: { in: ['in_progress', 'completed', 'dismissed'] } },
      }),
      prisma.user_onboarding_progress.count({ where: { ...guideWhere, status: 'completed' } }),
      prisma.user_onboarding_progress.count({ where: { ...guideWhere, status: 'dismissed' } }),
      prisma.help_articles.findMany({
        where: { status: 'PUBLISHED', is_published: true },
        orderBy: { view_count: 'desc' },
        take: 10,
        select: { id: true, slug: true, title_ar: true, view_count: true },
      }),
      prisma.help_search_logs.count({ where: { results_count: 0 } }),
      prisma.support_tickets.groupBy({
        by: ['category'],
        _count: { _all: true },
        orderBy: { _count: { category: 'desc' } },
        take: 10,
      }),
    ]);

  return {
    onboarding: { started, completed, dismissed },
    top_articles: topArticles,
    empty_searches: emptySearches,
    ticket_categories: ticketGroups.map((g) => ({
      category: g.category,
      count: g._count._all,
    })),
    guide_version: FIELD_TRAINING_STUDENT_GUIDE_VERSION,
  };
}

/* -------- Admin user guides -------- */

async function adminListGuides(user) {
  assertContentAdmin(user);
  const rows = await prisma.user_guides.findMany({
    orderBy: [{ updated_at: 'desc' }],
    include: { _count: { select: { user_guide_steps: true } } },
  });
  return { guides: rows.map((r) => mapGuide(r)) };
}

async function adminGetGuide(user, id) {
  assertContentAdmin(user);
  const row = await prisma.user_guides.findUnique({
    where: { id },
    include: {
      user_guide_steps: { orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] },
    },
  });
  if (!row) throw new ApiError(404, 'الجولة غير موجودة');
  return { guide: mapGuide(row, { includeSteps: true }) };
}

async function adminCreateGuide(user, body) {
  assertContentAdmin(user);
  const row = await prisma.user_guides.create({
    data: {
      name_ar: body.name_ar,
      guide_key: body.guide_key,
      guide_version: body.guide_version,
      target_role: body.target_role,
      status: body.status || 'DRAFT',
      version: 1,
      auto_show: body.auto_show ?? true,
      show_conditions: body.show_conditions ?? null,
      can_skip: body.can_skip ?? true,
      reshow_on_new_version: body.reshow_on_new_version ?? false,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      created_by_id: user.userId,
      updated_by_id: user.userId,
    },
  });
  await recordAudit({
    userId: user.userId,
    actionType: 'USER_GUIDE_CREATED',
    entityType: 'user_guides',
    entityId: row.id,
    newValues: { guide_key: row.guide_key, guide_version: row.guide_version },
  });
  return { guide: mapGuide(row) };
}

async function adminUpdateGuide(user, id, body) {
  assertContentAdmin(user);
  const existing = await prisma.user_guides.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'الجولة غير موجودة');
  assertOptimisticLock(existing, body);

  const data = {
    updated_by_id: user.userId,
    updated_at: nowUtc(),
  };
  for (const key of [
    'name_ar',
    'guide_key',
    'guide_version',
    'target_role',
    'status',
    'auto_show',
    'show_conditions',
    'can_skip',
    'reshow_on_new_version',
    'starts_at',
    'ends_at',
  ]) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  const row = await prisma.user_guides.update({ where: { id }, data });
  await recordAudit({
    userId: user.userId,
    actionType: 'USER_GUIDE_UPDATED',
    entityType: 'user_guides',
    entityId: id,
    oldValues: { status: existing.status, version: existing.version },
    newValues: { status: row.status, version: row.version },
  });
  return { guide: mapGuide(row) };
}

async function adminPublishGuide(user, id, body = {}) {
  assertContentAdmin(user);
  const existing = await prisma.user_guides.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'الجولة غير موجودة');
  assertOptimisticLock(existing, body);

  const now = nowUtc();
  const bumpVersion = body.reshow_on_new_version === true || existing.reshow_on_new_version;
  const row = await prisma.user_guides.update({
    where: { id },
    data: {
      status: 'PUBLISHED',
      published_at: now,
      published_by_id: user.userId,
      reshow_on_new_version:
        body.reshow_on_new_version != null
          ? body.reshow_on_new_version
          : existing.reshow_on_new_version,
      version: bumpVersion ? (existing.version || 1) + 1 : existing.version,
      updated_by_id: user.userId,
      updated_at: now,
    },
  });
  await recordAudit({
    userId: user.userId,
    actionType: 'USER_GUIDE_PUBLISHED',
    entityType: 'user_guides',
    entityId: id,
    oldValues: { status: existing.status, version: existing.version },
    newValues: { status: row.status, version: row.version },
  });
  return { guide: mapGuide(row) };
}

async function adminArchiveGuide(user, id) {
  assertContentAdmin(user);
  const existing = await prisma.user_guides.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'الجولة غير موجودة');
  const row = await prisma.user_guides.update({
    where: { id },
    data: {
      status: 'ARCHIVED',
      updated_by_id: user.userId,
      updated_at: nowUtc(),
    },
  });
  await recordAudit({
    userId: user.userId,
    actionType: 'USER_GUIDE_ARCHIVED',
    entityType: 'user_guides',
    entityId: id,
    oldValues: { status: existing.status },
    newValues: { status: row.status },
  });
  return { guide: mapGuide(row) };
}

async function adminCreateGuideStep(user, guideId, body) {
  assertContentAdmin(user);
  const guide = await prisma.user_guides.findUnique({ where: { id: guideId } });
  if (!guide) throw new ApiError(404, 'الجولة غير موجودة');
  const row = await prisma.user_guide_steps.create({
    data: {
      guide_id: guideId,
      title_ar: body.title_ar,
      body_ar: sanitizeHtml(body.body_ar),
      icon: body.icon || null,
      image_url: body.image_url || null,
      tour_target: body.tour_target || null,
      related_route: body.related_route || null,
      sort_order: body.sort_order ?? 0,
      is_required: body.is_required ?? false,
      can_skip: body.can_skip ?? true,
      status: body.status || 'PUBLISHED',
    },
  });
  await prisma.user_guides.update({
    where: { id: guideId },
    data: { updated_by_id: user.userId, updated_at: nowUtc() },
  });
  return { step: mapGuideStep(row) };
}

async function adminUpdateGuideStep(user, guideId, stepId, body) {
  assertContentAdmin(user);
  const existing = await prisma.user_guide_steps.findFirst({
    where: { id: stepId, guide_id: guideId },
  });
  if (!existing) throw new ApiError(404, 'خطوة الجولة غير موجودة');
  const data = { updated_at: nowUtc() };
  for (const key of [
    'title_ar',
    'icon',
    'image_url',
    'tour_target',
    'related_route',
    'sort_order',
    'is_required',
    'can_skip',
    'status',
  ]) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.body_ar !== undefined) data.body_ar = sanitizeHtml(body.body_ar);
  const row = await prisma.user_guide_steps.update({ where: { id: stepId }, data });
  await prisma.user_guides.update({
    where: { id: guideId },
    data: { updated_by_id: user.userId, updated_at: nowUtc() },
  });
  return { step: mapGuideStep(row) };
}

async function adminDeleteGuideStep(user, guideId, stepId) {
  assertContentAdmin(user);
  const existing = await prisma.user_guide_steps.findFirst({
    where: { id: stepId, guide_id: guideId },
  });
  if (!existing) throw new ApiError(404, 'خطوة الجولة غير موجودة');
  await prisma.user_guide_steps.delete({ where: { id: stepId } });
  await prisma.user_guides.update({
    where: { id: guideId },
    data: { updated_by_id: user.userId, updated_at: nowUtc() },
  });
  return { ok: true };
}

async function adminReorderGuideSteps(user, guideId, items) {
  assertContentAdmin(user);
  const guide = await prisma.user_guides.findUnique({ where: { id: guideId } });
  if (!guide) throw new ApiError(404, 'الجولة غير موجودة');
  await prisma.$transaction(
    items.map((item) =>
      prisma.user_guide_steps.updateMany({
        where: { id: item.id, guide_id: guideId },
        data: { sort_order: item.sort_order, updated_at: nowUtc() },
      })
    )
  );
  await prisma.user_guides.update({
    where: { id: guideId },
    data: { updated_by_id: user.userId, updated_at: nowUtc() },
  });
  return { ok: true };
}

/** Alias used by admin routes: reorder steps for a guide. */
async function adminReorderSteps(user, guideId, items) {
  return adminReorderGuideSteps(user, guideId, items);
}

async function adminPreviewGuide(user, id) {
  assertContentAdmin(user);
  const row = await prisma.user_guides.findUnique({
    where: { id },
    include: {
      user_guide_steps: { orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] },
    },
  });
  if (!row) throw new ApiError(404, 'الجولة غير موجودة');
  return {
    preview: true,
    guide: mapGuide(row, { includeSteps: true }),
  };
}

const getActiveOnboardingForKey = getActiveOnboarding;
const adminListVersions = adminListArticleVersions;
const adminRestoreVersion = adminRestoreArticleVersion;

module.exports = {
  FIELD_TRAINING_STUDENT_GUIDE_KEY,
  FIELD_TRAINING_STUDENT_GUIDE_VERSION,
  FIELD_TRAINING_INSTRUCTOR_GUIDE_KEY,
  FIELD_TRAINING_INSTRUCTOR_GUIDE_VERSION,
  FIELD_TRAINING_REVIEWER_GUIDE_KEY,
  FIELD_TRAINING_REVIEWER_GUIDE_VERSION,
  TOUR_STEP_COUNT,
  getActiveOnboarding,
  getActiveOnboardingForKey,
  getStudentOnboardingState,
  startOnboarding,
  updateOnboardingProgress,
  completeOnboarding,
  dismissOnboarding,
  restartOnboarding,
  listPublishedCategories,
  listPublishedArticles,
  getPublishedArticleBySlug,
  recordArticleView,
  searchHelp,
  getContextualHelp,
  createSupportTicket,
  listMySupportTickets,
  getMySupportTicket,
  adminListCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminArchiveCategory,
  adminDeleteCategory,
  adminListArticles,
  adminCreateArticle,
  adminUpdateArticle,
  adminPublishArticle,
  adminArchiveArticle,
  adminDeleteArticle,
  adminListArticleVersions,
  adminListVersions,
  adminRestoreArticleVersion,
  adminRestoreVersion,
  adminReorderArticles,
  adminHelpAnalytics,
  adminListGuides,
  adminGetGuide,
  adminCreateGuide,
  adminUpdateGuide,
  adminPublishGuide,
  adminArchiveGuide,
  adminPreviewGuide,
  adminCreateGuideStep,
  adminUpdateGuideStep,
  adminDeleteGuideStep,
  adminReorderGuideSteps,
  adminReorderSteps,
  studentHasActiveFieldTraining,
  stripHtml,
  scoreArticle,
  primaryRole,
  normalizeRoles,
};
