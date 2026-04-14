function formatZodError(parsed) {
  const firstIssue = parsed.error.issues[0];
  return firstIssue?.message || 'Validation failed';
}

/**
 * Express middleware factory: validate `req.body` with a Zod schema.
 * On success, sets `req.validated` to the parsed/transformed value.
 * @param {import('zod').ZodTypeAny} schema
 */
function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const formErrors = parsed.error.flatten().formErrors;
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        success: false,
        message: firstIssue?.message || 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: {
          fields: fieldErrors,
          form: formErrors,
        },
      });
    }
    req.validated = parsed.data;
    return next();
  };
}

/**
 * Validate any combination of `body`, `query`, and `params`.
 * Sets `req.validated` to `{ body?, query?, params? }` depending on which parts were configured.
 * @param {{ body?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny }} parts
 */
function validateRequest(parts) {
  return (req, res, next) => {
    const out = {};

    if (parts.params) {
      const parsed = parts.params.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: formatZodError(parsed),
          code: 'VALIDATION_ERROR',
        });
      }
      out.params = parsed.data;
    }
    if (parts.query) {
      const parsed = parts.query.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: formatZodError(parsed),
          code: 'VALIDATION_ERROR',
        });
      }
      out.query = parsed.data;
    }
    if (parts.body) {
      const parsed = parts.body.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: formatZodError(parsed),
          code: 'VALIDATION_ERROR',
        });
      }
      out.body = parsed.data;
    }

    req.validated = out;
    return next();
  };
}

module.exports = { validateBody, validateRequest };
