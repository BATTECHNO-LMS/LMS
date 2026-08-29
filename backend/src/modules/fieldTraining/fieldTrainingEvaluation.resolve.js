'use strict';

/**
 * Pure template resolution (no DB).
 * 1. Opportunity-specific override
 * 2. University default (Mutah default for Mutah opportunities)
 * 3. Existing global fallback
 */
function resolveEvaluationTemplate({
  opportunity = {},
  assignedTemplate = null,
  universityDefault = null,
  globalFallback = null,
} = {}) {
  if (opportunity.evaluation_template_id) {
    const assigned = assignedTemplate && !assignedTemplate.archived_at ? assignedTemplate : null;
    if (assigned && String(assigned.id) === String(opportunity.evaluation_template_id)) {
      return { template: assigned, source: 'opportunity' };
    }
  }

  if (universityDefault && !universityDefault.archived_at && universityDefault.is_active !== false) {
    return { template: universityDefault, source: 'university_default' };
  }

  if (globalFallback && !globalFallback.archived_at) {
    return { template: globalFallback, source: 'global_fallback' };
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
