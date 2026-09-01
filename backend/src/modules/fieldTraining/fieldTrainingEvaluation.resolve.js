'use strict';

/**
 * Pure template resolution (no DB).
 * 1. Opportunity-specific override
 * 2. University default
 *
 * Evaluation reports fail closed when neither exists. A template from another
 * university must never be used as a visual fallback.
 */
function resolveEvaluationTemplate({
  opportunity = {},
  assignedTemplate = null,
  universityDefault = null,
} = {}) {
  if (opportunity.evaluation_template_id) {
    const assigned = assignedTemplate && !assignedTemplate.archived_at ? assignedTemplate : null;
    const sameUniversity =
      !opportunity.university_id ||
      !assigned?.university_id ||
      String(assigned.university_id) === String(opportunity.university_id);
    if (
      assigned &&
      sameUniversity &&
      String(assigned.id) === String(opportunity.evaluation_template_id)
    ) {
      return { template: assigned, source: 'opportunity' };
    }
    return { template: null, source: 'assigned_template_unavailable' };
  }

  if (
    universityDefault &&
    !universityDefault.archived_at &&
    universityDefault.is_active !== false &&
    (!opportunity.university_id ||
      String(universityDefault.university_id) === String(opportunity.university_id))
  ) {
    return { template: universityDefault, source: 'university_default' };
  }

  return { template: null, source: 'missing' };
}

function templateBelongsToUniversity(template, universityId) {
  if (!template || !universityId) return false;
  return String(template.university_id) === String(universityId);
}

module.exports = {
  resolveEvaluationTemplate,
  templateBelongsToUniversity,
};
