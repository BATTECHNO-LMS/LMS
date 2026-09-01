'use strict';

const { ApiError } = require('../../utils/apiError');
const { PDF_RENDER_FAILED_CODE, TEMPLATE_FONT_UNAVAILABLE } = require('./fieldTrainingEvaluation.constants');
const { verifyOfficialEvaluationPdf } = require('./fieldTrainingEvaluation.fidelity');
const {
  findSoffice,
  getOfficialDocumentRendererStatus,
  convertDocxBufferWithLibreOffice,
  CONVERSION_TIMEOUT_MS,
} = require('./fieldTrainingEvaluation.renderer');

function assertOfficialRendererAvailable() {
  const soffice = findSoffice();
  if (soffice) return soffice;
  throw new ApiError(
    503,
    'تعذر إنشاء التقرير من قالب الجامعة الرسمي. لم يتم إنشاء تقرير بديل.',
    { converter: 'libreoffice', reason: 'approved_docx_renderer_unavailable' },
    PDF_RENDER_FAILED_CODE
  );
}

async function convertFilledDocxToPdf(
  docxBuffer,
  { fontIssues = [], expectedPageCount = 2 } = {}
) {
  if (Array.isArray(fontIssues) && fontIssues.length) {
    const first = fontIssues[0];
    throw new ApiError(
      409,
      first.messageAr || `الخط غير متوفر: ${first.font}`,
      { font: first.font, issues: fontIssues },
      TEMPLATE_FONT_UNAVAILABLE
    );
  }
  const soffice = assertOfficialRendererAvailable();
  try {
    const pdfBuffer = await convertDocxBufferWithLibreOffice(docxBuffer, soffice);
    await verifyOfficialEvaluationPdf(pdfBuffer, { expectedPageCount });
    return pdfBuffer;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      500,
      'تعذر إنشاء التقرير من قالب الجامعة الرسمي. لم يتم إنشاء تقرير بديل.',
      { error: err?.message || 'pdf_failed' },
      PDF_RENDER_FAILED_CODE
    );
  }
}

module.exports = {
  convertFilledDocxToPdf,
  findSoffice,
  assertOfficialRendererAvailable,
  getOfficialDocumentRendererStatus,
  CONVERSION_TIMEOUT_MS,
};
