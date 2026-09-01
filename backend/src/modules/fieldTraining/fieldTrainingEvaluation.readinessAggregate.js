'use strict';

const { getOfficialDocumentRendererStatus } = require('./fieldTrainingEvaluation.renderer');
const {
  TEMPLATE_MISSING_CODE,
  READY_STATUS,
  GENERATED_STATUS,
} = require('./fieldTrainingEvaluation.constants');
const { eligibilityBucket } = require('./fieldTrainingEvaluation.eligibilityReasons');
const {
  rowEligibleForBulk,
  rowBulkRatingsToApply,
} = require('./fieldTrainingEvaluation.bulkRating');

const RENDERER_NOT_AVAILABLE = 'RENDERER_NOT_AVAILABLE';

function formatTemplateVersion(version) {
  if (version == null || version === '') return null;
  return String(version);
}

async function buildTemplateGenerationReadiness({
  template = null,
  templatePreflight = null,
  loadFileBuffer = null,
} = {}) {
  const diagnostics = {
    templateId: template?.id || null,
    version: template?.version ?? null,
    sourceFileId: template?.original_file_id || template?.originalFileId || null,
    fileExists: null,
    mime: null,
    size: null,
  };

  const uploadValid = template?.validation_status === 'valid' || template?.validationStatus === 'valid';
  const structureValid = Boolean(templatePreflight?.ok);
  const mappingValid = uploadValid && structureValid;
  const documentRenderer = getOfficialDocumentRendererStatus();
  const rendererReady = Boolean(documentRenderer.available);
  let fidelityValid = structureValid && rendererReady;
  let failureCode = null;

  if (!template) {
    failureCode = TEMPLATE_MISSING_CODE;
    fidelityValid = false;
  } else if (template.version == null) {
    failureCode = 'TEMPLATE_VERSION_MISSING';
    fidelityValid = false;
  }

  if (templatePreflight?.ok === false) {
    failureCode = templatePreflight.issues?.[0]?.code || 'DOCX_PARSE_FAILED';
    fidelityValid = false;
  } else if (templatePreflight?.ok && !rendererReady) {
    failureCode = RENDERER_NOT_AVAILABLE;
    fidelityValid = false;
  }

  if (diagnostics.sourceFileId && typeof loadFileBuffer === 'function') {
    try {
      const loaded = await loadFileBuffer(diagnostics.sourceFileId);
      const buffer = loaded?.buffer;
      const meta = loaded?.meta || loaded?.file || {};
      diagnostics.fileExists = Boolean(buffer?.length);
      diagnostics.mime =
        meta?.mime_type ||
        meta?.mimeType ||
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      diagnostics.size = buffer?.length || 0;
      if (!diagnostics.fileExists) {
        failureCode = failureCode || 'SOURCE_FILE_NOT_FOUND';
        fidelityValid = false;
      }
    } catch {
      diagnostics.fileExists = false;
      failureCode = failureCode || 'SOURCE_FILE_NOT_FOUND';
      fidelityValid = false;
    }
  } else if (template && !diagnostics.sourceFileId) {
    failureCode = failureCode || 'SOURCE_FILE_NOT_FOUND';
    fidelityValid = false;
  }

  const templateGenerationReady = Boolean(
    template &&
      uploadValid &&
      structureValid &&
      mappingValid &&
      rendererReady &&
      fidelityValid &&
      diagnostics.fileExists !== false &&
      template.version != null
  );

  return {
    uploadValid,
    structureValid,
    mappingValid,
    rendererReady,
    fidelityValid,
    templateGenerationReady,
    failureCode,
    version: formatTemplateVersion(template?.version),
    versionResolved: template?.version != null,
    diagnostics,
    documentRenderer: {
      available: documentRenderer.available,
      engine: documentRenderer.engine,
      version: documentRenderer.version,
      concurrencyLimit: documentRenderer.concurrencyLimit,
    },
  };
}

function buildPopulationSummary(apps = [], students = [], skippedAppIds = []) {
  let eligible = 0;
  let notEligible = 0;
  let eligibilityPending = 0;
  for (const app of apps) {
    const bucket = eligibilityBucket(app);
    if (bucket === 'ELIGIBLE') eligible += 1;
    else if (bucket === 'PENDING') eligibilityPending += 1;
    else notEligible += 1;
  }

  const excludedExpelled = apps.filter((app) => app.training_status === 'expelled').length;
  const contextLoadFailed = skippedAppIds.length;
  const totalApplicationsConsidered = apps.length;

  return {
    totalApplicationsConsidered,
    evaluatedPopulation: students.length,
    eligible,
    notEligible,
    eligibilityPending,
    excluded: {
      expelled: excludedExpelled,
      contextLoadFailed,
    },
    reconciliation: {
      sum: eligible + notEligible + eligibilityPending,
      matchesTotal: eligible + notEligible + eligibilityPending === totalApplicationsConsidered,
      activeNonExpelled: apps.filter((app) => app.training_status !== 'expelled').length,
    },
  };
}

function computeGenerationCounts(students = [], templateGenerationReady = false) {
  const dataReadyRows = students.filter(
    (row) => row.readiness === READY_STATUS || row.readinessCategory === GENERATED_STATUS
  );
  const finalReadyRows = templateGenerationReady ? dataReadyRows : [];
  const bulkEligible = students.filter(rowEligibleForBulk);
  const criteriaAffected = bulkEligible.reduce((sum, row) => sum + rowBulkRatingsToApply(row), 0);

  return {
    dataReady: dataReadyRows.length,
    finalReady: finalReadyRows.length,
    generated: students.filter((row) => row.generated).length,
    failed: students.filter((row) => row.generationFailed).length,
    professionalEvaluation: {
      complete: students.filter((row) => !rowEligibleForBulk(row)).length,
      needsAuthorizedRating: bulkEligible.length,
      missingCriteriaCount: criteriaAffected,
    },
    bulkPreview: {
      studentsAffected: bulkEligible.length,
      criteriaAffected,
    },
  };
}

module.exports = {
  RENDERER_NOT_AVAILABLE,
  formatTemplateVersion,
  buildTemplateGenerationReadiness,
  buildPopulationSummary,
  computeGenerationCounts,
};
