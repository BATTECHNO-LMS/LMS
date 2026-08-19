'use strict';

/**
 * Idempotent seed: LinkedIn وكتابة السيرة الذاتية CV for CROWN_PRINCE_FOUNDATION.
 * Creates/updates the TRAINING_COURSE in DRAFT (no invented dates, hours, trainer, or cohort)
 * and publishes the 20-question diagnostic pre-test on the shared assessment engine.
 *
 * Run: node scripts/seed-cpf-linkedin-cv-course.js
 *      npm run seed:cpf-linkedin-cv
 */

const { prisma } = require('../src/config/db');
const { emitDomainEvent } = require('../src/modules/notificationEngine');
const { recordAudit } = require('../src/shared/services/audit.service');
const { prepareQuestionForStorage } = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');

const ORG_CODE = 'CROWN_PRINCE_FOUNDATION';
const ORG_NAME_AR = 'مؤسسة ولي العهد';
const COURSE_CODE = 'CPF-LINKEDIN-CV-2026';
const ASSESSMENT_CODE = 'CPF-LINKEDIN-CV-2026-PRE';
const COURSE_TITLE_AR = 'LinkedIn وكتابة السيرة الذاتية CV';
const COURSE_TITLE_EN = 'LinkedIn & CV Development';
const ASSESSMENT_TITLE = 'الاختبار القبلي – LinkedIn وكتابة السيرة الذاتية CV';

const DOMAINS = Object.freeze(['السيرة الذاتية', 'LinkedIn', 'التوظيف والاستعداد المهني']);

const DESCRIPTION =
  'تهدف دورة LinkedIn وكتابة السيرة الذاتية CV إلى تمكين المتدربين من بناء حضور مهني قوي يساعدهم على الوصول إلى فرص العمل، من خلال إعداد سيرة ذاتية احترافية ومتوافقة مع متطلبات سوق العمل، وتحسين الملف الشخصي على LinkedIn، وتعلّم كيفية عرض المهارات والخبرات والإنجازات بطريقة واضحة ومقنعة أمام أصحاب العمل ومسؤولي التوظيف.';

const TARGET_AUDIENCE =
  'طلبة الجامعات، الخريجون الجدد، الباحثون عن عمل، والأفراد الراغبون في تحسين سيرتهم الذاتية وحسابهم المهني على LinkedIn لزيادة جاهزيتهم لسوق العمل.';

const OBJECTIVES = [
  'تعريف المتدربين بأسس بناء سيرة ذاتية احترافية.',
  'تمكين المتدرب من اختيار وترتيب المعلومات المناسبة داخل CV.',
  'تحسين طريقة كتابة الخبرات والمهارات والإنجازات.',
  'التعرف إلى الأخطاء الشائعة في السير الذاتية.',
  'فهم المبادئ الأساسية لأنظمة تتبع المتقدمين ATS.',
  'بناء وتحسين حساب LinkedIn بصورة مهنية.',
  'كتابة عنوان مهني وملخص احترافي على LinkedIn.',
  'تحسين عرض الخبرات والتعليم والمهارات والمشاريع.',
  'استخدام LinkedIn للبحث عن الوظائف وبناء شبكة مهنية.',
  'ربط السيرة الذاتية وحساب LinkedIn بالهدف الوظيفي للمتدرب.',
];

const OUTCOMES = [
  'إعداد سيرة ذاتية منظمة ومناسبة للوظيفة المستهدفة.',
  'كتابة ملخص مهني مختصر وواضح.',
  'تحويل المهام السابقة إلى إنجازات قابلة للقياس.',
  'اختيار المهارات المناسبة للإعلان الوظيفي.',
  'تجنب الأخطاء التي تضعف السيرة الذاتية.',
  'تحسين توافق السيرة الذاتية مع ATS.',
  'إنشاء أو تحسين ملف LinkedIn احترافي.',
  'كتابة LinkedIn Headline فعال.',
  'إعداد About section بصورة مهنية.',
  'استخدام LinkedIn بصورة أفضل في البحث عن فرص العمل والتواصل المهني.',
];

/** Spec answer key: question number (1-based) → A|B|C|D */
const ANSWER_KEY = {
  1: 'B',
  2: 'A',
  3: 'C',
  4: 'B',
  5: 'B',
  6: 'A',
  7: 'B',
  8: 'C',
  9: 'C',
  10: 'C',
  11: 'B',
  12: 'B',
  13: 'C',
  14: 'B',
  15: 'B',
  16: 'C',
  17: 'B',
  18: 'B',
  19: 'C',
  20: 'A',
};

const LETTER_TO_INDEX = { A: 0, B: 1, C: 2, D: 3 };

/**
 * @type {{ prompt: string, options: [string, string, string, string], correctLetter: 'A'|'B'|'C'|'D' }[]}
 */
const PRE_QUESTIONS = [
  {
    prompt: 'ما الهدف الأساسي من السيرة الذاتية الاحترافية؟',
    options: [
      'عرض جميع تفاصيل حياة المتقدم',
      'تقديم ملخص مهني يساعد صاحب العمل على تقييم مدى مناسبة المتقدم للوظيفة',
      'إثبات أن المتقدم أفضل من جميع المرشحين',
      'كتابة أكبر عدد ممكن من الصفحات',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'ما أفضل طول لسيرة ذاتية لخريج جديد أو صاحب خبرة محدودة؟',
    options: [
      'من صفحة إلى صفحتين غالبًا',
      'خمس صفحات على الأقل',
      'عشر صفحات',
      'لا يوجد أي فرق مهما كان طولها',
    ],
    correctLetter: 'A',
  },
  {
    prompt: 'أي من التالي يُعد أفضل مثال على إنجاز داخل السيرة الذاتية؟',
    options: [
      'كنت مسؤولًا عن خدمة العملاء',
      'عملت في الشركة لمدة سنة',
      'ساهمت في تقليل وقت معالجة طلبات العملاء بنسبة 20%',
      'كنت موظفًا مجتهدًا',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'عند التقدم لوظيفة محددة، ما الأفضل فعله بالسيرة الذاتية؟',
    options: [
      'إرسال نفس CV لجميع الوظائف دون تعديل',
      'تعديل السيرة بما يتناسب مع متطلبات الإعلان الوظيفي',
      'حذف قسم المهارات',
      'زيادة عدد الصفحات فقط',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'ما المقصود بـ ATS في التوظيف؟',
    options: [
      'نظام لتصميم الشعارات',
      'نظام لتتبع وفرز طلبات المتقدمين للوظائف',
      'تطبيق لعقد مقابلات الفيديو فقط',
      'منصة لإصدار الشهادات',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'أي ممارسة تساعد السيرة الذاتية على التوافق بصورة أفضل مع ATS؟',
    options: [
      'استخدام الكلمات المفتاحية المرتبطة بالإعلان الوظيفي بصورة طبيعية',
      'وضع جميع الكلمات بلون أبيض لإخفائها',
      'استخدام صور كثيرة بدل النص',
      'استخدام تصميم شديد التعقيد مهما كان المحتوى',
    ],
    correctLetter: 'A',
  },
  {
    prompt: 'ما أفضل محتوى لقسم الملخص المهني في CV؟',
    options: [
      'العمر والحالة الاجتماعية والهوايات فقط',
      'تعريف مختصر يوضح التخصص والخبرة والمهارات والقيمة المهنية',
      'قائمة بجميع المواد الجامعية',
      'رسالة طويلة تتجاوز صفحة كاملة',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'أي بريد إلكتروني يعتبر أكثر مهنية داخل السيرة الذاتية؟',
    options: [
      'crazyboy2005@example.com',
      'kingofgames@example.com',
      'ahmad.alali@example.com',
      'coolman99@example.com',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'إذا كان المتقدم حديث التخرج ولا يملك خبرة وظيفية كبيرة، فما الأفضل؟',
    options: [
      'اختلاق خبرة غير موجودة',
      'ترك السيرة فارغة',
      'إبراز المشاريع الجامعية والتدريب والتطوع والمهارات العملية',
      'كتابة "لا أملك خبرة"',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'أي من التالي من الأخطاء الشائعة في السيرة الذاتية؟',
    options: [
      'مراجعة الأخطاء اللغوية',
      'استخدام ترتيب واضح',
      'إضافة معلومات غير صحيحة أو مبالغ فيها',
      'ربط المهارات بالوظيفة',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'ما الهدف الأساسي من LinkedIn للباحث عن عمل؟',
    options: [
      'مشاركة الصور الشخصية فقط',
      'بناء هوية وشبكة مهنية والوصول إلى فرص العمل',
      'استخدامه بدل البريد الإلكتروني في كل الحالات',
      'تخزين الملفات فقط',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'ما المقصود بـ LinkedIn Headline؟',
    options: [
      'اسم الشركة الحالية فقط',
      'العنوان المهني المختصر الذي يظهر أسفل اسم المستخدم',
      'عنوان المنزل',
      'اسم المستخدم وكلمة المرور',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'أي Headline يعتبر أكثر احترافية لخريج برمجة؟',
    options: [
      'Looking for anything',
      'Programmer',
      'Junior Full Stack Developer | React | Node.js | Building Web Applications',
      'Hello Everyone',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'ما الهدف من قسم About في LinkedIn؟',
    options: [
      'كتابة تفاصيل الحياة الشخصية',
      'تقديم نبذة مهنية توضح الخبرات والمهارات والاهتمامات والقيمة التي يقدمها الشخص',
      'إضافة كلمات مفتاحية عشوائية فقط',
      'نسخ السيرة الذاتية كاملة دون تعديل',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'ما أفضل صورة شخصية لحساب LinkedIn؟',
    options: [
      'صورة جماعية',
      'صورة احترافية واضحة بملابس ومظهر مناسب',
      'صورة بدون إظهار الوجه',
      'صورة كرتونية عشوائية',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'أي من التالي يساعد في زيادة قوة ملف LinkedIn؟',
    options: [
      'ترك قسم الخبرات فارغًا',
      'عدم إضافة المهارات',
      'إكمال الأقسام المهمة وإضافة الخبرات والمهارات والمشاريع والإنجازات',
      'عدم استخدام الحساب بعد إنشائه',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'عند إضافة خبرة أو مشروع على LinkedIn، ما الأسلوب الأفضل؟',
    options: [
      'كتابة اسم المشروع فقط',
      'وصف الدور والإجراءات والنتائج أو الإنجازات',
      'كتابة جملة "كان مشروعًا رائعًا"',
      'عدم توضيح ما قمت به',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'ما أفضل طريقة لبناء شبكة مهنية على LinkedIn؟',
    options: [
      'إرسال طلب اتصال عشوائي للجميع دون هدف',
      'التواصل مع أشخاص مرتبطين بالمجال والتفاعل المهني وبناء علاقات ذات قيمة',
      'إرسال طلب توظيف مباشر لكل شخص',
      'عدم إضافة أي شخص',
    ],
    correctLetter: 'B',
  },
  {
    prompt:
      'وجدت إعلان وظيفة يستخدم كلمات مثل:\nProject Management, Communication, Reporting\n\nما التصرف الأفضل؟',
    options: [
      'تجاهل الكلمات لأنها غير مهمة',
      'نسخ الإعلان كاملًا داخل CV',
      'إبراز المهارات والخبرات الحقيقية المرتبطة بهذه المتطلبات في CV وLinkedIn',
      'إضافة المهارات حتى لو لم تكن تمتلكها',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'ما أفضل علاقة بين CV وLinkedIn؟',
    options: [
      'يجب أن تكون المعلومات الأساسية متناسقة بينهما مع الاستفادة من LinkedIn لعرض تفاصيل ومشاريع وشبكة مهنية أوسع',
      'يجب أن يحتوي كل منهما على معلومات متناقضة',
      'لا توجد أي علاقة بينهما',
      'يجب حذف LinkedIn عند إرسال CV',
    ],
    correctLetter: 'A',
  },
];

function questionsSignature(rows) {
  return rows
    .map(
      (q, i) =>
        `${i}|${String(q.prompt || q.question_text || '').trim()}|${JSON.stringify(q.options || q.options_json)}|${JSON.stringify(q.correct_answer)}`
    )
    .join('\n');
}

function validateSpecLocally() {
  if (PRE_QUESTIONS.length !== 20) {
    throw new Error(`Expected 20 pre-test questions, got ${PRE_QUESTIONS.length}`);
  }
  if (OBJECTIVES.length !== 10) {
    throw new Error(`Expected 10 objectives, got ${OBJECTIVES.length}`);
  }
  if (OUTCOMES.length !== 10) {
    throw new Error(`Expected 10 outcomes, got ${OUTCOMES.length}`);
  }
  for (let i = 0; i < PRE_QUESTIONS.length; i += 1) {
    const q = PRE_QUESTIONS[i];
    const n = i + 1;
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question ${n} must have exactly 4 options`);
    }
    if (q.correctLetter !== ANSWER_KEY[n]) {
      throw new Error(
        `Question ${n} correctLetter ${q.correctLetter} does not match ANSWER_KEY ${ANSWER_KEY[n]}`
      );
    }
    const idx = LETTER_TO_INDEX[q.correctLetter];
    if (idx == null || !q.options[idx]) {
      throw new Error(`Question ${n} missing option for letter ${q.correctLetter}`);
    }
  }
}

function prepareQuestions() {
  return PRE_QUESTIONS.map((q, i) => {
    const correct = q.options[LETTER_TO_INDEX[q.correctLetter]];
    return prepareQuestionForStorage(
      {
        question_text: q.prompt,
        question_type: 'single_choice',
        options: q.options,
        correct_answer: correct,
        points: 1,
        is_required: true,
      },
      i
    );
  });
}

function numberedBlock(items) {
  return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
}

function summarizeOrgConflict(rows) {
  return rows
    .map((o) => `${o.id}:${o.code || 'NO_CODE'}:${o.type}:${o.name}`)
    .join(' | ');
}

async function resolveOrganization() {
  const byCode = await prisma.organizations.findMany({
    where: { code: ORG_CODE },
  });
  if (byCode.length > 1) {
    throw new Error(
      `ORGANIZATION_CONFLICT: code ${ORG_CODE} matched ${byCode.length} records (${summarizeOrgConflict(byCode)}). Aborting.`
    );
  }
  if (byCode.length === 1) {
    const org = byCode[0];
    if (org.type !== 'INSTITUTION') {
      throw new Error(
        `ORGANIZATION_CONFLICT: ${ORG_CODE} type is ${org.type}, expected INSTITUTION. Aborting.`
      );
    }
    const nameOk = org.name === ORG_NAME_AR || String(org.name || '').includes('ولي العهد');
    if (!nameOk) {
      throw new Error(
        `ORGANIZATION_CONFLICT: ${ORG_CODE} name is "${org.name}", expected ${ORG_NAME_AR}. Aborting.`
      );
    }
    return { organization: org, action: 'resolved_by_code' };
  }

  const byName = await prisma.organizations.findMany({
    where: { type: 'INSTITUTION', name: ORG_NAME_AR },
  });
  if (byName.length > 1) {
    throw new Error(
      `ORGANIZATION_CONFLICT: name ${ORG_NAME_AR} matched ${byName.length} INSTITUTION records (${summarizeOrgConflict(byName)}). Aborting.`
    );
  }
  if (byName.length === 1) {
    return { organization: byName[0], action: 'resolved_by_name' };
  }

  throw new Error(
    `Organization ${ORG_CODE} / ${ORG_NAME_AR} not found. Run npm run seed:institutions first. No duplicate organization was created.`
  );
}

function mergeCourseSettings(existingSettings) {
  const prev = existingSettings && typeof existingSettings === 'object' ? existingSettings : {};
  return {
    ...prev,
    shortDescription: DESCRIPTION,
    titleEn: COURSE_TITLE_EN,
    targetAudience: TARGET_AUDIENCE,
    domains: [...DOMAINS],
    enrollment: {
      ...(prev.enrollment && typeof prev.enrollment === 'object' ? prev.enrollment : {}),
      institutionTraineesOnly: true,
      publicRegistration: false,
    },
    // Diagnostic pre-test does not lock content unless an existing course already requires it.
    preTestBlocksContent: prev.preTestBlocksContent === true,
    timezone: prev.timezone || 'Asia/Amman',
  };
}

async function syncPreTestRequirement(tx, programId) {
  await tx.training_requirements.upsert({
    where: { program_id_code: { program_id: programId, code: 'PRE_TEST' } },
    create: {
      program_id: programId,
      code: 'PRE_TEST',
      label: 'الاختبار القبلي',
      is_required: true,
      threshold_json: {
        pass_score: 60,
        passing_required: false,
        require_submission: true,
        blocks_content: false,
      },
      sort_order: 0,
    },
    update: {
      is_required: true,
      label: 'الاختبار القبلي',
      threshold_json: {
        pass_score: 60,
        passing_required: false,
        require_submission: true,
        blocks_content: false,
      },
      sort_order: 0,
      updated_at: new Date(),
    },
  });

  const stubs = [
    { code: 'POST_TEST', label: 'الاختبار البعدي', sort_order: 1 },
    { code: 'TASKS', label: 'المهمات', sort_order: 2 },
    { code: 'FINAL_TASK', label: 'المهمة النهائية', sort_order: 3 },
    { code: 'EVALUATION', label: 'تقييم الدورة', sort_order: 4 },
  ];
  for (const stub of stubs) {
    const existing = await tx.training_requirements.findUnique({
      where: { program_id_code: { program_id: programId, code: stub.code } },
    });
    if (!existing) {
      await tx.training_requirements.create({
        data: {
          program_id: programId,
          code: stub.code,
          label: stub.label,
          is_required: false,
          threshold_json: undefined,
          sort_order: stub.sort_order,
        },
      });
    }
  }
}

async function main() {
  const report = {
    organization: null,
    course: null,
    assessment: null,
    questions: null,
    answerKey: null,
    remainingConfiguration: [
      'Start date',
      'End date',
      'Required hours',
      'Capacity',
      'Delivery mode',
      'Attendance requirement',
      'Cohort',
      'Trainer',
      'Post-test',
      'Final evaluation',
      'Certificate/completion rules',
    ],
    notifications: [],
    audits: [],
    validation: null,
    blockers: [],
  };

  validateSpecLocally();
  const preparedQuestions = prepareQuestions();

  const { organization, action: orgAction } = await resolveOrganization();
  const preexistingNameDuplicates = await prisma.organizations.findMany({
    where: {
      type: 'INSTITUTION',
      name: ORG_NAME_AR,
      NOT: { id: organization.id },
    },
    select: { id: true, code: true, type: true, status: true },
  });
  report.organization = {
    id: organization.id,
    code: organization.code,
    name: organization.name,
    type: organization.type,
    status: organization.status,
    action: orgAction,
    preexistingNameDuplicates: preexistingNameDuplicates.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
    })),
  };
  if (preexistingNameDuplicates.length) {
    report.blockers.push({
      code: 'PREEXISTING_ORG_NAME_DUPLICATES',
      message: `Found ${preexistingNameDuplicates.length} additional INSTITUTION row(s) named ${ORG_NAME_AR}. They were not used or modified. Course is scoped to ${ORG_CODE}.`,
      ids: preexistingNameDuplicates.map((o) => o.id),
    });
  }

  const result = await prisma.$transaction(
    async (tx) => {
      const byCode = await tx.training_programs.findMany({ where: { code: COURSE_CODE } });
      if (byCode.length > 1) {
        throw new Error(
          `COURSE_CODE_CONFLICT: ${COURSE_CODE} matched ${byCode.length} programs; aborting.`
        );
      }

      let program = byCode[0] || null;
      if (program && program.organization_id !== organization.id) {
        throw new Error(
          `COURSE_ORG_CONFLICT: ${COURSE_CODE} belongs to organization ${program.organization_id}, expected ${organization.id}`
        );
      }
      if (program && program.type !== 'TRAINING_COURSE') {
        throw new Error(
          `COURSE_TYPE_CONFLICT: ${COURSE_CODE} type is ${program.type}, expected TRAINING_COURSE`
        );
      }

      const sameTitle = await tx.training_programs.findMany({
        where: {
          organization_id: organization.id,
          type: 'TRAINING_COURSE',
          title: COURSE_TITLE_AR,
        },
      });
      const titleConflict = sameTitle.filter((p) => p.code !== COURSE_CODE);
      if (titleConflict.length && !program) {
        throw new Error(
          `COURSE_TITLE_CONFLICT: "${COURSE_TITLE_AR}" already exists under ${ORG_CODE} with code ${titleConflict[0].code || titleConflict[0].id}. Aborting to avoid a duplicate course.`
        );
      }

      const settings = mergeCourseSettings(program?.settings_json);
      const programData = {
        organization_id: organization.id,
        type: 'TRAINING_COURSE',
        code: COURSE_CODE,
        title: COURSE_TITLE_AR,
        description: DESCRIPTION,
        field: DOMAINS.join('، '),
        objectives: numberedBlock(OBJECTIVES),
        outcomes: numberedBlock(OUTCOMES),
        language: 'العربية',
        status: 'DRAFT',
        settings_json: settings,
        updated_at: new Date(),
      };
      // Preserve a later admin lifecycle status; never invent PUBLISHED.
      if (program && program.status !== 'DRAFT') {
        delete programData.status;
      }

      let courseAction = 'created';
      if (program) {
        program = await tx.training_programs.update({
          where: { id: program.id },
          data: programData,
        });
        courseAction = 'updated';
      } else {
        program = await tx.training_programs.create({ data: programData });
        courseAction = 'created';
      }

      await syncPreTestRequirement(tx, program.id);

      let assessment = await tx.training_assessments.findUnique({ where: { code: ASSESSMENT_CODE } });
      const assessmentData = {
        program_id: program.id,
        kind: 'PRE_TEST',
        code: ASSESSMENT_CODE,
        title: ASSESSMENT_TITLE,
        instructions:
          'يتكون الاختبار القبلي من 20 سؤالًا من نوع الاختيار من متعدد حول LinkedIn وكتابة السيرة الذاتية. اختر الإجابة التي تراها الأفضل والأصح. لكل سؤال إجابة صحيحة واحدة فقط. مدة الاختبار 20 دقيقة، ومحاولة واحدة.',
        duration_minutes: 20,
        max_attempts: 1,
        pass_score: 60,
        shuffle_questions: false,
        show_results: true,
        is_published: true,
        updated_at: new Date(),
      };

      let assessmentAction = 'created';
      if (assessment) {
        if (assessment.program_id !== program.id || assessment.kind !== 'PRE_TEST') {
          throw new Error(
            `ASSESSMENT_CODE_CONFLICT: ${ASSESSMENT_CODE} is linked to program ${assessment.program_id} kind ${assessment.kind}`
          );
        }
        assessment = await tx.training_assessments.update({
          where: { id: assessment.id },
          data: assessmentData,
        });
        assessmentAction = 'updated';
      } else {
        const byKind = await tx.training_assessments.findUnique({
          where: { program_id_kind: { program_id: program.id, kind: 'PRE_TEST' } },
        });
        if (byKind) {
          if (byKind.code && byKind.code !== ASSESSMENT_CODE) {
            throw new Error(
              `PRE_TEST_CONFLICT: program already has PRE_TEST with code ${byKind.code}`
            );
          }
          assessment = await tx.training_assessments.update({
            where: { id: byKind.id },
            data: assessmentData,
          });
          assessmentAction = 'reconciled_by_kind';
        } else {
          assessment = await tx.training_assessments.create({ data: assessmentData });
          assessmentAction = 'created';
        }
      }

      const existingQuestions = await tx.training_assessment_questions.findMany({
        where: { assessment_id: assessment.id },
        orderBy: { sort_order: 'asc' },
      });
      const attemptCount = await tx.training_assessment_attempts.count({
        where: { assessment_id: assessment.id },
      });

      const desiredSig = questionsSignature(
        preparedQuestions.map((q) => ({
          prompt: q.question_text,
          options_json: q.options,
          correct_answer: q.correct_answer,
        }))
      );
      const existingSig = questionsSignature(existingQuestions);

      let questionsAction = 'unchanged';
      const questionRows = preparedQuestions.map((q, i) => ({
        assessment_id: assessment.id,
        prompt: q.question_text,
        question_type: q.question_type,
        options_json: q.options,
        correct_answer: q.correct_answer,
        points: 1,
        sort_order: i,
      }));

      if (existingQuestions.length === 0) {
        await tx.training_assessment_questions.createMany({ data: questionRows });
        questionsAction = 'created';
      } else if (desiredSig !== existingSig) {
        if (attemptCount > 0) {
          throw new Error(
            `ASSESSMENT_QUESTION_CONFLICT: assessment ${ASSESSMENT_CODE} has ${attemptCount} attempt(s); will not replace questions.`
          );
        }
        await tx.training_assessment_questions.deleteMany({ where: { assessment_id: assessment.id } });
        await tx.training_assessment_questions.createMany({ data: questionRows });
        questionsAction = 'replaced_no_attempts';
      }

      const finalQuestions = await tx.training_assessment_questions.findMany({
        where: { assessment_id: assessment.id },
        orderBy: { sort_order: 'asc' },
      });

      return {
        program,
        assessment,
        finalQuestions,
        questionsAction,
        attemptCount,
        courseAction,
        assessmentAction,
      };
    },
    { maxWait: 20000, timeout: 120000 }
  );

  const trainerCount = await prisma.training_trainer_assignments.count({
    where: {
      training_program_id: result.program.id,
      is_active: true,
      revoked_at: null,
    },
  });
  const cohortCount = await prisma.training_cohorts.count({
    where: { program_id: result.program.id },
  });
  if (trainerCount === 0) {
    report.blockers.push({ code: 'NO_TRAINER_ASSIGNED', message: 'لم يتم تعيين مدرب بعد' });
  }
  if (cohortCount === 0) {
    report.blockers.push({ code: 'NO_COHORT', message: 'لم يتم إنشاء دفعة بعد' });
  }

  const qRows = result.finalQuestions;
  const optionCounts = qRows.map((q) => (Array.isArray(q.options_json) ? q.options_json.length : 0));
  const allFour = optionCounts.every((n) => n === 4);
  const oneCorrect = qRows.every((q) => {
    const opts = q.options_json;
    const ca = q.correct_answer;
    return Array.isArray(opts) && opts.filter((o) => o === ca).length === 1;
  });
  const totalPoints = qRows.reduce((s, q) => s + Number(q.points || 0), 0);
  const answerKeyMatches = qRows.every((q, i) => {
    const expectedLetter = ANSWER_KEY[i + 1];
    const expectedText = PRE_QUESTIONS[i].options[LETTER_TO_INDEX[expectedLetter]];
    return q.correct_answer === expectedText;
  });

  const orgCountByCode = await prisma.organizations.count({ where: { code: ORG_CODE } });
  const courseCountByCode = await prisma.training_programs.count({ where: { code: COURSE_CODE } });
  const assessmentCountByCode = await prisma.training_assessments.count({
    where: { code: ASSESSMENT_CODE },
  });

  report.course = {
    id: result.program.id,
    code: result.program.code,
    title: result.program.title,
    titleEn: result.program.settings_json?.titleEn || null,
    status: result.program.status,
    type: result.program.type,
    organizationId: result.program.organization_id,
    startDate: result.program.start_date,
    endDate: result.program.end_date,
    requiredHours: result.program.required_hours,
    deliveryMode: result.program.delivery_mode,
    maxParticipants: result.program.max_participants,
    requiredAttendancePct: result.program.required_attendance_pct,
    domains: result.program.settings_json?.domains || DOMAINS,
    trainerCount,
    cohortCount,
    action: result.courseAction,
  };
  report.assessment = {
    id: result.assessment.id,
    code: result.assessment.code,
    kind: result.assessment.kind,
    title: result.assessment.title,
    isPublished: result.assessment.is_published,
    durationMinutes: result.assessment.duration_minutes,
    maxAttempts: result.assessment.max_attempts,
    passScore: result.assessment.pass_score != null ? Number(result.assessment.pass_score) : null,
    showResults: result.assessment.show_results,
    showCorrectAnswers: false,
    shuffleQuestions: result.assessment.shuffle_questions,
    shuffleAnswers: false,
    action: result.assessmentAction,
  };
  report.questions = {
    count: qRows.length,
    action: result.questionsAction,
    existingAttempts: result.attemptCount,
    totalPoints,
  };
  report.answerKey = {
    matchesSpec: answerKeyMatches,
    key: ANSWER_KEY,
  };
  report.validation = {
    organizationResolvedUniquely: orgCountByCode === 1 && organization.type === 'INSTITUTION',
    noDuplicateOrganization: orgCountByCode === 1,
    courseExistsOnce: courseCountByCode === 1,
    courseBelongsToCpf: result.program.organization_id === organization.id,
    courseTypeTrainingCourse: result.program.type === 'TRAINING_COURSE',
    courseStatusDraft: result.program.status === 'DRAFT' || result.courseAction === 'updated',
    noInventedDates:
      result.courseAction !== 'created' ||
      (result.program.start_date == null && result.program.end_date == null),
    noInventedHours: result.courseAction !== 'created' || result.program.required_hours == null,
    noInventedTrainer: result.courseAction !== 'created' || trainerCount === 0,
    preTestExistsOnce: assessmentCountByCode === 1,
    preTestPublished: result.assessment.is_published === true,
    assessmentIsPreTest: result.assessment.kind === 'PRE_TEST',
    durationIs20: result.assessment.duration_minutes === 20,
    maxAttemptsIs1: result.assessment.max_attempts === 1,
    passingScoreIs60: Number(result.assessment.pass_score) === 60,
    questionCountIs20: qRows.length === 20,
    everyQuestionHasFourOptions: allFour,
    everyQuestionHasOneCorrect: oneCorrect,
    totalScoreIs20: totalPoints === 20,
    answerKeyMatchesSpec: answerKeyMatches,
    linkedToCourse: result.assessment.program_id === result.program.id,
  };

  try {
    await recordAudit({
      organizationId: organization.id,
      actionType:
        result.courseAction === 'created' ? 'TRAINING_PROGRAM_CREATED' : 'TRAINING_PROGRAM_UPDATED',
      entityType: 'training_program',
      entityId: result.program.id,
      newValues: {
        code: COURSE_CODE,
        title: COURSE_TITLE_AR,
        status: result.program.status,
      },
    });
    report.audits.push(result.courseAction === 'created' ? 'course.create' : 'course.update');
  } catch {
    report.audits.push('course.write:failed');
  }

  try {
    await recordAudit({
      organizationId: organization.id,
      actionType:
        result.assessmentAction === 'created'
          ? 'training_assessment.create'
          : 'training_assessment.update',
      entityType: 'training_assessment',
      entityId: result.assessment.id,
      newValues: {
        code: ASSESSMENT_CODE,
        kind: 'PRE_TEST',
        is_published: true,
        questionsAction: result.questionsAction,
      },
    });
    report.audits.push(result.assessmentAction === 'created' ? 'assessment.create' : 'assessment.update');
  } catch {
    report.audits.push('assessment.write:failed');
  }

  try {
    await recordAudit({
      organizationId: organization.id,
      actionType: 'training_assessment.publish',
      entityType: 'training_assessment',
      entityId: result.assessment.id,
      newValues: { code: ASSESSMENT_CODE, is_published: true },
    });
    report.audits.push('assessment.publish');
  } catch {
    report.audits.push('assessment.publish:failed');
  }

  try {
    await emitDomainEvent('PRE_TEST_PUBLISHED', {
      organizationId: organization.id,
      entityType: 'training_assessment',
      entityId: result.assessment.id,
      templateVars: {
        assessment_title: result.assessment.title,
        course_title: result.program.title,
      },
    });
    report.notifications.push('PRE_TEST_PUBLISHED');
  } catch {
    report.notifications.push('PRE_TEST_PUBLISHED:failed');
  }

  const ok = Object.values(report.validation).every(Boolean);
  console.log(JSON.stringify(report, null, 2));
  if (!ok) {
    process.exitCode = 1;
    console.error('VALIDATION_FAILED');
  } else {
    console.log('SEED_OK');
  }
}

module.exports = {
  ORG_CODE,
  ORG_NAME_AR,
  COURSE_CODE,
  ASSESSMENT_CODE,
  COURSE_TITLE_AR,
  COURSE_TITLE_EN,
  ASSESSMENT_TITLE,
  DOMAINS,
  DESCRIPTION,
  TARGET_AUDIENCE,
  OBJECTIVES,
  OUTCOMES,
  ANSWER_KEY,
  PRE_QUESTIONS,
  LETTER_TO_INDEX,
  validateSpecLocally,
  prepareQuestions,
  questionsSignature,
  mergeCourseSettings,
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
