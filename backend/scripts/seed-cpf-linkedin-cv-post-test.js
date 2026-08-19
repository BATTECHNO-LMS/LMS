'use strict';

/**
 * Idempotent seed: advanced LinkedIn & skills-marketing POST_TEST
 * for CPF-LINKEDIN-CV-2026 (مؤسسة ولي العهد).
 *
 * Does not create a duplicate course or modify CPF-LINKEDIN-CV-2026-PRE.
 *
 * Run: node scripts/seed-cpf-linkedin-cv-post-test.js
 *      npm run seed:cpf-linkedin-cv-post-test
 */

const { prisma } = require('../src/config/db');
const { emitDomainEvent } = require('../src/modules/notificationEngine');
const { recordAudit } = require('../src/shared/services/audit.service');
const { prepareQuestionForStorage } = require('../src/modules/fieldTraining/fieldTraining.assessmentQuestions');

const ORG_CODE = 'CROWN_PRINCE_FOUNDATION';
const ORG_NAME_AR = 'مؤسسة ولي العهد';
const COURSE_CODE = 'CPF-LINKEDIN-CV-2026';
const COURSE_TITLE_AR = 'LinkedIn وكتابة السيرة الذاتية CV';
const PRE_ASSESSMENT_CODE = 'CPF-LINKEDIN-CV-2026-PRE';
const ASSESSMENT_CODE = 'CPF-LINKEDIN-CV-2026-POST';
const ASSESSMENT_TITLE = 'الامتحان البعدي المتقدم – LinkedIn وتسويق المهارات';
const INSTRUCTIONS =
  'يتكون الامتحان البعدي من 25 سؤالًا متقدمًا في LinkedIn وتسويق المهارات. اختر الإجابة الأصح، وليس فقط الإجابة التي تبدو صحيحة. لكل سؤال إجابة واحدة معتمدة.';

/** Spec answer key: question number (1-based) → A|B|C|D */
const ANSWER_KEY = {
  1: 'B',
  2: 'A',
  3: 'C',
  4: 'C',
  5: 'C',
  6: 'B',
  7: 'C',
  8: 'B',
  9: 'B',
  10: 'C',
  11: 'B',
  12: 'C',
  13: 'C',
  14: 'B',
  15: 'B',
  16: 'C',
  17: 'B',
  18: 'C',
  19: 'B',
  20: 'B',
  21: 'C',
  22: 'A',
  23: 'A',
  24: 'B',
  25: 'B',
};

const LETTER_TO_INDEX = { A: 0, B: 1, C: 2, D: 3 };

/**
 * Admin notes are seed documentation only — the shared engine has no trainee-facing explanation field.
 * @type {{ prompt: string, options: [string, string, string, string], correctLetter: 'A'|'B'|'C'|'D' }[]}
 */
const POST_QUESTIONS = [
  {
    prompt: 'شخص لديه ملف LinkedIn جيد، لكنه لا يظهر كثيرًا في نتائج البحث. ما الخطوة الأولى الأفضل؟',
    options: ['زيادة النشر', 'تحسين الكلمات المفتاحية', 'إضافة اتصالات جديدة', 'طلب توصيات أكثر'],
    correctLetter: 'B',
  },
  {
    prompt: 'أي عنوان مهني يخدم شخصًا يبحث عن وظيفة Data Analyst بشكل أفضل؟',
    options: [
      'Data Analyst | SQL | Power BI',
      'Data Analyst Looking for Opportunities',
      'Data Professional | Analytics & Reporting',
      'Business Graduate | Data Enthusiast',
    ],
    correctLetter: 'A',
  },
  {
    prompt: 'أحمد نشر مشروعًا ممتازًا على LinkedIn. ما الذي يزيد قيمته المهنية أكثر؟',
    options: ['إضافة صورة للمشروع', 'شرح الأدوات المستخدمة', 'توضيح المشكلة والنتيجة', 'إضافة عدد ساعات العمل'],
    correctLetter: 'C',
  },
  {
    prompt: 'لديك خبرة قديمة لا ترتبط مباشرة بوظيفتك المستهدفة. الأفضل:',
    options: [
      'حذفها بالكامل',
      'الاحتفاظ بها كما هي',
      'إعادة صياغة الجوانب المرتبطة بالمسار',
      'وضعها في قسم المهارات',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'أي منشور يعتبر أقوى في بناء Personal Brand؟',
    options: ['نصائح عامة في المجال', 'قصة نجاح شخصية', 'تحليل مشكلة مع حل عملي', 'مشاركة شهادة جديدة'],
    correctLetter: 'C',
  },
  {
    prompt: 'موظف يريد الانتقال من خدمة العملاء إلى التسويق. ما الاستراتيجية الأذكى؟',
    options: [
      'إخفاء خبرته السابقة',
      'التركيز على مهارات التواصل والعميل',
      'تغيير المسمى الوظيفي القديم',
      'إضافة دورات تسويق فقط',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'وصلت منشوراتك إلى جمهور كبير، لكن لم تحصل على فرص. ما المؤشر الذي تفحصه أولًا؟',
    options: ['عدد الإعجابات', 'توقيت النشر', 'نوعية الجمهور', 'عدد الهاشتاغات'],
    correctLetter: 'C',
  },
  {
    prompt: 'أي تصرف يعتبر Networking جيدًا، لكن ليس الأفضل؟',
    options: [
      'التفاعل مع منشورات شخص مستهدف',
      'إرسال رسالة مرتبطة باهتمام مشترك',
      'طلب اتصال مع رسالة مخصصة',
      'طلب فرصة مباشرة بعد قبول الاتصال',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'شخص لديه شهادات كثيرة لكنه لا يحصل على مقابلات. ماذا يحتاج غالبًا؟',
    options: ['شهادات إضافية', 'مشاريع وأدلة عملية', 'زيادة عدد المتابعين', 'نشر يومي مستمر'],
    correctLetter: 'B',
  },
  {
    prompt: 'أي وصف خبرة يعتبر الأكثر إقناعًا؟',
    options: [
      'Managed marketing campaigns',
      'Worked on marketing campaigns',
      'Improved campaign conversions by 18%',
      'Responsible for digital marketing',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'عند كتابة About، ما الأولوية؟',
    options: [
      'سرد التاريخ الدراسي',
      'توضيح القيمة والتخصص',
      'كتابة جميع المهارات',
      'استخدام لغة رسمية جدًا',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'شخص يريد جذب عملاء Freelance. أي جملة تخدمه أكثر؟',
    options: [
      'Graphic Designer with 4 years of experience',
      'Professional Graphic Designer',
      'I create visual identities for startups',
      'Expert in Photoshop and Illustrator',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'أي سلوك قد يزيد عدد الاتصالات لكنه يضعف جودة الشبكة؟',
    options: [
      'التواصل مع زملاء المجال',
      'قبول الأشخاص ذوي الصلة',
      'إرسال طلبات عشوائية بكثرة',
      'متابعة أصحاب الشركات',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'عند تقييم نجاح منشور، أي مؤشر قد يكون أكثر قيمة من عدد الإعجابات؟',
    options: ['عدد الانطباعات', 'زيارات الملف', 'طول المنشور', 'عدد الصور'],
    correctLetter: 'B',
  },
  {
    prompt: 'منشور حصل على 500 إعجاب، وآخر على 40 إعجاب و3 رسائل من عملاء محتملين. أيهما أنجح؟',
    options: [
      'الأول لأن التفاعل أعلى',
      'الثاني لأن التحويل أفضل',
      'كلاهما متساويان',
      'لا يمكن المقارنة',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'ما أفضل طريقة لإثبات مهارة إدارة المشاريع؟',
    options: [
      'كتابة Project Management في Skills',
      'إضافة شهادة إدارة مشاريع',
      'عرض مشروع مع دورك ونتائجه',
      'نشر محتوى عن الإدارة',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'شخص ينشر في البرمجة والتصميم والتسويق والموارد البشرية بالتساوي. المشكلة الرئيسية هي:',
    options: ['قلة المحتوى', 'ضعف التخصص', 'ضعف اللغة', 'كثرة المنشورات'],
    correctLetter: 'B',
  },
  {
    prompt: 'لديك مقابلة بعد أسبوع. أي تحسين LinkedIn أكثر أولوية؟',
    options: [
      'تغيير صورة الغلاف',
      'رفع عدد الاتصالات',
      'تحديث الخبرات والمشاريع',
      'نشر خمسة منشورات',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'أي بداية رسالة Networking تعتبر جيدة، لكن هناك خيار أفضل منها؟',
    options: [
      'مرحبًا، سعدت بالتواصل معك',
      'مرحبًا، تابعت مشروعكم الأخير وكان لافتًا',
      'لدي خبرة وأبحث عن فرصة',
      'هل يوجد لديكم شاغر حاليًا؟',
    ],
    correctLetter: 'B',
  },
  {
    prompt:
      'شخص لديه مهارات ممتازة لكن ملفه يستخدم كلمات مثل "Creative, Motivated, Hard Worker" فقط. المشكلة؟',
    options: [
      'الكلمات خاطئة',
      'الكلمات عامة وغير مثبتة',
      'الكلمات غير رسمية',
      'الكلمات قصيرة جدًا',
    ],
    correctLetter: 'B',
  },
  {
    prompt: 'أي استراتيجية محتوى أقوى لبناء سلطة مهنية؟',
    options: [
      'نشر الأخبار أولًا بأول',
      'إعادة مشاركة خبراء المجال',
      'تقديم رأي وتحليل مدعوم',
      'نشر شهادات الإنجاز',
    ],
    correctLetter: 'C',
  },
  {
    prompt: 'إذا أردت من مسؤول التوظيف فهم قيمتك خلال ثوانٍ، أين يجب أن تكون رسالتك أوضح؟',
    options: ['Headline', 'Recommendations', 'Education', 'Interests'],
    correctLetter: 'A',
  },
  {
    prompt: 'أي خيار يعتبر صحيحًا، لكن الأقل قوة في تسويق المهارة؟',
    options: [
      'إضافة المهارة للقائمة',
      'عرض مشروع يستخدم المهارة',
      'إظهار نتيجة تحققت بها',
      'الحصول على توصية بشأنها',
    ],
    correctLetter: 'A',
  },
  {
    prompt: 'شخص حصل على 10,000 متابع، لكنه لا يحصل على فرص مهنية مناسبة. ما التفسير الأكثر دقة؟',
    options: [
      'عدد المتابعين غير مهم نهائيًا',
      'الجمهور لا يتوافق مع هدفه',
      'LinkedIn لا يساعد في التوظيف',
      'يجب أن يصل إلى 20,000 متابع',
    ],
    correctLetter: 'B',
  },
  {
    prompt:
      'لديك خياران لتسويق نفسك:\n\nالأول: تقول إنك خبير.\nالثاني: تعرض مشكلة حقيقية، كيف تعاملت معها، وما النتيجة.\n\nما الأقوى؟',
    options: [
      'الأول لأنه مباشر',
      'الثاني لأنه يقدم إثباتًا',
      'الأول إذا كان الملف جديدًا',
      'كلاهما بنفس القوة',
    ],
    correctLetter: 'B',
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
  if (POST_QUESTIONS.length !== 25) {
    throw new Error(`Expected 25 post-test questions, got ${POST_QUESTIONS.length}`);
  }
  if (Object.keys(ANSWER_KEY).length !== 25) {
    throw new Error(`Expected 25 answer-key entries, got ${Object.keys(ANSWER_KEY).length}`);
  }
  if (ANSWER_KEY[8] !== 'B') throw new Error('Q8 must be B');
  if (ANSWER_KEY[23] !== 'A') throw new Error('Q23 must be A');
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
    throw new Error(`Course ${COURSE_CODE} not found. Run npm run seed:cpf-linkedin-cv first.`);
  }
  if (matches.length > 1) {
    throw new Error(`COURSE_CODE_CONFLICT: ${COURSE_CODE} matched ${matches.length} programs; aborting.`);
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
  if (program.title !== COURSE_TITLE_AR) {
    throw new Error(`Course title mismatch: expected ${COURSE_TITLE_AR}, got ${program.title}`);
  }
  if (org.name !== ORG_NAME_AR && !String(org.name || '').includes('ولي العهد')) {
    throw new Error(`Organization name mismatch: expected ${ORG_NAME_AR}, got ${org.name}`);
  }
  return { program, organization: org };
}

function calendarDateInUtc(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDayAsiaAmman(value) {
  const iso = calendarDateInUtc(value);
  return iso ? new Date(`${iso}T00:00:00+03:00`) : null;
}

function endOfDayAsiaAmman(value) {
  const iso = calendarDateInUtc(value);
  return iso ? new Date(`${iso}T23:59:59+03:00`) : null;
}

/**
 * Use stored course / cohort / session timing only. Never invent dates.
 * Date-only program/cohort fields are interpreted as the full Jordan day.
 */
async function deriveAvailability(program) {
  if (program.start_date || program.end_date) {
    return {
      opens_at: program.start_date ? startOfDayAsiaAmman(program.start_date) : null,
      closes_at: program.end_date ? endOfDayAsiaAmman(program.end_date) : null,
      source: 'program_dates',
    };
  }

  const sessions = await prisma.training_sessions.findMany({
    where: { training_cohorts: { program_id: program.id } },
    select: { starts_at: true, ends_at: true },
    orderBy: { starts_at: 'asc' },
  });
  if (sessions.length) {
    const starts = sessions.map((s) => s.starts_at).filter(Boolean);
    const ends = sessions.map((s) => s.ends_at).filter(Boolean);
    return {
      opens_at: starts.length ? starts[0] : null,
      closes_at: ends.length ? ends[ends.length - 1] : null,
      source: 'sessions',
    };
  }

  const cohorts = await prisma.training_cohorts.findMany({
    where: { program_id: program.id },
    select: { start_date: true, end_date: true },
  });
  const cohortStarts = cohorts.map((c) => c.start_date).filter(Boolean);
  const cohortEnds = cohorts.map((c) => c.end_date).filter(Boolean);
  if (cohortStarts.length || cohortEnds.length) {
    cohortStarts.sort((a, b) => a - b);
    cohortEnds.sort((a, b) => a - b);
    return {
      opens_at: cohortStarts[0] ? startOfDayAsiaAmman(cohortStarts[0]) : null,
      closes_at: cohortEnds[cohortEnds.length - 1]
        ? endOfDayAsiaAmman(cohortEnds[cohortEnds.length - 1])
        : null,
      source: 'cohorts',
    };
  }

  return { opens_at: null, closes_at: null, source: 'publish_status' };
}

async function syncPostTestRequirement(programId) {
  await prisma.training_requirements.upsert({
    where: { program_id_code: { program_id: programId, code: 'POST_TEST' } },
    create: {
      program_id: programId,
      code: 'POST_TEST',
      label: 'الاختبار البعدي',
      is_required: true,
      threshold_json: {
        pass_score: 70,
        passing_required: true,
        require_submission: true,
      },
      sort_order: 1,
    },
    update: {
      is_required: true,
      label: 'الاختبار البعدي',
      threshold_json: {
        pass_score: 70,
        passing_required: true,
        require_submission: true,
      },
      sort_order: 1,
      updated_at: new Date(),
    },
  });
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
    availability: null,
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
    include: {
      _count: { select: { training_assessment_questions: true, training_assessment_attempts: true } },
    },
  });
  if (!preAssessment || preAssessment.program_id !== program.id) {
    throw new Error(
      `Pre-test ${PRE_ASSESSMENT_CODE} not found on course ${COURSE_CODE}; aborting to avoid orphan post-test.`
    );
  }
  report.preTestPreserved = {
    id: preAssessment.id,
    code: preAssessment.code,
    kind: preAssessment.kind,
    questionCount: preAssessment._count.training_assessment_questions,
    attemptCount: preAssessment._count.training_assessment_attempts,
    durationMinutes: preAssessment.duration_minutes,
    passScore: preAssessment.pass_score != null ? Number(preAssessment.pass_score) : null,
  };

  const availability = await deriveAvailability(program);
  report.availability = availability;

  const result = await prisma.$transaction(
    async (tx) => {
      let assessment = await tx.training_assessments.findUnique({ where: { code: ASSESSMENT_CODE } });
      const assessmentData = {
        program_id: program.id,
        kind: 'POST_TEST',
        code: ASSESSMENT_CODE,
        title: ASSESSMENT_TITLE,
        instructions: INSTRUCTIONS,
        duration_minutes: 30,
        max_attempts: 1,
        pass_score: 70,
        shuffle_questions: false,
        show_results: true,
        is_published: true,
        updated_at: new Date(),
      };
      if (availability.opens_at) assessmentData.opens_at = availability.opens_at;
      if (availability.closes_at) assessmentData.closes_at = availability.closes_at;

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
            throw new Error(`POST_TEST_CONFLICT: program already has POST_TEST with code ${byKind.code}`);
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

  await syncPostTestRequirement(program.id);
  report.requirementsUpdated = {
    requiresPostTest: true,
    postTestPassingRequired: true,
    postTestPassScore: 70,
  };

  const { computeAndPersistProgress } = require('../src/modules/trainingPrograms/trainingPrograms.service');
  const enrollmentsToRefresh = await prisma.training_enrollments.findMany({
    where: {
      training_cohorts: { program_id: program.id },
      status: { in: ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED'] },
    },
    select: { id: true },
  });
  let progressRecomputed = 0;
  for (const enrollment of enrollmentsToRefresh) {
    await computeAndPersistProgress(enrollment.id);
    progressRecomputed += 1;
  }
  report.progressRecomputed = progressRecomputed;

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
  const q8IsB =
    qRows[7] &&
    qRows[7].correct_answer === POST_QUESTIONS[7].options[LETTER_TO_INDEX.B];
  const q23IsA =
    qRows[22] &&
    qRows[22].correct_answer === POST_QUESTIONS[22].options[LETTER_TO_INDEX.A];

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
    q8IsB,
    q23IsA,
    key: ANSWER_KEY,
  };
  report.validation = {
    questionCountIs25: qRows.length === 25,
    everyQuestionHasFourOptions: allFour,
    everyQuestionHasOneCorrect: oneCorrect,
    totalScoreIs25: totalPoints === 25,
    passScoreIs70: Number(result.assessment.pass_score) === 70,
    durationIs30: result.assessment.duration_minutes === 30,
    maxAttemptsIs1: result.assessment.max_attempts === 1,
    kindIsPostTest: result.assessment.kind === 'POST_TEST',
    isPublished: result.assessment.is_published === true,
    linkedToCourse: result.assessment.program_id === program.id,
    answerKeyMatchesSpec: answerKeyMatches,
    q8IsB: Boolean(q8IsB),
    q23IsA: Boolean(q23IsA),
    preTestUntouched:
      report.preTestPreserved.kind === 'PRE_TEST' && report.preTestPreserved.questionCount === 20,
    didNotInventAvailability: availability.source !== 'invented',
  };

  try {
    await recordAudit({
      organizationId: organization.id,
      actionType:
        result.assessmentAction === 'created' ? 'training_assessment.create' : 'training_assessment.update',
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
  ORG_NAME_AR,
  COURSE_CODE,
  COURSE_TITLE_AR,
  PRE_ASSESSMENT_CODE,
  ASSESSMENT_CODE,
  ASSESSMENT_TITLE,
  INSTRUCTIONS,
  ANSWER_KEY,
  POST_QUESTIONS,
  LETTER_TO_INDEX,
  validateSpecLocally,
  prepareQuestions,
  questionsSignature,
  deriveAvailability,
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
