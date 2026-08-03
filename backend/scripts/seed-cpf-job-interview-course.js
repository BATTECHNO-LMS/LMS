'use strict';

/**
 * Idempotent seed: اجتياز مقابلات العمل for CROWN_PRINCE_FOUNDATION.
 * Run: node scripts/seed-cpf-job-interview-course.js
 *      npm run seed:cpf-job-interview
 */

const { prisma } = require('../src/config/db');
const { emitDomainEvent } = require('../src/modules/notificationEngine');
const { prepareQuestionForStorage } = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');

const ORG_CODE = 'CROWN_PRINCE_FOUNDATION';
const ORG_NAME_AR = 'مؤسسة ولي العهد';
const COURSE_CODE = 'CPF-JOB-INTERVIEW-2026-08';
const COHORT_CODE = 'CPF-JOB-INTERVIEW-2026-C1';
const ASSESSMENT_CODE = 'CPF-JOB-INTERVIEW-2026-PRE';

const OBJECTIVES = [
  'تمكين المتدرب من الاستعداد المنظم لمقابلة العمل.',
  'تدريب المتدرب على البحث عن الشركة وتحليل الوصف الوظيفي.',
  'تطوير مهارة تقديم النفس باستخدام خطاب مختصر ومقنع.',
  'تحسين الإجابة عن الأسئلة السلوكية باستخدام تقنية STAR.',
  'رفع وعي المتدرب بلغة الجسد والتواصل البصري.',
  'تدريب المتدرب على مناقشة الراتب والتوقعات المالية بصورة مهنية.',
  'تمكين المتدرب من إنهاء المقابلة والمتابعة بعدها بطريقة احترافية.',
];

const OUTCOMES = [
  'إجراء بحث أساسي عن الشركة والوظيفة قبل المقابلة.',
  'ربط المهارات والخبرات بمتطلبات الوصف الوظيفي.',
  'تقديم تعريف شخصي مختصر خلال 30 إلى 60 ثانية.',
  'استخدام تقنية STAR في الإجابة عن الأسئلة السلوكية.',
  'تطبيق التواصل البصري ولغة الجسد المهنية.',
  'الإجابة عن أسئلة نقاط الضعف والطموح بصورة مناسبة.',
  'مناقشة الراتب المتوقع بناءً على المهام وسوق العمل.',
  'طرح أسئلة مهنية وذكية في نهاية المقابلة.',
  'إرسال رسالة متابعة وشكر بعد المقابلة.',
];

const SHORT_DESCRIPTION =
  'دورة تدريبية مكثفة تساعد المتدربين على الاستعداد لمقابلات العمل، تقديم أنفسهم باحتراف، الإجابة عن الأسئلة الشائعة، وفهم السلوكيات التي تزيد فرص النجاح في المقابلة.';

const FULL_DESCRIPTION =
  'دورة عملية مكثفة تمتد على يومين وتهدف إلى تأهيل المتدربين لاجتياز مقابلات العمل بثقة واحتراف. تتناول الدورة البحث عن الشركة وتحليل الوصف الوظيفي، إعداد التعريف الشخصي المختصر، الإجابة باستخدام تقنية STAR، لغة الجسد والتواصل البصري، التعامل مع أسئلة نقاط القوة والضعف، مناقشة الراتب، إدارة المقابلات الهاتفية والجماعية، وطرق المتابعة المهنية بعد انتهاء المقابلة.';

/** @type {{ prompt: string, options: string[], correctIndex: number }[]} */
const PRE_QUESTIONS = [
  {
    prompt: 'ما هي الخطوة الأولى والأكثر أهمية عند الاستعداد لمقابلة العمل؟',
    options: [
      'اختيار الملابس المناسبة فقط',
      'البحث الشامل عن الشركة وطبيعة عملها',
      'التدريب على الابتسامة أمام المرآة',
      'حفظ السيرة الذاتية عن ظهر قلب',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'ما الهدف الأساسي من قراءة الوصف الوظيفي Job Description بتمعن قبل المقابلة؟',
    options: [
      'معرفة موعد الدوام الرسمي',
      'ربط مهاراتك وخبراتك بمتطلبات الوظيفة',
      'معرفة اسم المدير المباشر',
      'حفظ عدد ساعات العمل',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'ما الوقت المثالي للوصول إلى مكان المقابلة؟',
    options: [
      'قبل الموعد بـ30 إلى 45 دقيقة',
      'في الموعد تمامًا دون تأخير أو تبكير',
      'قبل الموعد بـ10 إلى 15 دقيقة',
      'بعد الموعد بـ5 دقائق لإظهار أنك مشغول',
    ],
    correctIndex: 2,
  },
  {
    prompt: 'ماذا يُقصد بمفهوم خطاب المصعد Elevator Pitch في المقابلات؟',
    options: [
      'التحدث عن نفسك أثناء استقلال المصعد مع المدير',
      'ملخص مركز ومقنع عن نفسك ومهاراتك يستغرق من 30 إلى 60 ثانية',
      'شرح تفصيلي لتاريخك الوظيفي لمدة 10 دقائق',
      'الحديث عن طموحاتك المالية في المستقبل',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'ما الذي تعكسه طريقة الجلوس بحرية زائدة أو الانحناء إلى الخلف بشكل كبير أثناء المقابلة؟',
    options: [
      'الثقة العالية بالنفس',
      'اللامبالاة أو قلة الاحترام للمحاور',
      'التركيز الشديد',
      'التوتر والقلق',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'التواصل البصري المتوازن Eye Contact مع المحاور يعكس:',
    options: [
      'التحدي والمواجهة',
      'الثقة والصدق والاهتمام',
      'الخجل والخوف',
      'الرغبة في إنهاء المقابلة بسرعة',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'شبك الذراعين أثناء الحديث يُفسر في لغة الجسد على أنه:',
    options: [
      'وضعية دفاعية أو عدم انفتاح على الآخرين',
      'قمة التركيز والانتباه',
      'دليل على البرد فقط',
      'شعور بالارتياح الشديد',
    ],
    correctIndex: 0,
  },
  {
    prompt: 'أفضل طريقة للإجابة عن سؤال: ما هي نقاط ضعفك؟ هي:',
    options: [
      'القول: ليس لدي أي نقاط ضعف',
      'ذكر نقطة ضعف حقيقية تعمل حاليًا على تحسينها وتطويرها',
      'ذكر ضعف يؤثر مباشرة على أساسيات الوظيفة',
      'استخدام إجابة مبتذلة مثل: أعمل أكثر من اللازم وأدقق في التفاصيل',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'عندما يسألك المحاور: أين ترى نفسك بعد 5 سنوات؟ ما الهدف من السؤال؟',
    options: [
      'معرفة ما إذا كان لديك طموح وخطط طويلة المدى ومدى استقرارك المتوقع',
      'اختبار معرفتك بالغيب',
      'معرفة هل تتطلع لأخذ مكان مديرك',
      'قياس حالتك الاجتماعية المستقبلية',
    ],
    correctIndex: 0,
  },
  {
    prompt: 'في تقنية STAR ماذا يعني حرف R؟',
    options: [
      'Reason – السبب',
      'Result – النتيجة والإنجاز الملموس',
      'Report – التقرير',
      'Risk – المخاطرة',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'متى يكون الوقت الأمثل لمناقشة التفاصيل المالية والراتب؟',
    options: [
      'في بداية المقابلة الأولى فورًا',
      'عندما يطرح المحاور الموضوع أو عند تقديم عرض العمل Job Offer',
      'عن طريق إرسال رسالة قبل المقابلة',
      'بعد توقيع العقد بشهرين',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'إذا سُئلت عن التوقعات المالية أو الراتب المتوقع، فما أفضل تصرف؟',
    options: [
      'إعطاء رقم محدد جدًا وغير قابل للتغيير',
      'إعطاء مدى سعري Range بناءً على دراسة السوق والمهام المطلوبة',
      'القول: أي راتب يناسبكم أنا موافق عليه',
      'رفض الإجابة تمامًا وبغضب',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'ماذا تعني عبارة Gross Salary في عروض العمل؟',
    options: [
      'الراتب الذي يصل إلى الحساب البنكي بعد الخصومات',
      'الراتب الإجمالي قبل خصم الضرائب والتأمينات الاجتماعية',
      'حوافز المبيعات السنوية فقط',
      'بدل السكن والمواصلات فقط',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'في نهاية المقابلة عندما يسألك المحاور: هل لديك أي أسئلة لنا؟ ما الإجابة الأفضل؟',
    options: [
      'لا، كل شيء واضح جدًا، شكرًا لك',
      'نعم، طرح سؤالين أو ثلاثة أسئلة ذكية حول طبيعة العمل أو ثقافة الشركة أو تحديات القسم',
      'متى سيزداد راتبي؟',
      'كم عدد أيام الإجازات المرضية؟',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'ما السؤال الذي يُنصح بعدم طرحه في المقابلة الأولى؟',
    options: [
      'ما خطوات التوظيف القادمة؟',
      'كم عدد الإجازات التي يحق لي أخذها في الشهور الأولى؟',
      'كيف تقيسون الأداء هنا؟',
      'ما الثقافة العامة لفريق العمل؟',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'ما الهدف الأساسي من المقابلة الهاتفية الأولى Phone Screening؟',
    options: [
      'تقديم عرض العمل النهائي',
      'التصفية الأولية والتحقق من المهارات الأساسية وتوقعات الراتب واللغة',
      'اختبار الشخصية بالكامل',
      'التوقيع على العقد',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'في المقابلة القائمة على لجنة Panel Interview، كيف توزع تواصلك البصري؟',
    options: [
      'التحدث فقط مع الشخص الأعلى منصبًا',
      'النظر إلى الشخص الذي طرح السؤال عند البدء ثم توزيع النظر على جميع أعضاء اللجنة أثناء الإجابة',
      'النظر إلى الطاولة لتجنب التوتر',
      'التركيز على شخص واحد وتجاهل الباقين',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'الإجابات الطويلة جدًا والمتشعبة Over-explaining تؤدي إلى:',
    options: [
      'إعطاء انطباع بالمعرفة الشاملة',
      'تشتيت المحاور وإغفال النقاط الرئيسية وتضييع وقت المقابلة',
      'زيادة فرص القبول',
      'إظهار التميز اللغوي',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'ما الخطوة المستحبة التي يُفضل القيام بها خلال 24 ساعة من انتهاء المقابلة؟',
    options: [
      'الاتصال بالمدير التنفيذي هاتفيًا',
      'إرسال رسالة شكر Thank You Email للمحاور أو مسؤول التوظيف',
      'الذهاب إلى مقر الشركة للاستفسار عن النتيجة',
      'نشر تفاصيل المقابلة على وسائل التواصل الاجتماعي',
    ],
    correctIndex: 1,
  },
  {
    prompt: 'ما المعيار الأول الذي يجعل مسؤول التوظيف يتذكرك إيجابيًا بين عشرات المتقدمين؟',
    options: [
      'الملابس الباهظة الثمن',
      'الجمع بين المهارات المناسبة والإيجابية والحماس للعمل والجاهزية للإضافة والتطوير',
      'الواسطة أو العلاقات الشخصية فقط',
      'التحدث دون توقف طوال المقابلة',
    ],
    correctIndex: 1,
  },
];

function dateOnly(isoDate) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

async function resolveOrganization() {
  let org = await prisma.organizations.findUnique({ where: { code: ORG_CODE } });
  if (org) {
    if (org.type !== 'INSTITUTION' || org.status !== 'active') {
      org = await prisma.organizations.update({
        where: { id: org.id },
        data: { type: 'INSTITUTION', status: 'active', name: ORG_NAME_AR, updated_at: new Date() },
      });
    }
    return { organization: org, action: 'resolved_by_code' };
  }

  org = await prisma.organizations.findFirst({
    where: {
      type: 'INSTITUTION',
      OR: [{ name: ORG_NAME_AR }, { name: { contains: 'ولي العهد' } }],
    },
  });
  if (org) {
    org = await prisma.organizations.update({
      where: { id: org.id },
      data: {
        code: ORG_CODE,
        name: ORG_NAME_AR,
        type: 'INSTITUTION',
        status: 'active',
        updated_at: new Date(),
      },
    });
    return { organization: org, action: 'reconciled_by_name' };
  }

  throw new Error(
    `Organization ${ORG_CODE} / ${ORG_NAME_AR} not found. Run npm run seed:institutions first.`
  );
}

function questionsSignature(rows) {
  return rows
    .map((q, i) => `${i}|${String(q.prompt || q.question_text || '').trim()}|${JSON.stringify(q.options || q.options_json)}|${JSON.stringify(q.correct_answer)}`)
    .join('\n');
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
    organization: null,
    course: null,
    cohort: null,
    assessment: null,
    questions: null,
    validation: null,
    notifications: [],
    blockers: [],
  };

  if (PRE_QUESTIONS.length !== 20) {
    throw new Error(`Expected 20 pre-test questions, got ${PRE_QUESTIONS.length}`);
  }

  const { organization, action: orgAction } = await resolveOrganization();
  report.organization = {
    id: organization.id,
    code: organization.code,
    name: organization.name,
    type: organization.type,
    status: organization.status,
    action: orgAction,
  };

  const branches = await prisma.organization_branches.findMany({
    where: { organization_id: organization.id, is_active: true },
    orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, code: true },
  });
  report.organization.branchCount = branches.length;
  report.organization.branchIds = branches.map((b) => b.id);

  const settings = {
    shortDescription: SHORT_DESCRIPTION,
    expectedSessions: 2,
    targetAudience:
      'متدربو مؤسسة ولي العهد، الباحثون عن عمل، حديثو التخرج، والمتقدمون إلى فرص التوظيف.',
    prerequisites: 'لا توجد متطلبات أو خبرات سابقة.',
    requiredMaterials: 'هاتف أو حاسوب متصل بالإنترنت.',
    enrollment: {
      institutionTraineesOnly: true,
      approvalRequired: true,
      publicRegistration: false,
      invitationAllowed: true,
    },
    certificateEnabled: true,
    preTestBlocksContent: true,
    branchScope: 'ALL_ACTIVE',
    branchIds: branches.map((b) => b.id),
    timezone: 'Asia/Amman',
  };

  const preparedQuestions = PRE_QUESTIONS.map((q, i) => {
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Question ${i + 1} must have exactly 4 options`);
    }
    const correct = q.options[q.correctIndex];
    if (!correct) throw new Error(`Question ${i + 1} missing correct option`);
    return prepareQuestionForStorage(
      {
        question_text: q.prompt,
        question_type: 'multiple_choice',
        options: q.options,
        correct_answer: correct,
        points: 1,
      },
      i
    );
  });

  const result = await prisma.$transaction(async (tx) => {
    let program = await tx.training_programs.findUnique({ where: { code: COURSE_CODE } });
    const programData = {
      organization_id: organization.id,
      type: 'TRAINING_COURSE',
      code: COURSE_CODE,
      title: 'اجتياز مقابلات العمل',
      description: FULL_DESCRIPTION,
      field: 'المهارات الوظيفية والاستعداد لسوق العمل',
      objectives: OBJECTIVES.map((o, i) => `${i + 1}. ${o}`).join('\n'),
      outcomes: OUTCOMES.map((o, i) => `${i + 1}. ${o}`).join('\n'),
      level: 'مبتدئ إلى متوسط',
      language: 'العربية',
      delivery_mode: 'ONLINE',
      required_hours: 6,
      required_attendance_pct: 75,
      max_participants: 100,
      start_date: dateOnly('2026-08-02'),
      end_date: dateOnly('2026-08-03'),
      status: 'PUBLISHED',
      settings_json: settings,
      updated_at: new Date(),
    };

    if (program) {
      if (program.organization_id !== organization.id) {
        throw new Error(
          `Course code ${COURSE_CODE} belongs to another organization (${program.organization_id})`
        );
      }
      program = await tx.training_programs.update({
        where: { id: program.id },
        data: programData,
      });
    } else {
      program = await tx.training_programs.create({ data: programData });
    }

    let cohort = await tx.training_cohorts.findUnique({ where: { code: COHORT_CODE } });
    const cohortData = {
      program_id: program.id,
      organization_id: organization.id,
      code: COHORT_CODE,
      name: 'الدفعة الأولى – اجتياز مقابلات العمل',
      branch_id: null, // institution-wide
      start_date: dateOnly('2026-08-02'),
      end_date: dateOnly('2026-08-03'),
      capacity: 100,
      delivery_mode: 'ONLINE',
      // Schema has no ACTIVE; OPEN = open/active registration cohort.
      status: 'OPEN',
      updated_at: new Date(),
    };
    if (cohort) {
      if (cohort.program_id !== program.id) {
        throw new Error(`Cohort code ${COHORT_CODE} is linked to a different program`);
      }
      cohort = await tx.training_cohorts.update({
        where: { id: cohort.id },
        data: cohortData,
      });
    } else {
      cohort = await tx.training_cohorts.create({ data: cohortData });
    }

    let assessment = await tx.training_assessments.findUnique({ where: { code: ASSESSMENT_CODE } });
    const assessmentData = {
      program_id: program.id,
      kind: 'PRE_TEST',
      code: ASSESSMENT_CODE,
      title: 'الاختبار القبلي – اجتياز مقابلات العمل',
      instructions:
        'يتكون الاختبار من 20 سؤالًا من نوع الاختيار من متعدد حول موضوع اجتياز مقابلات العمل. اختر الإجابة التي تراها الأفضل والأصح. لكل سؤال إجابة صحيحة واحدة فقط.',
      duration_minutes: 20,
      max_attempts: 1,
      pass_score: null,
      opens_at: new Date('2026-08-02T09:00:00+03:00'),
      closes_at: new Date('2026-08-03T15:00:00+03:00'),
      shuffle_questions: false,
      show_results: true,
      is_published: true,
      updated_at: new Date(),
    };

    if (assessment) {
      if (assessment.program_id !== program.id || assessment.kind !== 'PRE_TEST') {
        throw new Error(`Assessment code ${ASSESSMENT_CODE} conflict with existing row`);
      }
      assessment = await tx.training_assessments.update({
        where: { id: assessment.id },
        data: assessmentData,
      });
    } else {
      const byKind = await tx.training_assessments.findUnique({
        where: { program_id_kind: { program_id: program.id, kind: 'PRE_TEST' } },
      });
      if (byKind) {
        assessment = await tx.training_assessments.update({
          where: { id: byKind.id },
          data: assessmentData,
        });
      } else {
        assessment = await tx.training_assessments.create({ data: assessmentData });
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

    return { program, cohort, assessment, finalQuestions, questionsAction, attemptCount };
  }, { maxWait: 20000, timeout: 120000 });

  await syncRequirements(result.program.id);

  const trainerCount = await prisma.training_trainer_assignments.count({
    where: {
      training_program_id: result.program.id,
      is_active: true,
      revoked_at: null,
    },
  });
  if (trainerCount === 0) {
    report.blockers.push({
      code: 'NO_TRAINER_ASSIGNED',
      message: 'لم يتم تعيين مدرب بعد',
    });
  }

  // Validate questions
  const qRows = result.finalQuestions;
  const optionCounts = qRows.map((q) => (Array.isArray(q.options_json) ? q.options_json.length : 0));
  const allFour = optionCounts.every((n) => n === 4);
  const oneCorrect = qRows.every((q) => {
    const opts = q.options_json;
    const ca = q.correct_answer;
    return Array.isArray(opts) && opts.filter((o) => o === ca).length === 1;
  });
  const totalPoints = qRows.reduce((s, q) => s + Number(q.points || 0), 0);

  report.course = {
    id: result.program.id,
    code: result.program.code,
    title: result.program.title,
    status: result.program.status,
    type: result.program.type,
    startDate: result.program.start_date,
    endDate: result.program.end_date,
    branchScope: 'ALL_ACTIVE',
    trainerCount,
  };
  report.cohort = {
    id: result.cohort.id,
    code: result.cohort.code,
    name: result.cohort.name,
    status: result.cohort.status,
    statusNote: 'Schema has no ACTIVE; stored as OPEN',
    deliveryMode: result.cohort.delivery_mode,
    capacity: result.cohort.capacity,
  };
  report.assessment = {
    id: result.assessment.id,
    code: result.assessment.code,
    kind: result.assessment.kind,
    isPublished: result.assessment.is_published,
    durationMinutes: result.assessment.duration_minutes,
    maxAttempts: result.assessment.max_attempts,
    passScore: result.assessment.pass_score,
  };
  report.questions = {
    count: qRows.length,
    action: result.questionsAction,
    existingAttempts: result.attemptCount,
    totalPoints,
  };
  report.validation = {
    questionCountIs20: qRows.length === 20,
    everyQuestionHasFourOptions: allFour,
    everyQuestionHasOneCorrect: oneCorrect,
    totalScoreIs20: totalPoints === 20,
    programTypeTrainingCourse: result.program.type === 'TRAINING_COURSE',
    statusPublished: result.program.status === 'PUBLISHED',
    assessmentIsPreTest: result.assessment.kind === 'PRE_TEST',
  };

  try {
    await emitDomainEvent('COURSE_PUBLISHED', {
      organizationId: organization.id,
      entityType: 'training_program',
      entityId: result.program.id,
      templateVars: { course_title: result.program.title },
    });
    report.notifications.push('COURSE_PUBLISHED');
  } catch {
    report.notifications.push('COURSE_PUBLISHED:failed');
  }
  try {
    await emitDomainEvent('PRE_TEST_AVAILABLE', {
      organizationId: organization.id,
      entityType: 'training_assessment',
      entityId: result.assessment.id,
      templateVars: { assessment_title: result.assessment.title, course_title: result.program.title },
    });
    report.notifications.push('PRE_TEST_AVAILABLE');
  } catch {
    report.notifications.push('PRE_TEST_AVAILABLE:failed');
  }
  try {
    await emitDomainEvent('PRE_TEST_PUBLISHED', {
      organizationId: organization.id,
      entityType: 'training_assessment',
      entityId: result.assessment.id,
      templateVars: { assessment_title: result.assessment.title },
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

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
