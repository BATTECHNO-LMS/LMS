'use strict';

/**
 * Zarqa Private University Field Training PRE assessment (Full Stack baseline).
 * Score is independent of the final Field Training /100 model.
 */

const {
  prepareQuestionForStorage,
  validateAssessmentQuestions,
  gradeAnswers,
  normalizeCorrectAnswer,
} = require('./fieldTraining.assessmentQuestions');

const UNIVERSITY_CODE = 'zarqa-private-university';
const UNIVERSITY_NAME_AR = 'جامعة الزرقاء الخاصة';
const OPPORTUNITY_TITLE = 'التدريب الميداني الفصل الاول لطلبة جامعة الزرقاء 2026/2027';
const OPPORTUNITY_ID = 'cbe032b3-e7ef-475f-851e-faa7e61264b2';
const TEMPLATE_ID = 'FIELD_TRAINING_PRE_ASSESSMENT_ZARQA_FULLSTACK_2026_V1';
const ASSESSMENT_TITLE = 'الامتحان القبلي – أساسيات Full Stack';
const DESCRIPTION =
  'امتحان قبلي لقياس المعرفة الأساسية في تطوير الويب Full Stack قبل بدء التدريب الميداني. لا تُحتسب نتيجته ضمن العلامة النهائية /100.';
const QUESTION_COUNT = 20;
const QUESTION_POINTS = 5;
const TOTAL_SCORE = 100;
const PASSING_SCORE = 60;
const PASS_CORRECT_COUNT = 12;
/** Authoritative close: 13 Sep 2026 11:59 PM Asia/Amman. */
const CLOSES_AT = '2026-09-13T23:59:00+03:00';

const RAW_QUESTIONS = Object.freeze([
  {
    question_text: 'ما الوظيفة الأساسية لـ HTML في تطبيقات الويب؟',
    options: ['إدارة قاعدة البيانات', 'بناء هيكل ومحتوى صفحة الويب', 'تشغيل الخادم', 'تشفير الاتصال'],
    correct_answer: 'بناء هيكل ومحتوى صفحة الويب',
  },
  {
    question_text: 'ما الدور الأساسي لـ CSS؟',
    options: ['تنسيق وتصميم واجهة المستخدم', 'تخزين البيانات', 'إنشاء REST API', 'تشغيل JavaScript على الخادم'],
    correct_answer: 'تنسيق وتصميم واجهة المستخدم',
  },
  {
    question_text: 'أي لغة تستخدم بشكل أساسي لإضافة التفاعل والمنطق البرمجي في المتصفح؟',
    options: ['SQL', 'HTML', 'JavaScript', 'PostgreSQL'],
    correct_answer: 'JavaScript',
  },
  {
    question_text: 'ماذا يعني HTTP Status Code 404 غالبًا؟',
    options: ['نجح الطلب', 'المورد المطلوب غير موجود', 'المستخدم غير مصرح له', 'حدث خطأ في قاعدة البيانات'],
    correct_answer: 'المورد المطلوب غير موجود',
  },
  {
    question_text: 'أي HTTP Method يستخدم غالبًا لجلب البيانات دون تعديلها؟',
    options: ['GET', 'POST', 'DELETE', 'PATCH'],
    correct_answer: 'GET',
  },
  {
    question_text: 'أي HTTP Method يستخدم غالبًا لإنشاء Resource جديد؟',
    options: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    correct_answer: 'POST',
  },
  {
    question_text: 'ما المقصود بـ JSON؟',
    options: ['نظام لإدارة قواعد البيانات', 'صيغة خفيفة لتمثيل وتبادل البيانات', 'مكتبة لتصميم الواجهات', 'خادم ويب'],
    correct_answer: 'صيغة خفيفة لتمثيل وتبادل البيانات',
  },
  {
    question_text: 'ما الوظيفة الأساسية لـ React؟',
    options: [
      'إدارة PostgreSQL',
      'بناء واجهات المستخدم باستخدام Components',
      'تشغيل خادم Linux',
      'إنشاء جداول قاعدة البيانات',
    ],
    correct_answer: 'بناء واجهات المستخدم باستخدام Components',
  },
  {
    question_text: 'ما المقصود بـ Component في React؟',
    options: [
      'وحدة قابلة لإعادة الاستخدام من واجهة المستخدم',
      'جدول داخل قاعدة البيانات',
      'HTTP Request',
      'ملف إعدادات للخادم',
    ],
    correct_answer: 'وحدة قابلة لإعادة الاستخدام من واجهة المستخدم',
  },
  {
    question_text: 'أي React Hook يستخدم غالبًا لإدارة State محلية داخل Functional Component؟',
    options: ['useState', 'useRoute', 'useSQL', 'useServer'],
    correct_answer: 'useState',
  },
  {
    question_text: 'ما هو Node.js؟',
    options: [
      'قاعدة بيانات علائقية',
      'بيئة تشغيل JavaScript خارج المتصفح',
      'لغة لتنسيق صفحات الويب',
      'مكتبة خاصة بـ CSS',
    ],
    correct_answer: 'بيئة تشغيل JavaScript خارج المتصفح',
  },
  {
    question_text: 'ما الوظيفة الأساسية للـ Backend في تطبيق Full Stack؟',
    options: [
      'تغيير ألوان الصفحة فقط',
      'معالجة منطق التطبيق والبيانات والطلبات من العميل',
      'تصميم الشعارات',
      'تشغيل CSS',
    ],
    correct_answer: 'معالجة منطق التطبيق والبيانات والطلبات من العميل',
  },
  {
    question_text: 'ما المقصود بـ API؟',
    options: [
      'واجهة تسمح للأنظمة أو أجزاء التطبيق بالتواصل وتبادل البيانات',
      'نوع من قواعد البيانات',
      'لغة برمجة جديدة',
      'متصفح ويب',
    ],
    correct_answer: 'واجهة تسمح للأنظمة أو أجزاء التطبيق بالتواصل وتبادل البيانات',
  },
  {
    question_text: 'في REST API، ماذا يمثل Endpoint عادة؟',
    options: [
      'عنوانًا يمكن للعميل إرسال Request إليه لتنفيذ عملية على Resource',
      'كلمة المرور الخاصة بالمستخدم',
      'جدولًا داخل HTML',
      'ملف CSS',
    ],
    correct_answer: 'عنوانًا يمكن للعميل إرسال Request إليه لتنفيذ عملية على Resource',
  },
  {
    question_text: 'ما هي PostgreSQL؟',
    options: [
      'مكتبة JavaScript للواجهات',
      'نظام إدارة قواعد بيانات علائقية',
      'بروتوكول لنقل الصور',
      'Framework لتصميم CSS',
    ],
    correct_answer: 'نظام إدارة قواعد بيانات علائقية',
  },
  {
    question_text: 'أي أمر SQL يستخدم لاسترجاع بيانات من جدول؟',
    options: ['SELECT', 'DELETE', 'DROP', 'ALTER'],
    correct_answer: 'SELECT',
  },
  {
    question_text: 'ما الهدف الأساسي من Primary Key في جدول قاعدة البيانات؟',
    options: ['تحديد كل سجل بشكل فريد', 'تغيير تصميم الصفحة', 'تشفير قاعدة البيانات', 'تشغيل REST API'],
    correct_answer: 'تحديد كل سجل بشكل فريد',
  },
  {
    question_text: 'ما المقصود بـ Foreign Key؟',
    options: [
      'مفتاح يستخدم لربط سجل أو جدول بسجل في جدول آخر',
      'كلمة مرور قاعدة البيانات',
      'ملف خارجي لـ JavaScript',
      'عنوان API',
    ],
    correct_answer: 'مفتاح يستخدم لربط سجل أو جدول بسجل في جدول آخر',
  },
  {
    question_text: 'في تطبيق Full Stack، ما المسار الأكثر منطقية عند طلب بيانات من قاعدة البيانات؟',
    options: [
      'React -> Database مباشرة دائمًا',
      'Frontend -> Backend/API -> Database',
      'Database -> CSS -> React',
      'HTML -> PostgreSQL دون Backend',
    ],
    correct_answer: 'Frontend -> Backend/API -> Database',
  },
  {
    question_text: 'ما أفضل وصف لـ Full Stack Developer؟',
    options: [
      'مطور يعمل فقط على تصميم الصور',
      'مطور يستطيع العمل على Frontend وBackend والتعامل مع قاعدة البيانات',
      'مطور يعمل فقط على SQL',
      'مستخدم يدير الخادم دون برمجة',
    ],
    correct_answer: 'مطور يستطيع العمل على Frontend وBackend والتعامل مع قاعدة البيانات',
  },
]);

function toBankQuestion(row, index) {
  return {
    question_text: row.question_text,
    question_type: 'multiple_choice',
    options: [...row.options],
    correct_answer: row.correct_answer,
    points: QUESTION_POINTS,
    is_required: true,
    sort_order: index,
  };
}

function toStorageQuestions() {
  return RAW_QUESTIONS.map((row, index) => prepareQuestionForStorage(toBankQuestion(row, index), index));
}

function validateZarqaPreBank() {
  if (RAW_QUESTIONS.length !== QUESTION_COUNT) {
    return `يجب أن يحتوي الامتحان القبلي على ${QUESTION_COUNT} سؤالًا.`;
  }
  const prepared = RAW_QUESTIONS.map((row, index) => toBankQuestion(row, index));
  const validation = validateAssessmentQuestions(prepared);
  if (typeof validation === 'string') return validation;
  if (validation.totalPoints !== TOTAL_SCORE) {
    return `مجموع العلامات يجب أن يساوي ${TOTAL_SCORE}.`;
  }
  for (let i = 0; i < prepared.length; i += 1) {
    const q = prepared[i];
    if (q.options.length !== 4) return `السؤال ${i + 1}: يجب أن يحتوي على 4 خيارات.`;
    if (q.points !== QUESTION_POINTS) return `السؤال ${i + 1}: العلامة يجب أن تكون ${QUESTION_POINTS}.`;
    const answer = normalizeCorrectAnswer(q.question_type, q.correct_answer, q.options);
    if (!q.options.includes(answer)) return `السؤال ${i + 1}: الإجابة الصحيحة غير موجودة ضمن الخيارات.`;
  }
  return {
    ok: true,
    questionCount: QUESTION_COUNT,
    questionPoints: QUESTION_POINTS,
    totalPoints: TOTAL_SCORE,
    passingScore: PASSING_SCORE,
    passCorrectCount: PASS_CORRECT_COUNT,
    correctAnswersConfigured: QUESTION_COUNT,
  };
}

function gradeCorrectCount(correctCount) {
  const stored = toStorageQuestions().map((q, i) => ({ ...q, id: `q-${i}` }));
  const answers = {};
  for (let i = 0; i < stored.length; i += 1) {
    const q = stored[i];
    const answer = normalizeCorrectAnswer(q.question_type, q.correct_answer, q.options);
    answers[q.id] = i < correctCount ? answer : q.options.find((opt) => opt !== answer) || '';
  }
  const graded = gradeAnswers(stored, answers);
  return {
    correctCount,
    scorePoints: graded.scorePoints,
    maxPoints: graded.maxPoints,
    scorePercent: graded.scorePercent,
    passed: graded.scorePercent >= PASSING_SCORE,
  };
}

module.exports = {
  UNIVERSITY_CODE,
  UNIVERSITY_NAME_AR,
  OPPORTUNITY_TITLE,
  OPPORTUNITY_ID,
  TEMPLATE_ID,
  ASSESSMENT_TITLE,
  DESCRIPTION,
  QUESTION_COUNT,
  QUESTION_POINTS,
  TOTAL_SCORE,
  PASSING_SCORE,
  PASS_CORRECT_COUNT,
  CLOSES_AT,
  RAW_QUESTIONS,
  toStorageQuestions,
  validateZarqaPreBank,
  gradeCorrectCount,
};
