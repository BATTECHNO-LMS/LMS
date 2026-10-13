const { z } = require('zod');
const { paginationQueryShape, normalizePagination } = require('../../utils/pagination');
const { AUDIT_CATEGORIES, AUDIT_OUTCOMES } = require('../../shared/audit/auditActions');

const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

const studentIdParamSchema = z.object({
  studentId: z.string().uuid('Invalid id'),
});

const userIdParamSchema = z.object({
  userId: z.string().uuid('Invalid id'),
});

function parseDate(value, { endOfDay = false } = {}) {
  if (!value) return undefined;
  const raw = String(value).trim();
  const d = new Date(endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59.999Z` : raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const ACTION_CODE_RE = /^[A-Za-z0-9_.:-]{1,120}$/;

const listAuditLogsQuerySchema = z
  .object({
    user_id: z.string().uuid().optional(),
    subject_user_id: z.string().uuid().optional(),
    involving_user_id: z.string().uuid().optional(),
    university_id: z.string().uuid().optional(),
    organization_id: z.string().uuid().optional(),
    actor_role: z.string().max(40).optional(),
    action_type: z.string().max(1200).optional(),
    category: z.enum(Object.keys(AUDIT_CATEGORIES)).optional(),
    outcome: z.enum(Object.keys(AUDIT_OUTCOMES)).optional(),
    entity_type: z.string().max(120).optional(),
    entity_id: z.string().uuid().optional(),
    session_id: z.string().uuid().optional(),
    from: z.string().max(40).optional(),
    to: z.string().max(40).optional(),
    search: z.string().max(255).optional(),
    ...paginationQueryShape,
  })
  .strict()
  .transform((q) => {
    const p = normalizePagination(q);
    const actionTypes = (q.action_type || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => ACTION_CODE_RE.test(s))
      .slice(0, 20);
    return {
      user_id: q.user_id,
      subject_user_id: q.subject_user_id,
      involving_user_id: q.involving_user_id,
      university_id: q.university_id,
      organization_id: q.organization_id,
      actor_role: q.actor_role?.trim().toLowerCase() || undefined,
      action_types: actionTypes,
      category: q.category,
      outcome: q.outcome,
      entity_type: q.entity_type?.trim() || undefined,
      entity_id: q.entity_id,
      session_id: q.session_id,
      from: parseDate(q.from),
      to: parseDate(q.to, { endOfDay: true }),
      search: q.search?.trim() || undefined,
      page: p.page,
      page_size: p.page_size,
      skip: p.skip,
      take: p.take,
    };
  });

const studentTimelineQuerySchema = z
  .object({
    from: z.string().max(40).optional(),
    to: z.string().max(40).optional(),
    opportunity_id: z.string().uuid().optional(),
    course_id: z.string().uuid().optional(),
    include_security: z.enum(['true', 'false']).optional(),
    ...paginationQueryShape,
  })
  .strict()
  .transform((q) => {
    const p = normalizePagination(q);
    return {
      from: parseDate(q.from),
      to: parseDate(q.to, { endOfDay: true }),
      opportunity_id: q.opportunity_id,
      course_id: q.course_id,
      include_security: q.include_security === 'true',
      page: p.page,
      page_size: p.page_size,
      skip: p.skip,
      take: p.take,
    };
  });

module.exports = {
  uuidParamSchema,
  studentIdParamSchema,
  userIdParamSchema,
  listAuditLogsQuerySchema,
  studentTimelineQuerySchema,
};
