/**
 * Resolve which validation payload the evaluation-template tab should show.
 * Upload/error responses use `{ valid, groups, found }`.
 * GET opportunity template maps `validation_json` → `resolvedTemplate.validation`.
 */
export function selectTemplateValidation({ lastValidation = null, resolvedTemplate = null } = {}) {
  if (lastValidation && typeof lastValidation === 'object') return lastValidation;
  const fromTemplate = resolvedTemplate?.validation;
  if (fromTemplate && typeof fromTemplate === 'object') return fromTemplate;
  return null;
}

export function templateValidationGroups(validation) {
  return Array.isArray(validation?.groups) ? validation.groups : [];
}
