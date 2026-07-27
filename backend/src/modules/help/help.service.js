'use strict';

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const { recordAudit } = require('../../utils/auditRecorder');
const { isSystemWideAdmin } = require('../../utils/universityScope');
const {
  FIELD_TRAINING_STUDENT_GUIDE_KEY,
  FIELD_TRAINING_STUDENT_GUIDE_VERSION,
  TOUR_STEP_COUNT,
} = require('./help.constants');

function normalizeRoles(user) {
  const { normalizeRoleCodes } = require('../../utils/roleCanon');
  return normalizeRoleCodes(user?.roles || []);
}

function primaryRole(user) {
  const roles = normalizeRoles(user);
  if (roles.includes('student')) return 'student';
  if (roles.includes('super_admin')) return 'super_admin';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('instructor')) return 'instructor';
  if (roles.includes('reviewer')) return 'reviewer';
  return roles[0] || null;
}

function assertSuperAdmin(user) {
  if (!isSystemWideAdmin(user) && !normalizeRoles(user).includes('super_admin')) {
    throw new ApiError(403, 'غير مصرح', null, 'HELP_ADMIN_FORBIDDEN');
  }
}

function stripHtml(input) {
  return String(input || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
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
    target_roles: row.target_roles || [],
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
    target_roles: row.target_roles || [],
    related_route: row.related_route,
    contextual_key: row.contextual_key,
    guide_version: row.guide_version,
    is_faq: row.is_faq,
    view_count: row.view_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  if (includeContent) {
    base.content_ar = row.content_ar;
    base.content_en = row.content_en;
  }
  return base;
}

function mapOnboarding(row, { shouldShow = false, updateAvailable = false } = {}) {
  return {
    guide_key: FIELD_TRAINING_STUDENT_GUIDE_KEY,
    guide_version: FIELD_TRAINING_STUDENT_GUIDE_VERSION,
    step_count: TOUR_STEP_COUNT,
    should_show: shouldShow,
    update_available: updateAvailable,
    status: row?.status || 'not_started',
    last_step: row?.last_step ?? 0,
    started_at: row?.started_at ?? null,
    completed_at: row?.completed_at ?? null,
    dismissed_at: row?.dismissed_at ?? null,
  };
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

async function getStudentOnboardingState(user) {
  const role = primaryRole(user);
  if (role !== 'student') {
    return mapOnboarding(null, { shouldShow: false });
  }

  const account = await prisma.users.findUnique({
    where: { id: user.userId },
    select: { status: true, email_verified_at: true },
  });
  if (!account || account.status !== 'active' || !account.email_verified_at) {
    return mapOnboarding(null, { shouldShow: false });
  }

  const eligible = await studentHasActiveFieldTraining(user.userId);
  const current = await prisma.user_onboarding_progress.findUnique({
    where: {
      user_id_guide_key_guide_version: {
        user_id: user.userId,
        guide_key: FIELD_TRAINING_STUDENT_GUIDE_KEY,
        guide_version: FIELD_TRAINING_STUDENT_GUIDE_VERSION,
      },
    },
  });

  const olderCompleted = await prisma.user_onboarding_progress.findFirst({
    where: {
      user_id: user.userId,
      guide_key: FIELD_TRAINING_STUDENT_GUIDE_KEY,
      guide_version: { not: FIELD_TRAINING_STUDENT_GUIDE_VERSION },
      status: 'completed',
    },
    orderBy: { completed_at: 'desc' },
  });

  const updateAvailable = Boolean(olderCompleted) && (!current || current.status !== 'completed');
  const completedCurrent = current?.status === 'completed';
  const shouldShow = eligible && !completedCurrent;

  return mapOnboarding(current, { shouldShow, updateAvailable });
}

async function upsertOnboarding(userId, data) {
  return prisma.user_onboarding_progress.upsert({
    where: {
      user_id_guide_key_guide_version: {
        user_id: userId,
        guide_key: FIELD_TRAINING_STUDENT_GUIDE_KEY,
        guide_version: FIELD_TRAINING_STUDENT_GUIDE_VERSION,
      },
    },
    create: {
      user_id: userId,
      guide_key: FIELD_TRAINING_STUDENT_GUIDE_KEY,
      guide_version: FIELD_TRAINING_STUDENT_GUIDE_VERSION,
      ...data,
    },
    update: {
      ...data,
      updated_at: new Date(),
    },
  });
}

async function startOnboarding(user) {
  if (primaryRole(user) !== 'student') {
    throw new ApiError(403, 'الجولة متاحة للطلاب فقط', null, 'ONBOARDING_STUDENT_ONLY');
  }
  const now = new Date();
  const row = await upsertOnboarding(user.userId, {
    status: 'in_progress',
    started_at: now,
    last_step: 0,
    dismissed_at: null,
    completed_at: null,
  });
  return mapOnboarding(row, { shouldShow: true });
}

async function updateOnboardingProgress(user, body) {
  if (primaryRole(user) !== 'student') {
    throw new ApiError(403, 'الجولة متاحة للطلاب فقط', null, 'ONBOARDING_STUDENT_ONLY');
  }
  const step = Number(body.last_step ?? body.step ?? 0);
  const existing = await prisma.user_onboarding_progress.findUnique({
    where: {
      user_id_guide_key_guide_version: {
        user_id: user.userId,
        guide_key: FIELD_TRAINING_STUDENT_GUIDE_KEY,
        guide_version: FIELD_TRAINING_STUDENT_GUIDE_VERSION,
      },
    },
  });
  const row = await upsertOnboarding(user.userId, {
    status: existing?.status === 'completed' ? 'completed' : 'in_progress',
    last_step: step,
    started_at: existing?.started_at || new Date(),
  });
  return mapOnboarding(row, { shouldShow: row.status !== 'completed' });
}

async function completeOnboarding(user) {
  if (primaryRole(user) !== 'student') {
    throw new ApiError(403, 'الجولة متاحة للطلاب فقط', null, 'ONBOARDING_STUDENT_ONLY');
  }
  const now = new Date();
  const row = await upsertOnboarding(user.userId, {
    status: 'completed',
    completed_at: now,
    last_step: TOUR_STEP_COUNT,
    started_at: now,
    dismissed_at: null,
  });
  return mapOnboarding(row, { shouldShow: false });
}

async function dismissOnboarding(user) {
  if (primaryRole(user) !== 'student') {
    throw new ApiError(403, 'الجولة متاحة للطلاب فقط', null, 'ONBOARDING_STUDENT_ONLY');
  }
  const now = new Date();
  const existing = await prisma.user_onboarding_progress.findUnique({
    where: {
      user_id_guide_key_guide_version: {
        user_id: user.userId,
        guide_key: FIELD_TRAINING_STUDENT_GUIDE_KEY,
        guide_version: FIELD_TRAINING_STUDENT_GUIDE_VERSION,
      },
    },
  });
  if (existing?.status === 'completed') {
    return mapOnboarding(existing, { shouldShow: false });
  }
  const row = await upsertOnboarding(user.userId, {
    status: 'dismissed',
    dismissed_at: now,
    started_at: existing?.started_at || now,
    last_step: existing?.last_step ?? 0,
  });
  return mapOnboarding(row, { shouldShow: false });
}

async function restartOnboarding(user) {
  if (primaryRole(user) !== 'student') {
    throw new ApiError(403, 'الجولة متاحة للطلاب فقط', null, 'ONBOARDING_STUDENT_ONLY');
  }
  const now = new Date();
  const row = await upsertOnboarding(user.userId, {
    status: 'in_progress',
    started_at: now,
    completed_at: null,
    dismissed_at: null,
    last_step: 0,
  });
  return mapOnboarding(row, { shouldShow: true });
}

async function listPublishedCategories(user) {
  const role = primaryRole(user) || 'student';
  const rows = await prisma.help_categories.findMany({
    where: {
      is_active: true,
      target_roles: { has: role },
    },
    orderBy: [{ sort_order: 'asc' }, { title_ar: 'asc' }],
    include: {
      _count: {
        select: {
          help_articles: {
            where: { is_published: true, target_roles: { has: role } },
          },
        },
      },
    },
  });
  return { categories: rows.map((r) => mapCategory(r)) };
}

async function listPublishedArticles(user, { categorySlug = null, faqOnly = false } = {}) {
  const role = primaryRole(user) || 'student';
  const where = {
    is_published: true,
    target_roles: { has: role },
  };
  if (faqOnly) where.is_faq = true;
  if (categorySlug) {
    where.help_categories = { slug: categorySlug, is_active: true };
  }
  const rows = await prisma.help_articles.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { title_ar: 'asc' }],
    include: { help_categories: { select: { slug: true, title_ar: true } } },
  });
  return { articles: rows.map((r) => mapArticle(r, { includeContent: false })) };
}

async function getPublishedArticleBySlug(user, slug) {
  const role = primaryRole(user) || 'student';
  const row = await prisma.help_articles.findFirst({
    where: {
      slug,
      is_published: true,
      target_roles: { has: role },
      help_categories: { is_active: true },
    },
    include: { help_categories: { select: { slug: true, title_ar: true, id: true } } },
  });
  if (!row) throw new ApiError(404, 'المقال غير موجود');
  return { article: mapArticle(row) };
}

async function recordArticleView(user, articleId) {
  const role = primaryRole(user) || 'student';
  const article = await prisma.help_articles.findFirst({
    where: { id: articleId, is_published: true, target_roles: { has: role } },
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
  const role = primaryRole(user) || 'student';
  const q = String(query || '').trim();
  const tokens = q
    .toLowerCase()
    .split(/[\s,،]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  const articles = await prisma.help_articles.findMany({
    where: {
      is_published: true,
      target_roles: { has: role },
      help_categories: { is_active: true },
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
  const where = {
    is_published: true,
    target_roles: { has: role },
  };
  if (key) where.contextual_key = key;
  else if (route) where.related_route = { contains: String(route).split('?')[0] };

  const rows = await prisma.help_articles.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { title_ar: 'asc' }],
    take: 8,
    include: { help_categories: { select: { slug: true, title_ar: true } } },
  });
  return {
    articles: rows.map((r) => mapArticle(r, { includeContent: false })),
    guide_path: '/student/user-guide',
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

/* -------- Admin -------- */

async function adminListCategories(user) {
  assertSuperAdmin(user);
  const rows = await prisma.help_categories.findMany({
    orderBy: [{ sort_order: 'asc' }, { title_ar: 'asc' }],
    include: { _count: { select: { help_articles: true } } },
  });
  return { categories: rows.map((r) => mapCategory(r)) };
}

async function adminCreateCategory(user, body) {
  assertSuperAdmin(user);
  const row = await prisma.help_categories.create({
    data: {
      title_ar: body.title_ar,
      title_en: body.title_en || null,
      slug: body.slug,
      description_ar: body.description_ar || null,
      description_en: body.description_en || null,
      icon: body.icon || null,
      sort_order: body.sort_order ?? 0,
      is_active: body.is_active ?? true,
      target_roles: body.target_roles || ['student'],
    },
  });
  await recordAudit({
    userId: user.userId,
    actionType: 'HELP_CATEGORY_CREATED',
    entityType: 'help_categories',
    entityId: row.id,
    newValues: { slug: row.slug, title_ar: row.title_ar },
  });
  return { category: mapCategory(row) };
}

async function adminUpdateCategory(user, id, body) {
  assertSuperAdmin(user);
  const existing = await prisma.help_categories.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'القسم غير موجود');
  const row = await prisma.help_categories.update({
    where: { id },
    data: {
      ...(body.title_ar != null ? { title_ar: body.title_ar } : {}),
      ...(body.title_en !== undefined ? { title_en: body.title_en } : {}),
      ...(body.slug != null ? { slug: body.slug } : {}),
      ...(body.description_ar !== undefined ? { description_ar: body.description_ar } : {}),
      ...(body.description_en !== undefined ? { description_en: body.description_en } : {}),
      ...(body.icon !== undefined ? { icon: body.icon } : {}),
      ...(body.sort_order != null ? { sort_order: body.sort_order } : {}),
      ...(body.is_active != null ? { is_active: body.is_active } : {}),
      ...(body.target_roles ? { target_roles: body.target_roles } : {}),
      updated_at: new Date(),
    },
  });
  await recordAudit({
    userId: user.userId,
    actionType: 'HELP_CATEGORY_UPDATED',
    entityType: 'help_categories',
    entityId: id,
    oldValues: { slug: existing.slug, is_active: existing.is_active },
    newValues: { slug: row.slug, is_active: row.is_active },
  });
  return { category: mapCategory(row) };
}

async function adminDeleteCategory(user, id) {
  assertSuperAdmin(user);
  const existing = await prisma.help_categories.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'القسم غير موجود');
  await prisma.help_categories.delete({ where: { id } });
  await recordAudit({
    userId: user.userId,
    actionType: 'HELP_CATEGORY_DELETED',
    entityType: 'help_categories',
    entityId: id,
    oldValues: { slug: existing.slug, title_ar: existing.title_ar },
  });
  return { ok: true };
}

async function adminListArticles(user, { categoryId } = {}) {
  assertSuperAdmin(user);
  const where = categoryId ? { category_id: categoryId } : {};
  const rows = await prisma.help_articles.findMany({
    where,
    orderBy: [{ sort_order: 'asc' }, { title_ar: 'asc' }],
    include: { help_categories: { select: { slug: true, title_ar: true } } },
  });
  return { articles: rows.map((r) => mapArticle(r)) };
}

async function adminCreateArticle(user, body) {
  assertSuperAdmin(user);
  const row = await prisma.help_articles.create({
    data: {
      category_id: body.category_id,
      title_ar: body.title_ar,
      title_en: body.title_en || null,
      slug: body.slug,
      summary_ar: body.summary_ar || null,
      summary_en: body.summary_en || null,
      content_ar: stripHtml(body.content_ar),
      content_en: body.content_en ? stripHtml(body.content_en) : null,
      keywords: body.keywords || [],
      sort_order: body.sort_order ?? 0,
      is_published: body.is_published ?? true,
      target_roles: body.target_roles || ['student'],
      related_route: body.related_route || null,
      contextual_key: body.contextual_key || null,
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
    newValues: { slug: row.slug, title_ar: row.title_ar },
  });
  return { article: mapArticle(row) };
}

async function adminUpdateArticle(user, id, body) {
  assertSuperAdmin(user);
  const existing = await prisma.help_articles.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'المقال غير موجود');
  const data = {
    updated_by_id: user.userId,
    updated_at: new Date(),
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
    'is_published',
    'target_roles',
    'related_route',
    'contextual_key',
    'guide_version',
    'is_faq',
  ]) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  if (body.content_ar !== undefined) data.content_ar = stripHtml(body.content_ar);
  if (body.content_en !== undefined) {
    data.content_en = body.content_en ? stripHtml(body.content_en) : null;
  }
  const row = await prisma.help_articles.update({
    where: { id },
    data,
    include: { help_categories: { select: { slug: true, title_ar: true } } },
  });
  await recordAudit({
    userId: user.userId,
    actionType: body.is_published === false ? 'HELP_ARTICLE_UNPUBLISHED' : 'HELP_ARTICLE_UPDATED',
    entityType: 'help_articles',
    entityId: id,
    oldValues: { slug: existing.slug, is_published: existing.is_published },
    newValues: { slug: row.slug, is_published: row.is_published },
  });
  return { article: mapArticle(row) };
}

async function adminPublishArticle(user, id, publish = true) {
  assertSuperAdmin(user);
  const existing = await prisma.help_articles.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'المقال غير موجود');
  const row = await prisma.help_articles.update({
    where: { id },
    data: { is_published: publish, updated_by_id: user.userId, updated_at: new Date() },
    include: { help_categories: { select: { slug: true, title_ar: true } } },
  });
  await recordAudit({
    userId: user.userId,
    actionType: publish ? 'HELP_ARTICLE_PUBLISHED' : 'HELP_ARTICLE_UNPUBLISHED',
    entityType: 'help_articles',
    entityId: id,
    oldValues: { is_published: existing.is_published },
    newValues: { is_published: row.is_published },
  });
  return { article: mapArticle(row) };
}

async function adminDeleteArticle(user, id) {
  assertSuperAdmin(user);
  const existing = await prisma.help_articles.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'المقال غير موجود');
  await prisma.help_articles.delete({ where: { id } });
  await recordAudit({
    userId: user.userId,
    actionType: 'HELP_ARTICLE_DELETED',
    entityType: 'help_articles',
    entityId: id,
    oldValues: { slug: existing.slug },
  });
  return { ok: true };
}

async function adminReorderArticles(user, items) {
  assertSuperAdmin(user);
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
  assertSuperAdmin(user);
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
        where: { is_published: true },
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

module.exports = {
  FIELD_TRAINING_STUDENT_GUIDE_KEY,
  FIELD_TRAINING_STUDENT_GUIDE_VERSION,
  TOUR_STEP_COUNT,
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
  adminDeleteCategory,
  adminListArticles,
  adminCreateArticle,
  adminUpdateArticle,
  adminPublishArticle,
  adminDeleteArticle,
  adminReorderArticles,
  adminHelpAnalytics,
  studentHasActiveFieldTraining,
  stripHtml,
  scoreArticle,
};
