/**
 * Flatten Zod issues to { fieldPath: message } for Arabic form errors.
 */
export function zodToFieldErrors(error) {
  const out = {};
  if (!error?.issues) return out;
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_root';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function safeParse(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data, errors: {} };
  return { ok: false, data: null, errors: zodToFieldErrors(result.error) };
}
