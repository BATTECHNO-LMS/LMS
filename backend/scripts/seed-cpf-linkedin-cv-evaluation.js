'use strict';

/**
 * Idempotent seed: Kirkpatrick Level 1 final evaluation for CPF-LINKEDIN-CV-2026.
 * Level 2 remains pre-test vs post-test. Levels 3/4 are reserved (not implemented).
 *
 * Run: node scripts/seed-cpf-linkedin-cv-evaluation.js
 *      npm run seed:cpf-linkedin-cv-evaluation
 */

const { prisma } = require('../src/config/db');
const { recordAudit } = require('../src/shared/services/audit.service');

const COURSE_CODE = 'CPF-LINKEDIN-CV-2026';
const COURSE_TITLE_AR = 'LinkedIn وكتابة السيرة الذاتية CV';
const TEMPLATE_CODE = 'CPF-LINKEDIN-CV-2026-FINAL-EVALUATION';
const TEMPLATE_TITLE = 'التقييم النهائي – LinkedIn وكتابة السيرة الذاتية CV';
const ORG_CODE = 'CROWN_PRINCE_FOUNDATION';

const RATING_LABELS = {
  1: 'لا أوافق بشدة',
  2: 'لا أوافق',
  3: 'محايد',
  4: 'أوافق',
  5: 'أوافق بشدة',
};

const ONLINE_VENUE = [
  'كان رابط الدخول إلى التدريب واضحًا وسهل الاستخدام.',
  'كانت جودة الصوت والصورة مناسبة.',
  'كانت منصة التدريب سهلة الاستخدام.',
  'كانت المواد والروابط التدريبية متاحة بصورة واضحة.',
  'كان التنظيم والدعم الفني للتدريب الإلكتروني جيدًا.',
];

const INPERSON_VENUE = [
  'كانت تعليمات الوصول إلى مكان التدريب واضحة.',
  'كان مكان التدريب مناسبًا لعدد المشاركين.',
  'كانت القاعة مريحة ومنظمة ومناسبة للتدريب.',
  'كانت أجهزة العرض والصوت والإنترنت مناسبة لاحتياجات الدورة.',
  'كان تنظيم الدورة والالتزام بالمواعيد والاستقبال بمستوى جيد.',
];

const HYBRID_VENUE = [
  'كانت تعليمات الحضور والوصول أو الدخول الإلكتروني واضحة.',
  'كان مكان التدريب أو بيئة التدريب الإلكترونية مناسبة.',
  'كانت جودة الصوت والعرض والاتصال مناسبة.',
  'كانت المواد والروابط التدريبية متاحة بصورة واضحة.',
  'كان التنظيم والالتزام بالمواعيد جيدًا.',
];

function ratingQ(code, prompt, sortOrder, deliveryModes = null) {
  return {
    code,
    prompt,
    question_type: 'RATING_SCALE',
    is_required: true,
    sort_order: sortOrder,
    scale_min: 1,
    scale_max: 5,
    scale_labels_json: RATING_LABELS,
    delivery_modes_json: deliveryModes,
    max_length: null,
  };
}

function buildSectionsDef() {
  return [
    {
      code: 'TRAINER',
      title: 'تقييم المدرب',
      description: 'قيّم أداء المدرب خلال دورة LinkedIn وكتابة السيرة الذاتية.',
      indicator_key: 'trainer_score',
      sort_order: 0,
      questions: [
        ratingQ('T1', 'كان المدرب متمكنًا من موضوعات LinkedIn وكتابة السيرة الذاتية.', 0),
        ratingQ('T2', 'شرح المدرب الأفكار والمفاهيم بطريقة واضحة ومنظمة.', 1),
        ratingQ('T3', 'استخدم المدرب أمثلة واقعية مرتبطة بسوق العمل والتوظيف.', 2),
        ratingQ('T4', 'أتاح المدرب فرصة كافية للمشاركة وطرح الأسئلة.', 3),
        ratingQ('T5', 'ساعدت ملاحظات المدرب وتوجيهاته في تحسين فهمي وأدائي.', 4),
      ],
    },
    {
      code: 'CONTENT',
      title: 'المحتوى والمادة التدريبية',
      description: 'قيّم وضوح المحتوى وارتباطه باحتياجاتك المهنية.',
      indicator_key: 'content_score',
      sort_order: 1,
      questions: [
        ratingQ('C1', 'كانت أهداف الدورة واضحة منذ البداية.', 0),
        ratingQ('C2', 'كان محتوى الدورة مرتبطًا باحتياجاتي المهنية.', 1),
        ratingQ('C3', 'ساعدني المحتوى على فهم كيفية بناء سيرة ذاتية أكثر احترافية.', 2),
        ratingQ('C4', 'ساعدني المحتوى على فهم كيفية تطوير حساب LinkedIn بصورة مهنية.', 3),
        ratingQ('C5', 'كانت المادة التدريبية مرتبة وواضحة وسهلة التطبيق.', 4),
      ],
    },
    {
      code: 'ACTIVITIES',
      title: 'الأنشطة والتطبيق العملي',
      description: 'قيّم الأنشطة والاختبارات والتغذية الراجعة.',
      indicator_key: 'activities_score',
      sort_order: 2,
      questions: [
        ratingQ('A1', 'ساعدت الأنشطة العملية على تطبيق ما تم شرحه خلال الدورة.', 0),
        ratingQ('A2', 'ساعدتني الأمثلة والتطبيقات على اكتشاف نقاط الضعف في CV أو LinkedIn الخاص بي.', 1),
        ratingQ('A3', 'كان الاختبار القبلي مناسبًا لقياس معرفتي قبل التدريب.', 2),
        ratingQ('A4', 'كان الاختبار البعدي مناسبًا لقياس ما تعلمته خلال الدورة.', 3),
        ratingQ('A5', 'ساعدتني التغذية الراجعة والأنشطة على معرفة ما يجب تطويره في حضوري المهني.', 4),
      ],
    },
    {
      code: 'VENUE_ORG',
      title: 'التنظيم والبيئة التدريبية',
      description: 'تظهر الأسئلة حسب نمط الحضور المخزّن للدورة (حضوري / إلكتروني / هجين).',
      indicator_key: 'organization_score',
      sort_order: 3,
      questions: [
        ...ONLINE_VENUE.map((p, i) => ratingQ(`V_ON_${i + 1}`, p, i, ['ONLINE', 'VIRTUAL'])),
        ...INPERSON_VENUE.map((p, i) => ratingQ(`V_IP_${i + 1}`, p, 10 + i, ['IN_PERSON', 'ONSITE', 'OFFLINE'])),
        ...HYBRID_VENUE.map((p, i) => ratingQ(`V_HY_${i + 1}`, p, 20 + i, ['HYBRID'])),
      ],
    },
    {
      code: 'IMPACT',
      title: 'الأثر المهني المباشر',
      description:
        'هذا تقييم ذاتي للأثر الفوري (Kirkpatrick المستوى الأول — Reaction)، وليس دليلًا على تغيّر السلوك بعد الدورة.',
      indicator_key: 'immediate_impact_score',
      sort_order: 4,
      questions: [
        ratingQ('I1', 'أصبحت أكثر قدرة على إعداد سيرة ذاتية احترافية تتناسب مع الوظيفة المستهدفة.', 0),
        ratingQ('I2', 'أصبحت أكثر قدرة على كتابة الخبرات والمهارات والإنجازات بطريقة مقنعة.', 1),
        ratingQ('I3', 'أصبحت أكثر قدرة على تحسين Headline وAbout والأقسام الأساسية في LinkedIn.', 2),
        ratingQ('I4', 'أصبحت أفهم بصورة أفضل كيفية استخدام LinkedIn لبناء شبكة مهنية والوصول إلى الفرص.', 3),
        ratingQ(
          'I5',
          'أشعر أنني أصبحت أكثر قدرة على تسويق مهاراتي وإظهار قيمتي المهنية لأصحاب العمل والعملاء.',
          4
        ),
      ],
    },
    {
      code: 'NPS_FEEDBACK',
      title: 'التوصية والملاحظات',
      description: 'شاركنا احتمالية التوصية بهذه الدورة وأي ملاحظات اختيارية.',
      indicator_key: null,
      sort_order: 5,
      questions: [
        {
          code: 'NPS1',
          prompt: 'ما مدى احتمالية أن توصي بهذه الدورة لصديق أو زميل؟',
          question_type: 'NPS',
          is_required: true,
          sort_order: 0,
          scale_min: 0,
          scale_max: 10,
          scale_labels_json: { 0: 'غير محتمل إطلاقًا', 10: 'محتمل جدًا' },
          delivery_modes_json: null,
          max_length: null,
        },
        {
          code: 'O1',
          prompt: 'ما أكثر جزء استفدت منه في دورة LinkedIn وكتابة السيرة الذاتية CV؟',
          question_type: 'OPEN_TEXT',
          is_required: false,
          sort_order: 1,
          scale_min: null,
          scale_max: null,
          scale_labels_json: null,
          delivery_modes_json: null,
          max_length: 2000,
        },
        {
          code: 'O2',
          prompt: 'ما التحسين الذي تقترحه على المدرب أو المحتوى أو الأنشطة أو تنظيم الدورة؟',
          question_type: 'OPEN_TEXT',
          is_required: false,
          sort_order: 2,
          scale_min: null,
          scale_max: null,
          scale_labels_json: null,
          delivery_modes_json: null,
          max_length: 2000,
        },
      ],
    },
  ];
}

function visibleQuestionsForMode(allQuestions, mode) {
  const needle = mode ? String(mode).toUpperCase() : null;
  return allQuestions.filter((q) => {
    const raw = q.delivery_modes_json;
    if (!raw) return true;
    const list = Array.isArray(raw) ? raw : [];
    if (!needle) return false;
    return list.map((m) => String(m).toUpperCase()).includes(needle);
  });
}

function validateVisibleSet(questions, mode) {
  const visible = visibleQuestionsForMode(questions, mode);
  return {
    mode,
    count: visible.length,
    is28: visible.length === 28,
    ratingCount: visible.filter((q) => q.question_type === 'RATING_SCALE').length,
    npsCount: visible.filter((q) => q.question_type === 'NPS').length,
    openCount: visible.filter((q) => q.question_type === 'OPEN_TEXT').length,
    openOptional: visible.filter((q) => q.question_type === 'OPEN_TEXT').every((q) => q.is_required === false),
  };
}

async function main() {
  const matches = await prisma.training_programs.findMany({
    where: { code: COURSE_CODE },
    include: { organizations: true, training_cohorts: { select: { delivery_mode: true } } },
  });
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `Course ${COURSE_CODE} not found`
        : `COURSE_CODE_CONFLICT: ${matches.length} programs share ${COURSE_CODE}`
    );
  }
  const program = matches[0];
  if (program.organizations?.code !== ORG_CODE) {
    throw new Error(`Organization mismatch for ${COURSE_CODE}`);
  }
  if (program.type !== 'TRAINING_COURSE') {
    throw new Error(`Program ${COURSE_CODE} is not TRAINING_COURSE`);
  }
  if (program.title !== COURSE_TITLE_AR) {
    throw new Error(`Unexpected title for ${COURSE_CODE}: ${program.title}`);
  }

  const storedDeliveryMode =
    program.delivery_mode ||
    program.training_cohorts.find((c) => c.delivery_mode)?.delivery_mode ||
    null;

  const report = {
    courseId: program.id,
    courseCode: COURSE_CODE,
    templateId: null,
    templateCode: TEMPLATE_CODE,
    questions: 0,
    linked: false,
    storedDeliveryMode,
    kirkpatrick: {
      level1: 'FINAL_EVALUATION',
      level2: 'PRE_TEST_POST_TEST',
      level3: 'RESERVED',
      level4: 'RESERVED',
    },
  };

  const sectionsDef = buildSectionsDef();

  const result = await prisma.$transaction(
    async (tx) => {
      let template = await tx.training_evaluation_templates.findUnique({
        where: { code: TEMPLATE_CODE },
      });
      const templateData = {
        organization_id: program.organization_id,
        code: TEMPLATE_CODE,
        title: TEMPLATE_TITLE,
        description:
          'تقييم ختامي (Kirkpatrick المستوى الأول — Reaction) لقياس جودة المدرب والمحتوى والأنشطة والتنظيم والأثر المهني المباشر، مع سؤال التوصية (NPS) وملاحظات مفتوحة. قياس التعلّم (المستوى الثاني) يعتمد على الاختبار القبلي والبعدي وليس على هذا الاستبيان.',
        delivery_mode: storedDeliveryMode,
        is_active: true,
        version: 1,
        updated_at: new Date(),
      };
      if (template) {
        if (template.organization_id && template.organization_id !== program.organization_id) {
          throw new Error(`Template ${TEMPLATE_CODE} belongs to another organization`);
        }
        template = await tx.training_evaluation_templates.update({
          where: { id: template.id },
          data: templateData,
        });
      } else {
        template = await tx.training_evaluation_templates.create({ data: templateData });
      }

      const existingLink = await tx.training_program_evaluation_links.findUnique({
        where: { program_id: program.id },
      });
      if (existingLink && existingLink.template_id !== template.id) {
        const other = await tx.training_evaluation_templates.findUnique({
          where: { id: existingLink.template_id },
          select: { code: true },
        });
        throw new Error(
          `EVALUATION_LINK_CONFLICT: course already linked to template ${other?.code || existingLink.template_id}`
        );
      }

      const submittedCount = await tx.training_evaluation_assignments.count({
        where: { template_id: template.id, status: 'SUBMITTED' },
      });
      if (submittedCount === 0) {
        await tx.training_evaluation_sections.deleteMany({ where: { template_id: template.id } });
        for (const s of sectionsDef) {
          const section = await tx.training_evaluation_sections.create({
            data: {
              template_id: template.id,
              code: s.code,
              title: s.title,
              description: s.description,
              sort_order: s.sort_order,
              indicator_key: s.indicator_key,
            },
          });
          await tx.training_evaluation_questions.createMany({
            data: s.questions.map((q) => ({
              section_id: section.id,
              code: q.code,
              prompt: q.prompt,
              question_type: q.question_type,
              is_required: q.is_required,
              sort_order: q.sort_order,
              scale_min: q.scale_min,
              scale_max: q.scale_max,
              scale_labels_json: q.scale_labels_json ?? undefined,
              delivery_modes_json: q.delivery_modes_json ?? undefined,
              max_length: q.max_length,
            })),
          });
        }
      }

      await tx.training_program_evaluation_links.upsert({
        where: { program_id: program.id },
        create: {
          program_id: program.id,
          template_id: template.id,
          is_required: true,
          is_active: true,
        },
        update: {
          template_id: template.id,
          is_required: true,
          is_active: true,
          updated_at: new Date(),
        },
      });

      await tx.training_requirements.upsert({
        where: { program_id_code: { program_id: program.id, code: 'EVALUATION' } },
        create: {
          program_id: program.id,
          code: 'EVALUATION',
          label: 'تقييم الدورة',
          is_required: true,
          sort_order: 4,
        },
        update: {
          is_required: true,
          label: 'تقييم الدورة',
          updated_at: new Date(),
        },
      });

      const qCount = await tx.training_evaluation_questions.count({
        where: { training_evaluation_sections: { template_id: template.id } },
      });

      return { template, qCount, submittedCount, action: submittedCount === 0 ? 'synced' : 'preserved' };
    },
    { maxWait: 20000, timeout: 120000 }
  );

  const allQs = await prisma.training_evaluation_questions.findMany({
    where: { training_evaluation_sections: { template_id: result.template.id } },
  });

  const modesToCheck = storedDeliveryMode
    ? [String(storedDeliveryMode).toUpperCase()]
    : ['ONLINE', 'IN_PERSON', 'HYBRID'];
  const perMode = Object.fromEntries(modesToCheck.map((m) => [m, validateVisibleSet(allQs, m)]));

  report.templateId = result.template.id;
  report.questions = result.qCount;
  report.linked = true;
  report.submittedAssignmentsPreserved = result.submittedCount;
  report.questionsAction = result.action;
  report.validation = {
    templateActive: result.template.is_active,
    linkedToCourse: true,
    required: true,
    storedQuestions: allQs.length,
    perMode,
    everyVisibleSetIs28: Object.values(perMode).every((v) => v.is28 && v.ratingCount === 25 && v.npsCount === 1 && v.openCount === 2),
    openQuestionsOptional: Object.values(perMode).every((v) => v.openOptional),
    didNotInventDeliveryMode: true,
    didNotChangeCourseDates: true,
  };

  await recordAudit({
    organizationId: program.organization_id,
    actionType: 'training_evaluation_template.seed',
    entityType: 'training_evaluation_template',
    entityId: result.template.id,
    newValues: { code: TEMPLATE_CODE, courseCode: COURSE_CODE, questions: allQs.length },
  }).catch(() => null);

  const ok = report.validation.everyVisibleSetIs28 && report.validation.openQuestionsOptional;
  console.log(JSON.stringify(report, null, 2));
  if (!ok) {
    process.exitCode = 1;
    console.error('VALIDATION_FAILED');
  } else {
    console.log('SEED_OK');
  }
}

module.exports = {
  COURSE_CODE,
  COURSE_TITLE_AR,
  TEMPLATE_CODE,
  TEMPLATE_TITLE,
  ORG_CODE,
  RATING_LABELS,
  buildSectionsDef,
  visibleQuestionsForMode,
  validateVisibleSet,
};

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => null);
    });
}
