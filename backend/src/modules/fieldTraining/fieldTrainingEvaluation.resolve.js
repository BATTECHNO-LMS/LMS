'use strict';

const {
  MUTAH_REQUIRED_TEMPLATE_VERSION,
  MUTAH_OFFICIAL_TEMPLATE_V11_NOT_AVAILABLE,
} = require('./fieldTrainingEvaluation.constants');
const { isMutahUniversity } = require('../../../scripts/lib/mutahOfficialEvaluationTemplate');

/**
 * Pure template resolution (no DB).
 * 1. Opportunity-specific override (honored even when the assigned file
 *    belongs to another university — used to share one official form)
 * 2. University default (never borrowed from another university)
 *
 * Evaluation reports fail closed when neither exists. A university default
 * from another university must never be used as a visual fallback.
 */
function resolveEvaluationTemplate({
  opportunity = {},
  assignedTemplate = null,
  universityDefault = null,
} = {}) {
  if (opportunity.evaluation_template_id) {
    const assigned = assignedTemplate && !assignedTemplate.archived_at ? assignedTemplate : null;
    if (assigned && String(assigned.id) === String(opportunity.evaluation_template_id)) {
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

function isOfficialMutahTemplateV11(template) {
  if (!template || template.archived_at) return false;
  if (template.is_active === false) return false;
  return Number(template.version) === Number(MUTAH_REQUIRED_TEMPLATE_VERSION);
}

function assertMutahOfficialTemplateV11({ isMutah = false, template = null } = {}) {
  if (!isMutah) return { ok: true, template, code: null };
  if (isOfficialMutahTemplateV11(template)) {
    return { ok: true, template, code: null };
  }
  return {
    ok: false,
    template: null,
    code: MUTAH_OFFICIAL_TEMPLATE_V11_NOT_AVAILABLE,
  };
}

function templateBelongsToUniversity(template, universityId) {
  if (!template || !universityId) return false;
  return String(template.university_id) === String(universityId);
}

module.exports = {
  resolveEvaluationTemplate,
  templateBelongsToUniversity,
  isMutahUniversity,
  isOfficialMutahTemplateV11,
  assertMutahOfficialTemplateV11,
  MUTAH_OFFICIAL_TEMPLATE_V11_NOT_AVAILABLE,
  MUTAH_REQUIRED_TEMPLATE_VERSION,
};
