'use strict';

/**
 * Idempotent seed: post-test for CPF-JOB-INTERVIEW-2026-08 (مؤسسة ولي العهد).
 * Does not create a duplicate course or modify the existing pre-test questions.
 *
 * Run: node scripts/seed-cpf-job-interview-post-test.js
 *      npm run seed:cpf-job-interview-post-test
 */

const { prisma } = require('../src/config/db');
const { emitDomainEvent } = require('../src/modules/notificationEngine');
const { recordAudit } = require('../src/shared/services/audit.service');
const { prepareQuestionForStorage } = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');

const ORG_CODE = 'CROWN_PRINCE_FOUNDATION';
const ORG_NAME_AR = 'مؤسسة ولي العهد';
const COURSE_CODE = 'CPF-JOB-INTERVIEW-2026-08';
const PRE_ASSESSMENT_CODE = 'CPF-JOB-INTERVIEW-2026-PRE';
const ASSESSMENT_CODE = 'CPF-JOB-INTERVIEW-2026-POST';

/** Spec answer key: question number (1-based) → A|B|C|D */
const ANSWER_KEY = {
  1: 'C',
  2: 'B',
  3: 'D',
  4: 'A',
  5: 'C',
  6: 'B',
  7: 'D',
  8: 'A',
  9: 'C',
  10: 'B',
  11: 'D',
  12: 'A',
  13: 'C',
  14: 'B',
  15: 'D',
  16: 'C',
  17: 'A',
  18: 'D',
  19: 'B',
  20: 'C',
};

const LETTER_TO_INDEX = { A: 0, B: 1, C: 2, D: 3 };

/**
 * @type {{ prompt: string, options: [string, string, string, string], correctLetter: 'A'|'B'|'C'|'D' }[]}
 */
const POST_QUESTIONS = [
  {
    prompt:
      'قرأت إعلانًا لوظيفة «منسق مشاريع» يتكرر فيه: إعداد التقارير، التواصل مع العملاء، وإدارة الوقت. ما أفضل طريقة للاستعداد؟',
    options: [
      'حفظ تعريفات نظرية لهذه المهارات',
      'التركيز على مهارة واحدة لأن بقية المهارات ستظهر تلقائيًا',
      'تجهيز مثال واقعي يثبت كل مهارة وربطه بمتطلبات الوظيفة',
      'إعادة كتابة الإعلان في السيرة الذاتية',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'أي إجابة هي الأقوى عن سؤال: «حدثني عن نفسك»؟',
    options: [
      'أنا شخص طموح وأحب العمل وأبحث عن أي فرصة مناسبة',
      'أنا خريج إدارة أعمال، طورت مهارات التنظيم وإعداد التقارير من خلال مشروع جامعي وتدريب عملي، وأرغب في تطبيقها ضمن دور يتطلب متابعة المشاريع والتواصل مع الفريق',
      'اسمي أحمد، عمري 23 عامًا، وأسكن في عمّان ولدي خمسة إخوة',
      'جميع المعلومات موجودة في سيرتي الذاتية ويمكنكم قراءتها',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'في مقابلة لجنة، طرح أحد الأعضاء سؤالًا سلوكيًا. ما التصرف الأكثر مهنية؟',
    options: [
      'توجيه الإجابة فقط إلى أعلى شخص منصبًا',
      'تثبيت النظر على الشخص الذي يبدو أكثر ترحيبًا',
      'النظر إلى الأوراق لتجنب التوتر',
      'بدء الإجابة بالنظر إلى من طرح السؤال، ثم توزيع التواصل البصري على أعضاء اللجنة',
    ],
    correctLetter: 'D',
  },
  {
    prompt: 'بدأت مقابلة إلكترونية ولاحظت وجود تقطّع مستمر في الصوت. ما التصرف الأفضل؟',
    options: [
      'توضيح المشكلة باختصار، ومحاولة إصلاحها أو طلب الانتقال إلى وسيلة بديلة',
      'الاستمرار في الكلام بسرعة حتى لا يلاحظ المحاور المشكلة',
      'إنهاء الاتصال مباشرة دون توضيح',
      'إلقاء اللوم على منصة المقابلة',
    ],
    correctLetter: 'A',
  },
  {
    prompt:
      'قال متقدم في إجابة STAR: «تواصلت مع أعضاء الفريق، قسمت المهام، وحددت موعدًا يوميًا للمتابعة». أي عنصر يمثله هذا الجزء؟',
    options: ['Situation', 'Task', 'Action', 'Result'],
    correctLetter: 'C',
  },
  {
    prompt: 'سُئل خريج جديد عن قلة خبرته العملية. ما الإجابة الأقوى؟',
    options: [
      'لا أملك أي خبرة، لكنني أحتاج إلى فرصة فقط',
      'خبرتي الوظيفية المباشرة محدودة، لكنني طبقت مهارات قريبة في مشروع جامعي وتدريب عملي، ولدي خطة واضحة لتطوير الجوانب التي لم أمارسها بعد',
      'الخبرة ليست مهمة لأن الشهادة تكفي',
      'جميع المتقدمين حديثي التخرج لا يملكون خبرة',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'سُئلت: «حدثني عن خلاف مع زميل». أي إجابة تعكس نضجًا مهنيًا أكبر؟',
    options: [
      'لم أختلف مع أي شخص طوال حياتي',
      'كان زميلي مخطئًا، لذلك رفعت الموضوع مباشرة إلى الإدارة',
      'تجنبت الحديث معه حتى انتهى المشروع',
      'أوضحت نقطة الاختلاف، استمعت إلى وجهة نظره، واتفقنا على توزيع واضح للمسؤوليات مما ساعدنا على إنهاء المهمة',
    ],
    correctLetter: 'D',
  },
  {
    prompt: 'طرح المحاور سؤالًا تقنيًا لا تعرف إجابته الدقيقة. ما التصرف الأفضل؟',
    options: [
      'الاعتراف بعدم معرفة الإجابة الدقيقة، ثم شرح الطريقة التي ستتبعها للوصول إلى حل موثوق',
      'تقديم أي إجابة حتى لا يظهر أنك لا تعرف',
      'تغيير الموضوع إلى مهارة أخرى تتقنها',
      'القول إن السؤال غير مهم للوظيفة',
    ],
    correctLetter: 'A',
  },
  {
    prompt: 'لدى المتقدم فجوة مدتها سنة في سيرته الذاتية. ما أفضل طريقة لشرحها؟',
    options: [
      'حذف السنة من السيرة الذاتية',
      'إعطاء تفاصيل شخصية طويلة لإقناع المحاور',
      'تقديم تفسير مختصر وصادق، وذكر ما تم تعلمه أو تطويره خلال الفترة، ثم التركيز على الجاهزية الحالية',
      'الادعاء بأنه كان يعمل دون ذكر مكان العمل',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'سُئل متقدم عن معدله الجامعي المنخفض. ما الإجابة الأكثر مهنية؟',
    options: [
      'الجامعة كانت صعبة والأساتذة لم يكونوا منصفين',
      'الاعتراف بالمعدل دون تهرب، ثم إبراز المشاريع والمهارات العملية والتحسن أو الإنجازات الحديثة',
      'المعدل لا علاقة له بأي وظيفة',
      'إعطاء معدل مختلف عن المسجل في الوثائق',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'أي تصرف هو الأفضل عند سؤال المتقدم عن الراتب المتوقع؟',
    options: [
      'إعطاء أقل رقم ممكن لضمان القبول',
      'رفض الإجابة في جميع الحالات',
      'ذكر رقم مرتفع جدًا حتى تبدأ المفاوضات منه',
      'تقديم نطاق منطقي مبني على مسؤوليات الوظيفة ومتوسط السوق والخبرة، مع إظهار مرونة مناسبة',
    ],
    correctLetter: 'D',
  },
  {
    prompt: 'سأل المحاور سؤالًا شخصيًا لا يرتبط بمتطلبات الوظيفة. كيف تتصرف؟',
    options: [
      'الإجابة باحترام وباختصار أو إعادة توجيه الحديث إلى الجانب المهني المرتبط بالدور',
      'مغادرة المقابلة فورًا',
      'تقديم جميع التفاصيل الشخصية المطلوبة',
      'الرد بسؤال شخصي مماثل للمحاور',
    ],
    correctLetter: 'A',
  },
  {
    prompt: 'أثناء المقابلة، لاحظت أنك تحرك قدمك باستمرار وتنظر إلى الطاولة. ما أفضل تصحيح فوري؟',
    options: [
      'شبك الذراعين لإيقاف الحركة',
      'التحدث بسرعة لإنهاء المقابلة',
      'أخذ نفس هادئ، تثبيت القدمين، تعديل الجلسة، وإعادة التواصل البصري بصورة طبيعية',
      'الاعتذار المتكرر عن التوتر',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'لديك عدة مهام عاجلة وطلب منك المدير مهمة جديدة. أي إجابة أقوى في مقابلة عن إدارة الضغط؟',
    options: [
      'أنفذ المهمة الجديدة وأتجاهل بقية المهام',
      'أراجع الأولويات والمواعيد، وأوضح التعارض للمسؤول، ثم أتفق معه على ترتيب التنفيذ',
      'أعمل على جميع المهام في الوقت نفسه دون خطة',
      'أرفض المهمة لأنها لم تكن ضمن الجدول',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'سُئلت: «لماذا تركت عملك السابق؟». ما الإجابة الأفضل؟',
    options: [
      'لأن مديري السابق لم يكن يفهم العمل',
      'لأن زملائي كانوا سبب جميع المشكلات',
      'لأنني لم أعد أحب المؤسسة',
      'أقدّر ما تعلمته في التجربة السابقة، لكنني أبحث الآن عن مسؤوليات وفرص تطوير تتوافق أكثر مع هدفي المهني',
    ],
    correctLetter: 'D',
  },
  {
    prompt: 'أي سؤال هو الأكثر قوة لطرحه في نهاية المقابلة؟',
    options: [
      'متى يمكنني طلب إجازة طويلة؟',
      'هل يمكن تقليل ساعات العمل بعد التوظيف؟',
      'ما أهم الأولويات التي تتوقعون من الشخص الذي سيشغل هذا الدور تحقيقها خلال أول ثلاثة أشهر؟',
      'هل تعتقدون أنني قُبلت؟',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'ما أفضل محتوى لرسالة شكر بعد المقابلة؟',
    options: [
      'شكر المحاور، الإشارة إلى نقطة محددة نوقشت، وتأكيد الاهتمام بالفرصة بصورة مختصرة',
      'طلب النتيجة النهائية فورًا',
      'إرسال الرسالة نفسها إلى جميع الشركات دون تخصيص',
      'كتابة رسالة طويلة تعيد جميع إجابات المقابلة',
    ],
    correctLetter: 'A',
  },
  {
    prompt:
      'بدأ متقدم إجابة سلوكية بسرد تفاصيل كثيرة عن المؤسسة والفريق، لكنه لم يوضح دوره أو النتيجة. ما التحسين الأهم؟',
    options: [
      'إضافة تفاصيل أكثر عن أعضاء الفريق',
      'إطالة المقدمة حتى يفهم المحاور السياق',
      'حذف النتيجة والتركيز على المشكلة',
      'اختصار الموقف، وتوضيح مسؤوليته وإجراءاته الشخصية والنتيجة باستخدام STAR',
    ],
    correctLetter: 'D',
  },
  {
    prompt: 'أي متقدم يُرجح أن يترك انطباعًا أكثر إيجابية؟',
    options: [
      'متقدم يملك خبرة قوية لكنه وصل متأخرًا وانتقد مديره السابق',
      'متقدم ربط مهاراته بمتطلبات الوظيفة، وقدّم أمثلة حقيقية، وأظهر اهتمامًا بالشركة واستعدادًا للتعلم',
      'متقدم تحدث معظم الوقت دون أن يترك فرصة للأسئلة',
      'متقدم حفظ إجابات نموذجية لكنه لم يستطع تقديم أمثلة من خبرته',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'بعد محاكاة مقابلة، تلقى المتدرب ملاحظة بأن إجاباته صحيحة لكنها عامة. ما أفضل خطة لتحسينها؟',
    options: [
      'حفظ إجابات أطول لكل الأسئلة',
      'استخدام مصطلحات معقدة لإظهار المعرفة',
      'تجهيز مواقف حقيقية مرتبطة بالمهارات المطلوبة، وتنظيمها باستخدام STAR والتدرب على تقديمها خلال وقت محدد',
      'تجنب الأسئلة السلوكية والتركيز على التعريف بالنفس فقط',
    ],
    correctLetter: 'C',
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
  if (POST_QUESTIONS.length !== 20) {
    throw new Error(`Expected 20 post-test questions, got ${POST_QUESTIONS.length}`);
  }
  for (let i = 0; i < POST_QUESTIONS.length; i += 1) {
    const q = POST_QUESTIONS[i];
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
  return POST_QUESTIONS.map((q, i) => {
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

async function resolveCourse() {
  const matches = await prisma.training_programs.findMany({
    where: { code: COURSE_CODE },
    include: { organizations: true },
  });
  if (matches.length === 0) {
    throw new Error(
      `Course ${COURSE_CODE} not found. Run npm run seed:cpf-job-interview first.`
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `COURSE_CODE_CONFLICT: ${COURSE_CODE} matched ${matches.length} programs; aborting.`
    );
  }
  const program = matches[0];
  const org = program.organizations;
  if (!org || org.code !== ORG_CODE) {
    throw new Error(
      `Course ${COURSE_CODE} organization mismatch: expected ${ORG_CODE}, got ${org?.code || 'null'}`
    );
  }
  if (org.type !== 'INSTITUTION') {
    throw new Error(`Organization ${ORG_CODE} type must be INSTITUTION, got ${org.type}`);
  }
  if (program.type !== 'TRAINING_COURSE') {
    throw new Error(`Course type must be TRAINING_COURSE, got ${program.type}`);
  }
  if (program.title !== 'اجتياز مقابلات العمل') {
    throw new Error(`Course title mismatch: expected اجتياز مقابلات العمل, got ${program.title}`);
  }
  if (org.name !== ORG_NAME_AR && !String(org.name || '').includes('ولي العهد')) {
    throw new Error(`Organization name mismatch: expected ${ORG_NAME_AR}, got ${org.name}`);
  }
  return { program, organization: org };
}

async function syncRequirements(programId) {
  const defs = [
    {
      code: 'PRE_TEST',
      label: 'الاختبار القبلي',
      is_required: true,
      threshold_json: {
        passing_required: false,
        require_submission: true,
        blocks_content: true,
      },
    },
    {
      code: 'POST_TEST',
      label: 'الاختبار البعدي',
      is_required: true,
      threshold_json: {
        pass_score: 70,
        passing_required: true,
        require_submission: true,
      },
    },
    {
      code: 'TASKS',
      label: 'المهمات',
      is_required: false,
      threshold_json: null,
    },
    {
      code: 'FINAL_TASK',
      label: 'المهمة النهائية',
      is_required: false,
      threshold_json: null,
    },
    {
      code: 'EVALUATION',
      label: 'تقييم الدورة',
      is_required: true,
      threshold_json: null,
    },
  ];
  for (let i = 0; i < defs.length; i += 1) {
    const d = defs[i];
    await prisma.training_requirements.upsert({
      where: { program_id_code: { program_id: programId, code: d.code } },
      create: {
        program_id: programId,
        code: d.code,
        label: d.label,
        is_required: d.is_required,
        threshold_json: d.threshold_json ?? undefined,
        sort_order: i,
      },
      update: {
        is_required: d.is_required,
        threshold_json: d.threshold_json ?? undefined,
        label: d.label,
        sort_order: i,
        updated_at: new Date(),
      },
    });
  }
}

async function main() {
  const report = {
    course: null,
    organization: null,
    requirementsUpdated: null,
    assessment: null,
    questions: null,
    answerKey: null,
    preTestPreserved: null,
    notifications: [],
    audits: [],
    validation: null,
    blockers: [],
  };

  validateSpecLocally();
  const preparedQuestions = prepareQuestions();

  const { program, organization } = await resolveCourse();
  report.organization = {
    id: organization.id,
    code: organization.code,
    name: organization.name,
    type: organization.type,
  };
  report.course = {
    id: program.id,
    code: program.code,
    title: program.title,
    type: program.type,
    status: program.status,
    startDate: program.start_date,
    endDate: program.end_date,
  };

  const preAssessment = await prisma.training_assessments.findUnique({
    where: { code: PRE_ASSESSMENT_CODE },
    include: { _count: { select: { training_assessment_questions: true, training_assessment_attempts: true } } },
  });
  if (!preAssessment || preAssessment.program_id !== program.id) {
    throw new Error(
      `Pre-test ${PRE_ASSESSMENT_CODE} not found on course ${COURSE_CODE}; aborting to avoid orphan post-test.`
    );
  }
  report.preTestPreserved = {
    id: preAssessment.id,
    code: preAssessment.code,
    questionCount: preAssessment._count.training_assessment_questions,
    attemptCount: preAssessment._count.training_assessment_attempts,
  };

  const result = await prisma.$transaction(
    async (tx) => {
      let assessment = await tx.training_assessments.findUnique({ where: { code: ASSESSMENT_CODE } });
      const assessmentData = {
        program_id: program.id,
        kind: 'POST_TEST',
        code: ASSESSMENT_CODE,
        title: 'الاختبار البعدي – اجتياز مقابلات العمل',
        instructions:
          'يتكون الاختبار البعدي من 20 سؤالًا تطبيقيًا من نوع الاختيار من متعدد. لكل سؤال إجابة صحيحة واحدة فقط. اقرأ الموقف جيدًا واختر الإجابة الأكثر مهنية.',
        duration_minutes: 25,
        max_attempts: 1,
        pass_score: 70,
        opens_at: new Date('2026-08-03T14:00:00+03:00'),
        closes_at: new Date('2026-08-03T23:59:00+03:00'),
        shuffle_questions: false,
        show_results: true,
        is_published: true,
        updated_at: new Date(),
      };

      let assessmentAction = 'created';
      if (assessment) {
        if (assessment.program_id !== program.id || assessment.kind !== 'POST_TEST') {
          throw new Error(`Assessment code ${ASSESSMENT_CODE} conflict with existing row`);
        }
        assessment = await tx.training_assessments.update({
          where: { id: assessment.id },
          data: assessmentData,
        });
        assessmentAction = 'updated';
      } else {
        const byKind = await tx.training_assessments.findUnique({
          where: { program_id_kind: { program_id: program.id, kind: 'POST_TEST' } },
        });
        if (byKind) {
          if (byKind.code && byKind.code !== ASSESSMENT_CODE) {
            throw new Error(
              `POST_TEST_CONFLICT: program already has POST_TEST with code ${byKind.code}`
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

      return { assessment, finalQuestions, questionsAction, attemptCount, assessmentAction };
    },
    { maxWait: 20000, timeout: 120000 }
  );

  await syncRequirements(program.id);
  report.requirementsUpdated = {
    requiresPreTest: true,
    requiresPostTest: true,
    postTestPassingRequired: true,
    postTestPassScore: 70,
  };

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
    const expectedText = POST_QUESTIONS[i].options[LETTER_TO_INDEX[expectedLetter]];
    return q.correct_answer === expectedText;
  });

  report.assessment = {
    id: result.assessment.id,
    code: result.assessment.code,
    kind: result.assessment.kind,
    title: result.assessment.title,
    isPublished: result.assessment.is_published,
    durationMinutes: result.assessment.duration_minutes,
    maxAttempts: result.assessment.max_attempts,
    passScore: result.assessment.pass_score != null ? Number(result.assessment.pass_score) : null,
    opensAt: result.assessment.opens_at,
    closesAt: result.assessment.closes_at,
    showResults: result.assessment.show_results,
    shuffleQuestions: result.assessment.shuffle_questions,
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
    questionCountIs20: qRows.length === 20,
    everyQuestionHasFourOptions: allFour,
    everyQuestionHasOneCorrect: oneCorrect,
    totalScoreIs20: totalPoints === 20,
    passScoreIs70: Number(result.assessment.pass_score) === 70,
    durationIs25: result.assessment.duration_minutes === 25,
    maxAttemptsIs1: result.assessment.max_attempts === 1,
    kindIsPostTest: result.assessment.kind === 'POST_TEST',
    isPublished: result.assessment.is_published === true,
    linkedToCourse: result.assessment.program_id === program.id,
    answerKeyMatchesSpec: answerKeyMatches,
    preTestUntouched: report.preTestPreserved.questionCount === 20,
  };

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
        kind: 'POST_TEST',
        is_published: true,
        questionsAction: result.questionsAction,
      },
    });
    report.audits.push(result.assessmentAction === 'created' ? 'create' : 'update');
  } catch {
    report.audits.push('write:failed');
  }

  try {
    await recordAudit({
      organizationId: organization.id,
      actionType: 'training_assessment.publish',
      entityType: 'training_assessment',
      entityId: result.assessment.id,
      newValues: { code: ASSESSMENT_CODE, is_published: true },
    });
    report.audits.push('publish');
  } catch {
    report.audits.push('publish:failed');
  }

  try {
    await emitDomainEvent('POST_TEST_PUBLISHED', {
      organizationId: organization.id,
      entityType: 'training_assessment',
      entityId: result.assessment.id,
      templateVars: {
        assessment_title: result.assessment.title,
        course_title: program.title,
      },
    });
    report.notifications.push('POST_TEST_PUBLISHED');
  } catch {
    report.notifications.push('POST_TEST_PUBLISHED:failed');
  }

  try {
    await emitDomainEvent('POST_TEST_AVAILABLE', {
      organizationId: organization.id,
      entityType: 'training_assessment',
      entityId: result.assessment.id,
      templateVars: {
        assessment_title: result.assessment.title,
        course_title: program.title,
      },
    });
    report.notifications.push('POST_TEST_AVAILABLE');
  } catch {
    report.notifications.push('POST_TEST_AVAILABLE:failed');
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
  COURSE_CODE,
  PRE_ASSESSMENT_CODE,
  ASSESSMENT_CODE,
  ANSWER_KEY,
  POST_QUESTIONS,
  LETTER_TO_INDEX,
  validateSpecLocally,
  prepareQuestions,
  questionsSignature,
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
