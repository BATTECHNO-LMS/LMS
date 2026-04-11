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

module.exports = { validateBody };
