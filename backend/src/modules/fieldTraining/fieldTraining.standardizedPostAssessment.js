'use strict';

/**
 * Standardized field-training post-assessment (full-stack web, 2026 v1).
 * Idempotent per opportunity via unique (opportunity_id, type=post) plus template_id in description.
 */

const { prisma } = require('../../config/db');
const { ApiError } = require('../../utils/apiError');
const ftNotify = require('./fieldTraining.notifications');
const workflow = require('./fieldTraining.workflow');
const {
  prepareQuestionForStorage,
  validateAssessmentQuestions,
  normalizeCorrectAnswer,
  gradeAnswers,
} = require('./fieldTraining.assessmentQuestions');
const { STANDARDIZED_POST_QUESTIONS } = require('./fieldTraining.standardizedPostAssessment.questions');

const TEMPLATE_ID = 'FIELD_TRAINING_POST_ASSESSMENT_FULLSTACK_2026_V1';
const ASSESSMENT_TITLE = 'التقييم البعدي للتدريب الميداني – تطوير الويب';
const DESCRIPTION_BODY =
  'تقييم بعدي لقياس المعارف والمهارات التي اكتسبها الطالب في تطوير الواجهات الأمامية، وتطوير الأنظمة الخلفية، وقواعد البيانات خلال فترة التدريب الميداني.';
const STUDENT_INSTRUCTIONS =
  'يتكون التقييم من 25 سؤال اختيار من متعدد، ولكل سؤال إجابة صحيحة واحدة. مدة التقييم 40 دقيقة ومحاولة واحدة فقط. يجب الإجابة عن جميع الأسئلة قبل التسليم. احرص على ثبات اتصال الإنترنت وعدم إغلاق الصفحة أثناء التقييم. يتم حفظ الإجابات تلقائيًا، وتظهر العلامة النهائية بعد التسليم.';
const OBJECTIVES = Object.freeze([
  'قياس مدى استيعاب الطالب لمفاهيم تطوير الويب الحديثة.',
  'تقييم قدرة الطالب على التمييز بين مسؤوليات الواجهة الأمامية والخلفية.',
  'قياس فهم الطالب لآلية عمل واجهات API والطلبات والاستجابات.',
  'تقييم معرفة الطالب بأساسيات قواعد البيانات وتصميمها والاستعلام منها.',
  'قياس قدرة الطالب على تطبيق المفاهيم التقنية في مواقف عملية.',
]);
const LEARNING_OUTCOMES = Object.freeze([
  'يميز الطالب بين مكونات Frontend وBackend وDatabase.',
  'يفهم الطالب آلية عمل HTTP وREST APIs.',
  'يختار الطالب الأدوات والحلول المناسبة للمشكلات البرمجية الأساسية.',
  'يكتب ويفهم الاستعلامات والمفاهيم الأساسية في SQL.',
  'يطبق الطالب مبادئ التحقق من البيانات والأمان وجودة الكود.',
]);

const TIMEZONE = 'Asia/Amman';
/** Open immediately for trainees (Asia/Amman). */
const OPENS_AT = '2026-08-29T00:00:00+03:00';
const CLOSES_AT = null;
const DURATION_MINUTES = 40;
const MAX_ATTEMPTS = 1;
const PASSING_SCORE = 60;
const TOTAL_GRADE = 100;
const QUESTION_POINTS = 4;
const QUESTION_COUNT = 25;

const OPTION_LETTERS_AR = Object.freeze(['أ', 'ب', 'ج', 'د']);
const TOPIC_LABEL_AR = Object.freeze({
  frontend: 'الواجهة الأمامية (Frontend)',
  backend: 'الأنظمة الخلفية (Backend)',
  database: 'قواعد البيانات (Database)',
});
const DIFFICULTY_LABEL_AR = Object.freeze({
  basic: 'أساسي',
  intermediate: 'متوسط',
  advanced: 'متقدم',
});
const REQUIRED_POSITION_COUNTS = Object.freeze([7, 6, 6, 6]);
const SKIP_OPPORTUNITY_STATUSES = new Set(['archived']);

const ATTEMPT_STATUS = Object.freeze({
  not_started: { key: 'not_started', label_ar: 'لم يبدأ' },
  in_progress: { key: 'in_progress', label_ar: 'قيد التقديم' },
  submitted: { key: 'submitted', label_ar: 'تم التسليم' },
  graded: { key: 'graded', label_ar: 'تم التصحيح' },
});

function buildSettingsPayload() {
  return {
    template_id: TEMPLATE_ID,
    category: 'Field Training',
    kind: 'POST_ASSESSMENT',
    language: 'ar',
    timezone: TIMEZONE,
    opens_at: OPENS_AT,
    closes_at: CLOSES_AT,
    duration_minutes: DURATION_MINUTES,
    max_attempts: MAX_ATTEMPTS,
    shuffle_questions: true,
    shuffle_options: true,
    show_score_after_submit: true,
    reveal_correct_answers: false,
    auto_grade: true,
    require_all_answers: true,
    total_grade: TOTAL_GRADE,
    passing_score: PASSING_SCORE,
    body: DESCRIPTION_BODY,
    objectives: [...OBJECTIVES],
    learning_outcomes: [...LEARNING_OUTCOMES],
    student_instructions: STUDENT_INSTRUCTIONS,
  };
}

function serializeDescription() {
  return JSON.stringify(buildSettingsPayload());
}

function parseAssessmentDescription(description) {
  if (!description || typeof description !== 'string') {
    return { body: description ?? null, settings: null };
  }
  const trimmed = description.trim();
  if (!trimmed.startsWith('{')) return { body: description, settings: null };
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.template_id) {
      return { body: description, settings: null };
    }
    return {
      body: parsed.body || parsed.description || null,
      settings: parsed,
    };
  } catch {
    return { body: description, settings: null };
  }
}

function publicSettings(settings) {
  if (!settings) return null;
  return {
    template_id: settings.template_id || null,
    category: settings.category || null,
    kind: settings.kind || null,
    language: settings.language || 'ar',
    timezone: settings.timezone || TIMEZONE,
    opens_at: settings.opens_at || null,
    closes_at: settings.closes_at || null,
    duration_minutes: settings.duration_minutes != null ? Number(settings.duration_minutes) : null,
    max_attempts: settings.max_attempts != null ? Number(settings.max_attempts) : null,
    shuffle_questions: settings.shuffle_questions === true,
    shuffle_options: settings.shuffle_options === true,
    show_score_after_submit: settings.show_score_after_submit !== false,
    reveal_correct_answers: settings.reveal_correct_answers === true,
    auto_grade: settings.auto_grade !== false,
    require_all_answers: settings.require_all_answers !== false,
    total_grade: settings.total_grade != null ? Number(settings.total_grade) : null,
    passing_score: settings.passing_score != null ? Number(settings.passing_score) : null,
  };
}

function hashSeed(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleCopy(items, rng) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function shuffleQuestionsForStudent(questions, { studentId, assessmentId, shuffleQuestions, shuffleOptions }) {
  const list = sanitizeStudentQuestions(Array.isArray(questions) ? questions : []);
  if (!list.length) return list;
  const qRng = mulberry32(hashSeed(`${studentId}|${assessmentId}|questions`));
  const ordered = shuffleQuestions ? shuffleCopy(list, qRng) : list;
  return ordered.map((question) => {
    if (!shuffleOptions || !Array.isArray(question.options) || question.options.length < 2) {
      return question;
    }
    const oRng = mulberry32(hashSeed(`${studentId}|${assessmentId}|options|${question.id || question.question_text}`));
    return { ...question, options: shuffleCopy(question.options, oRng) };
  });
}

function sanitizeStudentQuestion(question) {
  if (!question || typeof question !== 'object') return question;
  const options = Array.isArray(question.options)
    ? question.options.map((opt) => {
        if (opt && typeof opt === 'object') return String(opt.text ?? opt.label ?? opt.value ?? '').trim();
        return String(opt ?? '').trim();
      }).filter(Boolean)
    : question.options;
  return {
    id: question.id,
    assessment_id: question.assessment_id,
    question_text: question.question_text,
    question_type: question.question_type === 'short_answer' ? 'short_text' : question.question_type,
    options,
    points: question.points != null ? Number(question.points) : 1,
    is_required: question.is_required !== false,
    sort_order: question.sort_order,
  };
}

function sanitizeStudentQuestions(questions) {
  return (questions || []).map(sanitizeStudentQuestion);
}

function studentPayloadLeaksAnswers(questions) {
  const blob = JSON.stringify(questions || []);
  return /correct_answer|isCorrect|explanation|_correctIndex/.test(blob);
}

function resolveAttemptStatus(attempt, fallbackScore = null) {
  if (attempt?.submitted_at) {
    const details = attempt.grading_details;
    const pending =
      Array.isArray(details) && details.some((row) => row?.gradingStatus === 'pending_manual');
    return pending ? ATTEMPT_STATUS.submitted : ATTEMPT_STATUS.graded;
  }
  if (attempt) return ATTEMPT_STATUS.in_progress;
  if (fallbackScore != null && fallbackScore !== '') return ATTEMPT_STATUS.graded;
  return ATTEMPT_STATUS.not_started;
}

function remainingSeconds(startedAt, durationMinutes, now = new Date()) {
  if (!startedAt || durationMinutes == null) return null;
  const durationMs = Number(durationMinutes) * 60 * 1000;
  const elapsed = now.getTime() - new Date(startedAt).getTime();
  return Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
}

function assertAssessmentWindow(settings, now = new Date()) {
  if (!settings) return;
  if (settings.opens_at) {
    const opens = new Date(settings.opens_at);
    if (!Number.isNaN(opens.getTime()) && now < opens) {
      throw new ApiError(403, 'التقييم لم يبدأ بعد');
    }
  }
  if (settings.closes_at) {
    const closes = new Date(settings.closes_at);
    if (!Number.isNaN(closes.getTime()) && now > closes) {
      throw new ApiError(403, 'انتهت فترة التقييم');
    }
  }
}

function toStorageQuestions() {
  return STANDARDIZED_POST_QUESTIONS.map((row, index) => {
    const { topic, difficulty, _correctIndex, ...rest } = row;
    return prepareQuestionForStorage(rest, index);
  });
}

function validateStandardizedBank() {
  const forbidden = /جميع ما سبق|لا شيء مما سبق/;
  const questions = STANDARDIZED_POST_QUESTIONS;
  if (questions.length !== QUESTION_COUNT) {
    return `يجب أن يحتوي التقييم على ${QUESTION_COUNT} سؤالًا.`;
  }
  const texts = new Set();
  const topicCounts = { frontend: 0, backend: 0, database: 0 };
  const difficultyCounts = { basic: 0, intermediate: 0, advanced: 0 };
  const positionCounts = [0, 0, 0, 0];
  let points = 0;

  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const n = i + 1;
    if (texts.has(q.question_text)) return `السؤال ${n}: مكرر.`;
    texts.add(q.question_text);
    if (forbidden.test(q.question_text) || (q.options || []).some((opt) => forbidden.test(String(opt)))) {
      return `السؤال ${n}: صيغة خيارات غير مسموحة.`;
    }
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      return `السؤال ${n}: يجب أن يحتوي على أربعة خيارات.`;
    }
    const uniqueOpts = new Set(q.options.map((opt) => String(opt).trim()));
    if (uniqueOpts.size !== 4) return `السؤال ${n}: الخيارات غير فريدة.`;
    const answer = q.correct_answer?.answer;
    if (!answer || !q.options.includes(answer)) {
      return `السؤال ${n}: حدد إجابة صحيحة واحدة من الخيارات.`;
    }
    const correctIndexes = q.options.filter((opt) => opt === answer);
    if (correctIndexes.length !== 1) return `السؤال ${n}: أكثر من إجابة صحيحة.`;
    if (Number(q.points) !== QUESTION_POINTS) return `السؤال ${n}: العلامة يجب أن تكون ${QUESTION_POINTS}.`;
    if (q.is_required === false) return `السؤال ${n}: يجب أن يكون إجباريًا.`;
    if (!q.correct_answer?.explanation) return `السؤال ${n}: أضف شرحًا للمراجع.`;
    topicCounts[q.topic] = (topicCounts[q.topic] || 0) + 1;
    difficultyCounts[q.difficulty] = (difficultyCounts[q.difficulty] || 0) + 1;
    positionCounts[q._correctIndex] += 1;
    points += Number(q.points) || 0;
  }

  const generic = validateAssessmentQuestions(
    questions.map((row, i) => {
      const { topic, difficulty, _correctIndex, ...rest } = row;
      return { ...rest, sort_order: i };
    })
  );
  if (typeof generic === 'string') return generic;
  if (points !== TOTAL_GRADE) return `مجموع العلامات يجب أن يكون ${TOTAL_GRADE}.`;
  if (topicCounts.frontend !== 8 || topicCounts.backend !== 9 || topicCounts.database !== 8) {
    return 'توزيع المحاور غير مطابق (8 واجهة / 9 خلفية / 8 قواعد بيانات).';
  }
  if (
    difficultyCounts.basic !== 6 ||
    difficultyCounts.intermediate !== 13 ||
    difficultyCounts.advanced !== 6
  ) {
    return 'توزيع الصعوبة غير مطابق (6 أساسي / 13 متوسط / 6 متقدم).';
  }
  if (
    positionCounts[0] !== REQUIRED_POSITION_COUNTS[0] ||
    positionCounts[1] !== REQUIRED_POSITION_COUNTS[1] ||
    positionCounts[2] !== REQUIRED_POSITION_COUNTS[2] ||
    positionCounts[3] !== REQUIRED_POSITION_COUNTS[3]
  ) {
    return 'توزيع مواضع الإجابة الصحيحة يجب أن يكون 7 للأول و6 للثاني و6 للثالث و6 للرابع قبل الخلط.';
  }
  return { ok: true, totalPoints: points, questionCount: questions.length, positionCounts };
}

function bankMetaByText() {
  const map = new Map();
  for (const q of STANDARDIZED_POST_QUESTIONS) {
    map.set(q.question_text, q);
  }
  return map;
}

function validateStoredAssessmentCopy(rows) {
  if (!Array.isArray(rows) || rows.length !== QUESTION_COUNT) {
    return `يجب أن يحتوي التقييم المنشور على ${QUESTION_COUNT} سؤالًا محفوظًا.`;
  }
  const texts = new Set();
  const topicCounts = { frontend: 0, backend: 0, database: 0 };
  let points = 0;
  const metaByText = bankMetaByText();

  for (let i = 0; i < rows.length; i += 1) {
    const q = rows[i];
    const n = i + 1;
    const text = String(q.question_text ?? '').trim();
    if (!text) return `السؤال ${n}: نص السؤال مفقود.`;
    if (texts.has(text)) return `السؤال ${n}: مكرر.`;
    texts.add(text);
    const options = Array.isArray(q.options) ? q.options.map((opt) => String(opt ?? '').trim()).filter(Boolean) : [];
    if (options.length !== 4) return `السؤال ${n}: يجب حفظ أربعة خيارات غير فارغة.`;
    if (new Set(options).size !== 4) return `السؤال ${n}: الخيارات غير فريدة.`;
    const answer = normalizeCorrectAnswer(q.question_type || 'multiple_choice', q.correct_answer, options);
    if (!answer) return `السؤال ${n}: لا توجد إجابة صحيحة محفوظة في correct_answer.`;
    if (!options.includes(answer)) return `السؤال ${n}: الإجابة الصحيحة المحفوظة لا تنتمي إلى خيارات السؤال.`;
    if (Number(q.points) !== QUESTION_POINTS) return `السؤال ${n}: العلامة يجب أن تكون ${QUESTION_POINTS}.`;
    points += Number(q.points) || 0;
    const meta = metaByText.get(text);
    if (!meta) return `السؤال ${n}: غير موجود في بنك التقييم المعياري.`;
    topicCounts[meta.topic] += 1;
  }

  if (points !== TOTAL_GRADE) return `مجموع العلامات المحفوظة يجب أن يكون ${TOTAL_GRADE}.`;
  if (topicCounts.frontend !== 8 || topicCounts.backend !== 9 || topicCounts.database !== 8) {
    return 'توزيع المحاور المحفوظ غير مطابق (8 واجهة / 9 خلفية / 8 قواعد بيانات).';
  }

  const studentView = sanitizeStudentQuestions(rows);
  if (studentPayloadLeaksAnswers(studentView)) {
    return 'حمولة الطالب تسرب الإجابة الصحيحة أو الشرح الداخلي.';
  }
  return { ok: true, totalPoints: points, questionCount: rows.length };
}

function withQuestionIds(questions) {
  return (questions || []).map((q, i) => ({ ...q, id: q.id || `q-${i}` }));
}

function buildCorrectAnswerMap(questions) {
  const answers = {};
  for (const q of questions) {
    answers[q.id] = normalizeCorrectAnswer(q.question_type, q.correct_answer, q.options);
  }
  return answers;
}

function verifyAutomaticGrading(rawQuestions) {
  const questions = withQuestionIds(rawQuestions);
  const correctMap = buildCorrectAnswerMap(questions);
  const ids = questions.map((q) => q.id);

  function scoreSelecting(count, extra = {}) {
    const answers = {};
    ids.forEach((id, i) => {
      if (i < count) answers[id] = correctMap[id];
      else if (extra.blank) answers[id] = '';
      else if (extra.invalid) answers[id] = '__invalid__';
      else {
        const opts = questions[i].options || [];
        answers[id] = opts.find((opt) => opt !== correctMap[id]) || '';
      }
    });
    return gradeAnswers(questions, answers);
  }

  const all = scoreSelecting(25);
  const twentyFour = scoreSelecting(24);
  const fifteen = scoreSelecting(15);
  const fourteen = scoreSelecting(14);
  const blanks = scoreSelecting(0, { blank: true });
  const invalids = scoreSelecting(0, { invalid: true });

  const shuffled = shuffleQuestionsForStudent(sanitizeStudentQuestions(questions), {
    studentId: 'verify-student',
    assessmentId: 'verify-assessment',
    shuffleQuestions: true,
    shuffleOptions: true,
  });
  if (studentPayloadLeaksAnswers(shuffled)) {
    return 'خلط الأسئلة سرّب الإجابة الصحيحة إلى حمولة الطالب.';
  }
  const shuffledAnswers = {};
  for (const sq of shuffled) {
    const original = questions.find((q) => q.id === sq.id);
    const correct = correctMap[sq.id];
    if (!sq.options.includes(correct)) {
      return `الخلط فقد خيار الإجابة الصحيحة للسؤال ${sq.id}.`;
    }
    shuffledAnswers[sq.id] = correct;
  }
  const shuffledGrade = gradeAnswers(questions, shuffledAnswers);

  const failures = [];
  if (all.scorePercent !== 100 || all.scorePoints !== 100) failures.push('25 إجابة صحيحة يجب أن تنتج 100/100.');
  if (twentyFour.scorePercent !== 96 || twentyFour.scorePoints !== 96) failures.push('24 إجابة صحيحة يجب أن تنتج 96/100.');
  if (fifteen.scorePercent !== 60 || fifteen.scorePoints !== 60) failures.push('15 إجابة صحيحة يجب أن تنتج 60/100.');
  if (fourteen.scorePercent !== 56 || fourteen.scorePoints !== 56) failures.push('14 إجابة صحيحة يجب أن تنتج 56/100.');
  if (blanks.scorePoints !== 0 || invalids.scorePoints !== 0) {
    failures.push('الخيار الفارغ أو غير الصالح يجب ألا يُحتسب صحيحًا.');
  }
  if (shuffledGrade.scorePercent !== 100) failures.push('الخلط كسر ربط الإجابة الصحيحة.');
  if (failures.length) return failures.join(' ');

  return {
    ok: true,
    allCorrect: all.scorePercent,
    twentyFourCorrect: twentyFour.scorePercent,
    fifteenCorrect: fifteen.scorePercent,
    fourteenCorrect: fourteen.scorePercent,
    passAtSixty: fifteen.scorePercent >= PASSING_SCORE,
    failAtFiftySix: fourteen.scorePercent < PASSING_SCORE,
    blankAndInvalidZero: true,
    shufflePreservesMapping: true,
  };
}

function buildAdminAnswerKey(questions = STANDARDIZED_POST_QUESTIONS) {
  return questions.map((q, index) => {
    const options = q.options || [];
    const answer = normalizeCorrectAnswer(q.question_type, q.correct_answer, options);
    const correctIndex = options.indexOf(answer);
    return {
      question_number: index + 1,
      question_text: q.question_text,
      options: options.map((text, i) => ({
        letter: OPTION_LETTERS_AR[i],
        text,
      })),
      correct_option: OPTION_LETTERS_AR[correctIndex] || null,
      correct_answer_text: answer,
      explanation: q.correct_answer?.explanation || q.explanation || null,
      topic: TOPIC_LABEL_AR[q.topic] || q.topic,
      difficulty: DIFFICULTY_LABEL_AR[q.difficulty] || q.difficulty,
    };
  });
}

function opportunityAttachable(opp) {
  if (!opp) return { ok: false, reason: 'missing' };
  if (SKIP_OPPORTUNITY_STATUSES.has(opp.status)) {
    return { ok: false, reason: `status:${opp.status}` };
  }
  return { ok: true };
}

async function countSubmittedAttempts(tx, assessmentId) {
  return tx.field_training_assessment_attempts.count({
    where: { assessment_id: assessmentId, submitted_at: { not: null } },
  });
}

async function syncStandardizedQuestions(tx, assessmentId, prepared) {
  const existing = await tx.field_training_assessment_questions.findMany({
    where: { assessment_id: assessmentId },
    orderBy: { sort_order: 'asc' },
  });
  const submittedCount = await countSubmittedAttempts(tx, assessmentId);

  if (submittedCount > 0) {
    if (existing.length !== prepared.length) {
      throw new Error('لا يمكن استبدال أسئلة تقييم توجد له محاولات مُسلَّمة.');
    }
    await Promise.all(
      prepared.map((q, i) =>
        tx.field_training_assessment_questions.update({
          where: { id: existing[i].id },
          data: {
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options ?? null,
            correct_answer: q.correct_answer ?? null,
            points: q.points ?? QUESTION_POINTS,
            is_required: q.is_required !== false,
            sort_order: q.sort_order ?? i,
            updated_at: new Date(),
          },
        })
      )
    );
    return { replaced: false, updatedInPlace: true };
  }

  await tx.field_training_assessment_questions.deleteMany({
    where: { assessment_id: assessmentId },
  });
  await tx.field_training_assessment_questions.createMany({
    data: prepared.map((q, i) => ({
      assessment_id: assessmentId,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options ?? null,
      correct_answer: q.correct_answer ?? null,
      points: q.points ?? QUESTION_POINTS,
      is_required: q.is_required !== false,
      sort_order: q.sort_order ?? i,
    })),
  });
  return { replaced: existing.length > 0, updatedInPlace: false };
}

async function eligibleStudentsForOpportunity(tx, opportunity) {
  const apps = await tx.field_training_applications.findMany({
    where: {
      opportunity_id: opportunity.id,
      status: 'approved',
      training_status: { not: 'expelled' },
      expelled_at: null,
    },
  });
  return apps.filter((app) => workflow.canTakePostAssessment(app, opportunity));
}

async function ensureStandardizedPostAssessmentForOpportunity(opportunity, options = {}) {
  const tx = options.tx || prisma;
  const notify = options.notify === true;
  const attach = opportunityAttachable(opportunity);
  if (!attach.ok) {
    return { action: 'skipped', reason: attach.reason, opportunityId: opportunity.id };
  }

  const bankCheck = validateStandardizedBank();
  if (typeof bankCheck === 'string') {
    throw new Error(bankCheck);
  }
  const prepared = toStorageQuestions();
  const gradingCheck = verifyAutomaticGrading(prepared);
  if (typeof gradingCheck === 'string') {
    throw new Error(gradingCheck);
  }
  const description = serializeDescription();

  const existing = await tx.field_training_assessments.findUnique({
    where: {
      opportunity_id_type: { opportunity_id: opportunity.id, type: 'post' },
    },
    include: {
      _count: { select: { field_training_assessment_questions: true, field_training_assessment_attempts: true } },
    },
  });

  const created = !existing;
  const assessment = await tx.field_training_assessments.upsert({
    where: {
      opportunity_id_type: { opportunity_id: opportunity.id, type: 'post' },
    },
    create: {
      opportunity_id: opportunity.id,
      type: 'post',
      title: ASSESSMENT_TITLE,
      description,
      passing_score: PASSING_SCORE,
      status: 'draft',
    },
    update: {
      title: ASSESSMENT_TITLE,
      description,
      passing_score: PASSING_SCORE,
      updated_at: new Date(),
    },
  });

  const sync = await syncStandardizedQuestions(tx, assessment.id, prepared);

  const questions = await tx.field_training_assessment_questions.findMany({
    where: { assessment_id: assessment.id },
    orderBy: { sort_order: 'asc' },
  });
  const storedCheck = validateStoredAssessmentCopy(questions);
  if (typeof storedCheck === 'string') {
    throw new Error(storedCheck);
  }

  await tx.field_training_assessments.update({
    where: { id: assessment.id },
    data: { status: 'published', updated_at: new Date() },
  });
  const totalPoints = questions.reduce((sum, q) => sum + (q.points != null ? Number(q.points) : 0), 0);

  let notified = 0;
  if (notify && ['published', 'in_progress'].includes(opportunity.status)) {
    const eligible = await eligibleStudentsForOpportunity(tx, opportunity);
    if (eligible.length) {
      const result = await ftNotify.notifyStudentsPostAssessmentAvailable({
        studentIds: eligible.map((row) => row.student_id),
        opportunityId: opportunity.id,
        opportunityTitle: opportunity.title,
      });
      notified = result?.created_count ?? 0;
    }
  }

  return {
    action: created ? 'created' : 'updated',
    opportunityId: opportunity.id,
    opportunityTitle: opportunity.title,
    opportunityStatus: opportunity.status,
    assessmentId: assessment.id,
    questionCount: questions.length,
    totalPoints,
    questionsReplaced: Boolean(sync.replaced),
    questionsUpdatedInPlace: Boolean(sync.updatedInPlace),
    questionsKeptReason: null,
    notified,
    gradingCheck,
    storedCheck,
    valid: storedCheck.ok === true,
  };
}

async function applyToAllOpportunities({ apply = false, notify = true } = {}) {
  const bankCheck = validateStandardizedBank();
  if (typeof bankCheck === 'string') {
    throw new Error(bankCheck);
  }
  const gradingCheck = verifyAutomaticGrading(toStorageQuestions());
  if (typeof gradingCheck === 'string') {
    throw new Error(gradingCheck);
  }

  const opportunities = await prisma.field_training_opportunities.findMany({
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      title: true,
      status: true,
      university_id: true,
      requires_post_assessment: true,
      field_training_assessments: {
        where: { type: 'post' },
        select: {
          id: true,
          status: true,
          title: true,
          description: true,
          _count: {
            select: {
              field_training_assessment_questions: true,
              field_training_assessment_attempts: true,
            },
          },
        },
      },
    },
  });

  const skipped = [];
  const targets = [];
  for (const opp of opportunities) {
    const attach = opportunityAttachable(opp);
    if (!attach.ok) {
      skipped.push({
        opportunityId: opp.id,
        opportunityTitle: opp.title,
        reason: attach.reason,
      });
      continue;
    }
    targets.push(opp);
  }

  const results = [];
  if (apply) {
    for (const opp of targets) {
      const row = await prisma.$transaction(
        async (tx) => ensureStandardizedPostAssessmentForOpportunity(opp, { tx, notify: false }),
        { timeout: 60000, maxWait: 20000 }
      );
      results.push(row);
    }
    if (notify) {
      for (const row of results) {
        const opp = targets.find((o) => o.id === row.opportunityId);
        if (!opp || !['published', 'in_progress'].includes(opp.status)) continue;
        const eligible = await eligibleStudentsForOpportunity(prisma, opp);
        if (!eligible.length) continue;
        const sent = await ftNotify.notifyStudentsPostAssessmentAvailable({
          studentIds: eligible.map((app) => app.student_id),
          opportunityId: opp.id,
          opportunityTitle: opp.title,
        });
        row.notified = sent?.created_count ?? 0;
      }
    }
  }

  const eligibleCounts = await Promise.all(
    targets.map((opp) =>
      prisma.field_training_applications.count({
        where: {
          opportunity_id: opp.id,
          status: 'approved',
          training_status: { not: 'expelled' },
          expelled_at: null,
        },
      })
    )
  );
  const eligibleStudents = eligibleCounts.reduce((sum, n) => sum + n, 0);

  return {
    apply,
    opportunitiesFound: opportunities.length,
    attachable: targets.length,
    created: results.filter((r) => r.action === 'created').length,
    updated: results.filter((r) => r.action === 'updated').length,
    skipped,
    skippedCount: skipped.length,
    eligibleStudents,
    opensAt: OPENS_AT,
    timezone: TIMEZONE,
    durationMinutes: DURATION_MINUTES,
    assessments: results.map((r) => ({
      assessmentId: r.assessmentId,
      opportunityId: r.opportunityId,
      opportunityTitle: r.opportunityTitle,
      questionCount: r.questionCount,
      totalPoints: r.totalPoints,
      valid: r.valid,
      action: r.action,
      questionsReplaced: r.questionsReplaced,
      questionsKeptReason: r.questionsKeptReason,
      notified: r.notified,
    })),
    dryRunTargets: apply
      ? undefined
      : targets.map((opp) => ({
          opportunityId: opp.id,
          opportunityTitle: opp.title,
          status: opp.status,
          existingPostId: opp.field_training_assessments[0]?.id || null,
          existingQuestions: opp.field_training_assessments[0]?._count?.field_training_assessment_questions ?? 0,
          existingAttempts: opp.field_training_assessments[0]?._count?.field_training_assessment_attempts ?? 0,
        })),
    bank: bankCheck,
    gradingCheck,
    answerKey: buildAdminAnswerKey(),
  };
}

async function loadPostAssessmentAttemptStatusByApplicationIds(applicationIds, db = prisma) {
  const map = new Map();
  const ids = [...new Set((applicationIds || []).filter(Boolean))];
  if (!ids.length) return map;
  const attempts = await db.field_training_assessment_attempts.findMany({
    where: {
      application_id: { in: ids },
      field_training_assessments: { type: 'post' },
    },
    select: {
      application_id: true,
      submitted_at: true,
      score: true,
      grading_details: true,
    },
  });
  for (const attempt of attempts) {
    map.set(attempt.application_id, resolveAttemptStatus(attempt, attempt.score));
  }
  return map;
}

module.exports = {
  TEMPLATE_ID,
  ASSESSMENT_TITLE,
  DESCRIPTION_BODY,
  STUDENT_INSTRUCTIONS,
  OBJECTIVES,
  LEARNING_OUTCOMES,
  TIMEZONE,
  OPENS_AT,
  CLOSES_AT,
  DURATION_MINUTES,
  MAX_ATTEMPTS,
  PASSING_SCORE,
  TOTAL_GRADE,
  QUESTION_COUNT,
  ATTEMPT_STATUS,
  STANDARDIZED_POST_QUESTIONS,
  buildSettingsPayload,
  serializeDescription,
  parseAssessmentDescription,
  publicSettings,
  shuffleQuestionsForStudent,
  sanitizeStudentQuestions,
  studentPayloadLeaksAnswers,
  resolveAttemptStatus,
  remainingSeconds,
  assertAssessmentWindow,
  toStorageQuestions,
  validateStandardizedBank,
  validateStoredAssessmentCopy,
  verifyAutomaticGrading,
  buildAdminAnswerKey,
  ensureStandardizedPostAssessmentForOpportunity,
  applyToAllOpportunities,
  loadPostAssessmentAttemptStatusByApplicationIds,
};
