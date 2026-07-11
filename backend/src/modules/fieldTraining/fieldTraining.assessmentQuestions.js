/**
 * Field-training assessment question helpers (types, normalization, grading).
 */

const QUESTION_TYPES = Object.freeze([
  'short_text',
  'long_text',
  'multiple_choice',
  'multi_select',
  'true_false',
  'short_answer', // legacy alias of short_text
]);

const AUTO_GRADE_TYPES = new Set([
  'short_text',
  'short_answer',
  'multiple_choice',
  'multi_select',
  'true_false',
]);

function normalizeQuestionType(type) {
  const t = String(type || '').trim();
  if (t === 'short_answer') return 'short_text';
  return t;
}

function asStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v ?? '').trim()).filter(Boolean);
  }
  if (value == null) return [];
  if (typeof value === 'string') {
    const s = value.trim();
    return s ? [s] : [];
  }
  return [];
}

function normalizeCorrectAnswer(type, correctAnswer, options = []) {
  const t = normalizeQuestionType(type);
  if (t === 'true_false') {
    const v = correctAnswer === true || correctAnswer === 'true' || correctAnswer === 'صح'
      ? 'true'
      : correctAnswer === false || correctAnswer === 'false' || correctAnswer === 'خطأ'
        ? 'false'
        : String(correctAnswer ?? '').trim().toLowerCase() === 'true'
          ? 'true'
          : String(correctAnswer ?? '').trim().toLowerCase() === 'false'
            ? 'false'
            : null;
    return v;
  }
  if (t === 'multiple_choice') {
    return correctAnswer == null ? null : String(correctAnswer).trim();
  }
  if (t === 'multi_select') {
    return asStringArray(correctAnswer);
  }
  if (t === 'short_text') {
    if (correctAnswer && typeof correctAnswer === 'object' && !Array.isArray(correctAnswer)) {
      return {
        answers: asStringArray(correctAnswer.answers ?? correctAnswer.accepted_answers),
        auto_grade: correctAnswer.auto_grade !== false && correctAnswer.grading_mode !== 'manual',
      };
    }
    const answers = asStringArray(correctAnswer);
    return { answers, auto_grade: answers.length > 0 };
  }
  if (t === 'long_text') {
    if (correctAnswer && typeof correctAnswer === 'object' && !Array.isArray(correctAnswer)) {
      return {
        sample_answer: correctAnswer.sample_answer != null
          ? String(correctAnswer.sample_answer)
          : null,
        auto_grade: false,
      };
    }
    if (typeof correctAnswer === 'string' && correctAnswer.trim()) {
      return { sample_answer: correctAnswer.trim(), auto_grade: false };
    }
    return { sample_answer: null, auto_grade: false };
  }
  return correctAnswer ?? null;
}

function normalizeOptions(type, options) {
  const t = normalizeQuestionType(type);
  if (t === 'true_false') return ['true', 'false'];
  if (t === 'multiple_choice' || t === 'multi_select') {
    return asStringArray(options);
  }
  return null;
}

/**
 * Validate a question for save/publish. Returns Arabic error message or null.
 */
function validateQuestionForPublish(q, index) {
  const n = index + 1;
  const text = String(q.question_text ?? '').trim();
  if (!text) return `السؤال ${n}: نص السؤال مطلوب.`;

  const type = normalizeQuestionType(q.question_type);
  if (!QUESTION_TYPES.includes(type) && type !== 'short_text') {
    return `السؤال ${n}: نوع السؤال غير مدعوم.`;
  }

  const points = Number(q.points);
  if (!Number.isFinite(points) || points <= 0) {
    return `السؤال ${n}: علامة السؤال يجب أن تكون أكبر من صفر.`;
  }

  const options = normalizeOptions(type, q.options);
  const correct = normalizeCorrectAnswer(type, q.correct_answer, options);

  if (type === 'multiple_choice') {
    if (!options || options.length < 2) {
      return `السؤال ${n}: أضف خيارين على الأقل.`;
    }
    if (!correct || !options.includes(String(correct))) {
      return `السؤال ${n}: حدد إجابة صحيحة من الخيارات.`;
    }
  }

  if (type === 'multi_select') {
    if (!options || options.length < 2) {
      return `السؤال ${n}: أضف خيارين على الأقل.`;
    }
    const selected = asStringArray(correct);
    if (!selected.length) {
      return `السؤال ${n}: حدد إجابة صحيحة واحدة على الأقل.`;
    }
    if (selected.some((s) => !options.includes(s))) {
      return `السؤال ${n}: الإجابات الصحيحة يجب أن تكون من الخيارات.`;
    }
  }

  if (type === 'true_false') {
    if (correct !== 'true' && correct !== 'false') {
      return `السؤال ${n}: حدد الإجابة الصحيحة (صح أو خطأ).`;
    }
  }

  if (type === 'short_text') {
    const auto = correct?.auto_grade !== false;
    const answers = asStringArray(correct?.answers);
    if (auto && !answers.length) {
      return `السؤال ${n}: أضف إجابة مقبولة واحدة على الأقل للتصحيح التلقائي، أو اختر التصحيح اليدوي.`;
    }
  }

  return null;
}

function validateAssessmentQuestions(questions = []) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return 'أضف سؤالًا واحدًا على الأقل.';
  }
  for (let i = 0; i < questions.length; i += 1) {
    const err = validateQuestionForPublish(questions[i], i);
    if (err) return err;
  }
  const total = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
  return { ok: true, totalPoints: total };
}

function setsEqual(a, b) {
  const left = new Set(asStringArray(a).map((s) => s.toLowerCase()));
  const right = new Set(asStringArray(b).map((s) => s.toLowerCase()));
  if (left.size !== right.size) return false;
  for (const v of left) {
    if (!right.has(v)) return false;
  }
  return true;
}

function gradeQuestion(question, given) {
  const type = normalizeQuestionType(question.question_type);
  const points = Number(question.points) || 1;
  const correct = normalizeCorrectAnswer(type, question.correct_answer, question.options);

  if (type === 'long_text') {
    return {
      awardedPoints: 0,
      maxPoints: points,
      gradingStatus: 'pending_manual',
    };
  }

  if (type === 'short_text') {
    const auto = correct?.auto_grade !== false;
    const accepted = asStringArray(correct?.answers);
    if (!auto || !accepted.length) {
      return {
        awardedPoints: 0,
        maxPoints: points,
        gradingStatus: 'pending_manual',
      };
    }
    const givenStr = String(given ?? '').trim().toLowerCase();
    const ok = accepted.some((a) => a.toLowerCase() === givenStr);
    return {
      awardedPoints: ok ? points : 0,
      maxPoints: points,
      gradingStatus: 'auto_graded',
    };
  }

  if (type === 'multi_select') {
    const ok = setsEqual(given, correct);
    return {
      awardedPoints: ok ? points : 0,
      maxPoints: points,
      gradingStatus: 'auto_graded',
    };
  }

  if (type === 'true_false') {
    const g = given === true || given === 'true' ? 'true' : given === false || given === 'false' ? 'false' : String(given ?? '');
    const ok = g === correct;
    return {
      awardedPoints: ok ? points : 0,
      maxPoints: points,
      gradingStatus: 'auto_graded',
    };
  }

  // multiple_choice
  const ok = String(given ?? '').trim() === String(correct ?? '').trim();
  return {
    awardedPoints: ok ? points : 0,
    maxPoints: points,
    gradingStatus: 'auto_graded',
  };
}

/**
 * @returns {{
 *   scorePoints: number,
 *   maxPoints: number,
 *   scorePercent: number,
 *   questionResults: Array<{ questionId: string, awardedPoints: number, maxPoints: number, gradingStatus: string }>
 * }}
 */
function gradeAnswers(questions, answers) {
  let scorePoints = 0;
  let maxPoints = 0;
  const questionResults = [];

  for (const q of questions) {
    const result = gradeQuestion(q, answers?.[q.id]);
    maxPoints += result.maxPoints;
    scorePoints += result.awardedPoints;
    questionResults.push({
      questionId: q.id,
      awardedPoints: result.awardedPoints,
      maxPoints: result.maxPoints,
      gradingStatus: result.gradingStatus,
    });
  }

  const scorePercent =
    maxPoints > 0 ? Math.round((scorePoints / maxPoints) * 10000) / 100 : 0;

  return { scorePoints, maxPoints, scorePercent, questionResults };
}

function prepareQuestionForStorage(q, index) {
  const type = normalizeQuestionType(q.question_type);
  const options = normalizeOptions(type, q.options);
  const correct_answer = normalizeCorrectAnswer(type, q.correct_answer, options);
  return {
    question_text: String(q.question_text ?? '').trim(),
    question_type: type === 'short_answer' ? 'short_text' : type,
    options,
    correct_answer,
    points: Number(q.points) > 0 ? Number(q.points) : 1,
    is_required: q.is_required !== false,
    sort_order: q.sort_order ?? index,
  };
}

module.exports = {
  QUESTION_TYPES,
  AUTO_GRADE_TYPES,
  normalizeQuestionType,
  normalizeCorrectAnswer,
  normalizeOptions,
  validateQuestionForPublish,
  validateAssessmentQuestions,
  gradeAnswers,
  gradeQuestion,
  prepareQuestionForStorage,
};
