const { z } = require('zod');

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
/** Admin bulk lists / selectors (e.g. users dropdown, full users table). */
const ADMIN_MAX_PAGE_SIZE = 500;

const paginationQueryShape = {
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
};

/**
 * Merge pagination fields into an existing list query object schema (before .strict()).
 */
function normalizePagination(q) {
  const page = q.page ?? 1;
  const page_size = Math.min(MAX_PAGE_SIZE, Math.max(1, q.page_size ?? DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * page_size;
  return {
    page,
    page_size,
    skip,
    take: page_size,
  };
}

function buildListMeta(total, page, page_size) {
  const size = Math.max(1, Number(page_size) || 1);
  return {
    page,
    page_size,
    total,
    total_pages: Math.max(1, Math.ceil(total / size)),
  };
}

module.exports = {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  ADMIN_MAX_PAGE_SIZE,
  paginationQueryShape,
  normalizePagination,
  buildListMeta,
};
