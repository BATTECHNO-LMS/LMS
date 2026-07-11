const aiService = require('../ai/ai.service');

function isAiConfigured() {
  return aiService.isAiConfigured();
}

const EVAL_SYSTEM_APPENDIX = `
أنت مقيّم تدريب ميداني محترف. حلّل فقط المحتوى المتاح فعليًا أدناه.
لا تخترع تفاصيل عن ملفات أو روابط لم تُقرأ بنجاح.
إذا تعذّر قراءة مصدر، اذكر ذلك صراحة ضمن قسم التحذيرات.
أرجع تقييمًا منظمًا بالعربية يتضمن:
1) ملخص العمل المقدم
2) مدى الالتزام بمتطلبات المهمة
3) نقاط القوة
4) المتطلبات الناقصة
5) ملاحظات تقنية
6) توصيات للتحسين
7) درجة مقترحة من 100 إن أمكن مع تبرير مختصر
8) مستوى الثقة / تحذيرات عند نقص المحتوى
`.trim();

/**
 * Build structured user payload for the model.
 */
function buildSelfEvalUserPayload({
  taskTitle,
  taskDescription,
  taskRequirements,
  evaluationPrompt,
  studentDescription,
  fileContent,
  fileStatus,
  urlContent,
  urlStatus,
  projectUrl,
  fileName,
}) {
  const sections = [
    '## معلومات المهمة',
    `العنوان: ${taskTitle || '—'}`,
    `الوصف: ${taskDescription || '—'}`,
    `المتطلبات: ${taskRequirements || '—'}`,
    '',
    '## معايير التقييم (برومبت المدرّب/الإدارة)',
    evaluationPrompt || '—',
    '',
    '## وصف الطالب لما أنجزه',
    studentDescription || '—',
    '',
    '## محتوى الملف المستخرج',
    `حالة الاستخراج: ${fileStatus || 'skipped'}`,
    fileName ? `اسم الملف: ${fileName}` : null,
    fileContent || '(لا يوجد محتوى نصي مستخرج من الملف)',
    '',
    '## محتوى الرابط المستخرج',
    `حالة الاستخراج: ${urlStatus || 'skipped'}`,
    projectUrl ? `الرابط: ${projectUrl}` : null,
    urlContent || '(لا يوجد محتوى نصي مستخرج من الرابط)',
    '',
    '## تعليمات إضافية',
    '- حلّل المصادر المتاحة مجتمعة.',
    '- لا تعتمد على اسم الملف أو الرابط وحدهما.',
    '- إذا كان مصدر غير مقروء، لا تفترض محتواه.',
  ].filter((line) => line != null);

  return sections.join('\n');
}

/**
 * @param {{
 *   systemPrompt: string,
 *   taskTitle?: string,
 *   taskDescription?: string | null,
 *   taskRequirements?: string | null,
 *   studentDescription: string,
 *   fileContent?: string | null,
 *   fileStatus?: string | null,
 *   fileName?: string | null,
 *   urlContent?: string | null,
 *   urlStatus?: string | null,
 *   projectUrl?: string | null,
 * }} params
 */
async function runSelfEvaluationAi(params) {
  const systemPrompt = `${params.systemPrompt}\n\n${EVAL_SYSTEM_APPENDIX}`.trim();
  const userInput = buildSelfEvalUserPayload({
    taskTitle: params.taskTitle,
    taskDescription: params.taskDescription,
    taskRequirements: params.taskRequirements,
    evaluationPrompt: params.systemPrompt,
    studentDescription: params.studentDescription,
    fileContent: params.fileContent,
    fileStatus: params.fileStatus,
    fileName: params.fileName,
    urlContent: params.urlContent,
    urlStatus: params.urlStatus,
    projectUrl: params.projectUrl,
  });

  const result = await aiService.generateText({
    systemPrompt,
    userInput,
    maxInputLen: 100000,
  });

  return {
    text: result.text,
    provider: result.provider,
    model: result.model,
    raw: result.raw,
    promptUsed: systemPrompt,
    userPayloadPreview: userInput.slice(0, 2000),
  };
}

module.exports = {
  isAiConfigured,
  runSelfEvaluationAi,
  buildSelfEvalUserPayload,
  EVAL_SYSTEM_APPENDIX,
};
