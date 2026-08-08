'use strict';

/**
 * Seed / update pre-assessment draft for TTU summer field training opportunity.
 *
 * Usage:
 *   node scripts/seed-ttu-pre-assessment.js           # dry-run report
 *   node scripts/seed-ttu-pre-assessment.js --apply   # write DB
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const repo = require('../src/modules/fieldTraining/fieldTraining.repository');
const {
  prepareQuestionForStorage,
  validateAssessmentQuestions,
} = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const OPPORTUNITY_TITLE =
  'التدريب الميداني الصيفي لطلبة جامعة الطفيلة التقنية 2025/2026';

const ASSESSMENT_TITLE = 'التقييم القبلي – المعرفة الأساسية بتكنولوجيا المعلومات';

const DESCRIPTION = `يهدف هذا التقييم إلى قياس المعرفة الأساسية لدى الطالب في الحاسوب، وأنظمة التشغيل، والشبكات، والأمن الرقمي، والبرمجة وقواعد البيانات قبل بدء التدريب. لا تؤثر النتيجة على قبول الطالب، وإنما تساعد في تحديد مستواه واحتياجاته التدريبية.

المدة المقترحة: 30 دقيقة.`;

const RAW_QUESTIONS = [
  {
    question_text: 'ما المكوّن المسؤول عن تنفيذ التعليمات ومعالجة البيانات داخل الحاسوب؟',
    question_type: 'multiple_choice',
    options: ['RAM', 'CPU', 'القرص الصلب', 'الشاشة'],
    correct_answer: 'CPU',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'أي من الآتي يُعد نظام تشغيل؟',
    question_type: 'multiple_choice',
    options: ['Microsoft Word', 'Google Chrome', 'Windows', 'Adobe Photoshop'],
    correct_answer: 'Windows',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'ما الوظيفة الأساسية لذاكرة RAM؟',
    question_type: 'multiple_choice',
    options: [
      'تخزين دائم',
      'حفظ البيانات مؤقتًا أثناء تشغيل البرامج',
      'حماية الجهاز',
      'الاتصال بالإنترنت',
    ],
    correct_answer: 'حفظ البيانات مؤقتًا أثناء تشغيل البرامج',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'أي جهاز يُستخدم لربط أجهزة متعددة داخل شبكة محلية؟',
    question_type: 'multiple_choice',
    options: ['Switch', 'Printer', 'Scanner', 'Keyboard'],
    correct_answer: 'Switch',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'ما المقصود بعنوان IP؟',
    question_type: 'multiple_choice',
    options: [
      'كلمة مرور',
      'عنوان يميز الجهاز داخل الشبكة',
      'اسم المستخدم',
      'نوع نظام التشغيل',
    ],
    correct_answer: 'عنوان يميز الجهاز داخل الشبكة',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'أي بروتوكول يُستخدم لتصفح المواقع بطريقة مشفرة؟',
    question_type: 'multiple_choice',
    options: ['HTTP', 'HTTPS', 'FTP', 'SMTP'],
    correct_answer: 'HTTPS',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'أي كلمة مرور تُعد الأقوى؟',
    question_type: 'multiple_choice',
    options: ['12345678', 'password', 'Ahmad2026', 'T3ch!2026#Secure'],
    correct_answer: 'T3ch!2026#Secure',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'ما المقصود بالتصيد الإلكتروني Phishing؟',
    question_type: 'multiple_choice',
    options: [
      'تحسين سرعة الإنترنت',
      'خداع المستخدم للحصول على معلومات حساسة',
      'ضغط الملفات',
      'تحديث النظام',
    ],
    correct_answer: 'خداع المستخدم للحصول على معلومات حساسة',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'ما اللغة المستخدمة لبناء الهيكل الأساسي لصفحات الويب؟',
    question_type: 'multiple_choice',
    options: ['HTML', 'CSS', 'SQL', 'Python'],
    correct_answer: 'HTML',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'ما وظيفة CSS؟',
    question_type: 'multiple_choice',
    options: [
      'تخزين البيانات',
      'تنسيق وتصميم صفحات الويب',
      'إدارة البريد',
      'حماية الجهاز',
    ],
    correct_answer: 'تنسيق وتصميم صفحات الويب',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'أي لغة تُستخدم عادة للاستعلام عن قواعد البيانات؟',
    question_type: 'multiple_choice',
    options: ['SQL', 'HTML', 'CSS', 'XML'],
    correct_answer: 'SQL',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'ما المقصود بالخوارزمية؟',
    question_type: 'multiple_choice',
    options: ['جهاز تخزين', 'خطوات مرتبة لحل مشكلة', 'برنامج حماية', 'نوع شبكة'],
    correct_answer: 'خطوات مرتبة لحل مشكلة',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'ما الوظيفة الأساسية لمتصفح الإنترنت؟',
    question_type: 'multiple_choice',
    options: [
      'كتابة البرامج',
      'الوصول إلى صفحات الويب',
      'تخزين الملفات فقط',
      'فحص الفيروسات',
    ],
    correct_answer: 'الوصول إلى صفحات ومواقع الويب',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'أي امتداد يُستخدم غالبًا للملفات النصية البسيطة؟',
    question_type: 'multiple_choice',
    options: ['.txt', '.jpg', '.mp4', '.exe'],
    correct_answer: '.txt',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'ما الهدف من استخدام النسخ الاحتياطي؟',
    question_type: 'multiple_choice',
    options: [
      'زيادة السرعة',
      'استعادة البيانات عند فقدانها',
      'تغيير النظام',
      'منع الإنترنت',
    ],
    correct_answer: 'استعادة البيانات عند فقدانها أو تلفها',
    points: 4,
    is_required: true,
  },
  {
    question_text: 'المصادقة الثنائية تضيف طبقة حماية إضافية للحساب.',
    question_type: 'true_false',
    correct_answer: true,
    points: 4,
    is_required: true,
  },
  {
    question_text: 'يجب استخدام كلمة المرور نفسها في جميع الحسابات.',
    question_type: 'true_false',
    correct_answer: false,
    points: 4,
    is_required: true,
  },
  {
    question_text: 'يمكن أن تحتوي رسائل البريد المجهولة على روابط أو ملفات ضارة.',
    question_type: 'true_false',
    correct_answer: true,
    points: 4,
    is_required: true,
  },
  {
    question_text: 'حذف اختصار برنامج من سطح المكتب يعني حذف البرنامج كاملًا.',
    question_type: 'true_false',
    correct_answer: false,
    points: 4,
    is_required: true,
  },
  {
    question_text: 'تحديث البرامج وأنظمة التشغيل يساعد في معالجة الثغرات الأمنية.',
    question_type: 'true_false',
    correct_answer: true,
    points: 4,
    is_required: true,
  },
  {
    question_text: 'اكتب مثالًا واحدًا على نظام تشغيل.',
    question_type: 'short_text',
    correct_answer: {
      answers: ['Windows', 'Linux', 'macOS', 'Android', 'iOS'],
      auto_grade: true,
    },
    points: 4,
    is_required: true,
  },
  {
    question_text: 'ما الاختصار المستخدم لوحدة المعالجة المركزية؟',
    question_type: 'short_text',
    correct_answer: { answers: ['CPU'], auto_grade: true },
    points: 4,
    is_required: true,
  },
  {
    question_text: 'اذكر مثالًا واحدًا على متصفح إنترنت.',
    question_type: 'short_text',
    correct_answer: {
      answers: [
        'Google Chrome',
        'Chrome',
        'Microsoft Edge',
        'Edge',
        'Firefox',
        'Safari',
        'Opera',
      ],
      auto_grade: true,
    },
    points: 4,
    is_required: true,
  },
  {
    question_text:
      'ماذا تفعل إذا وصلتك رسالة إلكترونية تطلب منك الضغط على رابط وإدخال كلمة المرور؟',
    question_type: 'long_text',
    correct_answer: {
      sample_answer:
        'عدم الضغط على الرابط، التحقق من المرسل، عدم إدخال كلمة المرور، الدخول من الموقع الرسمي، وإبلاغ الدعم أو المسؤول.',
      auto_grade: false,
      grading_mode: 'manual',
      rubric: [
        { label: 'عدم الضغط على الرابط', points: 1 },
        { label: 'التحقق من المرسل', points: 1 },
        { label: 'عدم إدخال المعلومات', points: 1 },
        { label: 'الدخول من الموقع الرسمي أو الإبلاغ', points: 1 },
      ],
    },
    points: 4,
    is_required: true,
  },
  {
    question_text:
      'اشرح باختصار الفرق بين تخزين الملفات على الجهاز وتخزينها على الخدمات السحابية.',
    question_type: 'long_text',
    correct_answer: {
      sample_answer:
        'التخزين المحلي يحفظ الملفات على جهاز المستخدم، بينما التخزين السحابي يحفظها على خوادم عبر الإنترنت ويسمح بالوصول إليها من أجهزة مختلفة.',
      auto_grade: false,
      grading_mode: 'manual',
      rubric: [
        { label: 'شرح التخزين المحلي', points: 2 },
        { label: 'شرح التخزين السحابي', points: 2 },
      ],
    },
    points: 4,
    is_required: true,
  },
];

function fixQuestion13Option() {
  const q = RAW_QUESTIONS[12];
  const idx = q.options.indexOf('الوصول إلى صفحات الويب');
  if (idx >= 0) q.options[idx] = 'الوصول إلى صفحات ومواقع الويب';
}

function fixQuestion15Option() {
  const q = RAW_QUESTIONS[14];
  const idx = q.options.indexOf('استعادة البيانات عند فقدانها');
  if (idx >= 0) q.options[idx] = 'استعادة البيانات عند فقدانها أو تلفها';
}

async function findOpportunity() {
  const row = await prisma.field_training_opportunities.findFirst({
    where: { title: OPPORTUNITY_TITLE },
    select: { id: true, title: true, requires_pre_assessment: true },
  });
  if (!row) {
    throw new Error(`Opportunity not found: ${OPPORTUNITY_TITLE}`);
  }
  return row;
}

async function buildReport(opportunityId) {
  fixQuestion13Option();
  fixQuestion15Option();

  const prepared = RAW_QUESTIONS.map((q, i) => prepareQuestionForStorage(q, i));
  const validation = validateAssessmentQuestions(
    RAW_QUESTIONS.map((q, i) => ({ ...q, sort_order: i }))
  );
  if (typeof validation === 'string') {
    throw new Error(validation);
  }

  const existing = await repo.findAssessmentByOpportunityAndType(opportunityId, 'pre');
  const totalPoints = validation.totalPoints;

  return {
    opportunityId,
    existingAssessmentId: existing?.id ?? null,
    existingStatus: existing?.status ?? null,
    action: existing ? 'update_draft' : 'create_draft',
    title: ASSESSMENT_TITLE,
    type: 'pre',
    status: 'draft',
    passing_score: 50,
    questionCount: prepared.length,
    totalPoints,
    prepared,
    validation,
  };
}

async function apply(report) {
  return prisma.$transaction(async (tx) => {
    const assessment = await tx.field_training_assessments.upsert({
      where: {
        opportunity_id_type: {
          opportunity_id: report.opportunityId,
          type: 'pre',
        },
      },
      create: {
        opportunity_id: report.opportunityId,
        type: 'pre',
        title: report.title,
        description: DESCRIPTION,
        passing_score: report.passing_score,
        status: 'draft',
      },
      update: {
        title: report.title,
        description: DESCRIPTION,
        passing_score: report.passing_score,
        status: 'draft',
        updated_at: new Date(),
      },
    });

    await tx.field_training_assessment_questions.deleteMany({
      where: { assessment_id: assessment.id },
    });

    if (report.prepared.length) {
      await tx.field_training_assessment_questions.createMany({
        data: report.prepared.map((q, i) => {
          const raw = RAW_QUESTIONS[i];
          const correctAnswer =
            raw?.question_type === 'long_text' && raw?.correct_answer
              ? raw.correct_answer
              : q.correct_answer ?? null;
          return {
            assessment_id: assessment.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options ?? null,
            correct_answer: correctAnswer,
            points: q.points ?? 4,
            is_required: q.is_required !== false,
            sort_order: q.sort_order ?? i,
          };
        }),
      });
    }

    const questions = await tx.field_training_assessment_questions.findMany({
      where: { assessment_id: assessment.id },
      orderBy: { sort_order: 'asc' },
    });

    const total = questions.reduce((sum, q) => sum + Number(q.points), 0);

    return {
      assessmentId: assessment.id,
      opportunityId: report.opportunityId,
      status: assessment.status,
      passing_score: Number(assessment.passing_score),
      questionCount: questions.length,
      totalPoints: total,
      questions: questions.map((q) => ({
        sort_order: q.sort_order,
        question_type: q.question_type,
        points: Number(q.points),
        is_required: q.is_required,
        question_text: q.question_text.slice(0, 80) + (q.question_text.length > 80 ? '…' : ''),
      })),
    };
  });
}

async function main() {
  const opp = await findOpportunity();
  const report = await buildReport(opp.id);

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        opportunity: { id: opp.id, title: opp.title },
        ...report,
        prepared: undefined,
        validation: report.validation,
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log('\nRe-run with --apply to write the assessment draft.');
    return;
  }

  const result = await apply(report);
  console.log('\nApplied:', JSON.stringify(result, null, 2));
}

module.exports = {
  RAW_QUESTIONS,
  DESCRIPTION,
  ASSESSMENT_TITLE,
  fixQuestion13Option,
  fixQuestion15Option,
};

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}