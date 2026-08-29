function createClientKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const QUESTION_TYPES = [
  'short_text',
  'long_text',
  'multiple_choice',
  'multi_select',
  'true_false',
];

export function createEmptyQuestion(overrides = {}) {
  return {
    clientKey: createClientKey(),
    question_text: '',
    question_type: 'multiple_choice',
    options: ['', ''],
    correct_answer: '',
    accepted_answers: [''],
    sample_answer: '',
    auto_grade: true,
    points: 1,
    is_required: true,
    ...overrides,
  };
}

/** Unwrap MCQ `correct_answer` stored as a string or `{ answer, explanation }`. */
export function unwrapMcqCorrectAnswer(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.length ? unwrapMcqCorrectAnswer(value[0]) : '';
  }
  if (typeof value === 'object') {
    if (value.answer != null && value.answer !== '') return String(value.answer).trim();
    if (value.correct != null && value.correct !== '') return String(value.correct).trim();
    if (value.value != null && value.value !== '') return String(value.value).trim();
    if (value.text != null && value.text !== '') return String(value.text).trim();
    if (value.correctOptionId != null) return String(value.correctOptionId).trim();
    if (value.optionId != null) return String(value.optionId).trim();
  }
  return '';
}

export function extractMcqExplanation(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const raw = value.explanation ?? value.correct_answer?.explanation;
    if (raw != null && String(raw).trim()) return String(raw).trim();
  }
  return '';
}

/**
 * Normalize option rows to strings. Supports `{ text, isCorrect, id }` objects
 * as well as the canonical string[] used by the save/grade path.
 */
export function normalizeMcqOptionList(raw) {
  if (!Array.isArray(raw) || !raw.length) {
    return { options: ['', ''], correctFromFlags: '', idToText: {} };
  }
  const options = [];
  const idToText = {};
  let correctFromFlags = '';
  for (const item of raw) {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const text = String(item.text ?? item.label ?? item.value ?? item.option ?? '').trim();
      const id = item.id ?? item.optionId ?? item.option_id;
      options.push(text);
      if (id != null && text) idToText[String(id)] = text;
      if ((item.isCorrect === true || item.is_correct === true) && text) {
        correctFromFlags = text;
      }
    } else {
      options.push(String(item ?? ''));
    }
  }
  return {
    options: options.length ? options : ['', ''],
    correctFromFlags,
    idToText,
  };
}

export function resolveMcqCorrectAnswer(q) {
  const { options, correctFromFlags, idToText } = normalizeMcqOptionList(q?.options);
  const unwrapped = unwrapMcqCorrectAnswer(q?.correct_answer);
  if (unwrapped && options.map((o) => o.trim()).filter(Boolean).includes(unwrapped)) {
    return unwrapped;
  }
  if (unwrapped && idToText[unwrapped]) return idToText[unwrapped];
  if (correctFromFlags) return correctFromFlags;
  return unwrapped;
}

export function hydrateQuestionFromApi(q) {
  const type = q.question_type === 'short_answer' ? 'short_text' : q.question_type;
  const base = createEmptyQuestion({
    id: q.id,
    question_text: q.question_text ?? '',
    question_type: type || 'multiple_choice',
    points: Number(q.points) > 0 ? Number(q.points) : 1,
    is_required: q.is_required !== false,
  });

  if (type === 'multiple_choice') {
    const { options } = normalizeMcqOptionList(
      Array.isArray(q.options) && q.options.length ? q.options : ['', '']
    );
    return {
      ...base,
      options,
      correct_answer: resolveMcqCorrectAnswer(q),
      explanation: extractMcqExplanation(q.correct_answer) || extractMcqExplanation(q) || '',
    };
  }

  if (type === 'multi_select') {
    const options = Array.isArray(q.options) && q.options.length ? q.options.map(String) : ['', ''];
    const correct = Array.isArray(q.correct_answer)
      ? q.correct_answer.map(String)
      : q.correct_answer
        ? [String(q.correct_answer)]
        : [];
    return { ...base, options, correct_answer: correct };
  }

  if (type === 'true_false') {
    const v = q.correct_answer === true || q.correct_answer === 'true' ? 'true' : 'false';
    return { ...base, options: ['true', 'false'], correct_answer: v };
  }

  if (type === 'short_text') {
    const ca = q.correct_answer;
    if (ca && typeof ca === 'object' && !Array.isArray(ca)) {
      const answers = Array.isArray(ca.answers) ? ca.answers.map(String) : [''];
      return {
        ...base,
        accepted_answers: answers.length ? answers : [''],
        auto_grade: ca.auto_grade !== false,
        correct_answer: null,
      };
    }
    const answers = Array.isArray(ca) ? ca.map(String) : ca != null && ca !== '' ? [String(ca)] : [''];
    return {
      ...base,
      accepted_answers: answers.length ? answers : [''],
      auto_grade: answers.some((a) => a.trim()),
      correct_answer: null,
    };
  }

  if (type === 'long_text') {
    const ca = q.correct_answer;
    const sample =
      ca && typeof ca === 'object' && !Array.isArray(ca)
        ? String(ca.sample_answer ?? '')
        : typeof ca === 'string'
          ? ca
          : '';
    return {
      ...base,
      sample_answer: sample,
      auto_grade: false,
      correct_answer: null,
    };
  }

  return base;
}

export function adaptQuestionType(question, nextType) {
  const next = { ...question, question_type: nextType };
  if (nextType === 'multiple_choice') {
    next.options = question.options?.length >= 2 ? [...question.options] : ['', ''];
    next.correct_answer = typeof question.correct_answer === 'string' ? question.correct_answer : '';
  } else if (nextType === 'multi_select') {
    next.options = question.options?.length >= 2 ? [...question.options] : ['', ''];
    next.correct_answer = Array.isArray(question.correct_answer) ? [...question.correct_answer] : [];
  } else if (nextType === 'true_false') {
    next.options = ['true', 'false'];
    next.correct_answer =
      question.correct_answer === 'true' || question.correct_answer === 'false'
        ? question.correct_answer
        : 'true';
  } else if (nextType === 'short_text') {
    next.accepted_answers = question.accepted_answers?.length ? [...question.accepted_answers] : [''];
    next.auto_grade = question.auto_grade !== false;
    next.correct_answer = null;
    next.options = null;
  } else if (nextType === 'long_text') {
    next.sample_answer = question.sample_answer ?? '';
    next.auto_grade = false;
    next.correct_answer = null;
    next.options = null;
  }
  return next;
}

export function serializeQuestionForApi(q, index) {
  const type = q.question_type === 'short_answer' ? 'short_text' : q.question_type;
  const base = {
    question_text: String(q.question_text ?? '').trim(),
    question_type: type,
    points: Number(q.points) > 0 ? Number(q.points) : 1,
    is_required: q.is_required !== false,
    sort_order: index,
  };

  if (type === 'multiple_choice') {
    const { options } = normalizeMcqOptionList(q.options || []);
    const filled = options.map((o) => String(o).trim()).filter(Boolean);
    const answer = resolveMcqCorrectAnswer(q);
    const explanation = String(q.explanation || extractMcqExplanation(q.correct_answer) || '').trim();
    return {
      ...base,
      options: filled,
      correct_answer: explanation ? { answer, explanation } : answer || null,
    };
  }

  if (type === 'multi_select') {
    const options = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
    const correct = Array.isArray(q.correct_answer)
      ? q.correct_answer.map((v) => String(v).trim()).filter(Boolean)
      : [];
    return { ...base, options, correct_answer: correct };
  }

  if (type === 'true_false') {
    return {
      ...base,
      options: ['true', 'false'],
      correct_answer: q.correct_answer === 'false' ? 'false' : 'true',
    };
  }

  if (type === 'short_text') {
    const answers = (q.accepted_answers || []).map((a) => String(a).trim()).filter(Boolean);
    return {
      ...base,
      options: null,
      correct_answer: {
        answers,
        auto_grade: q.auto_grade !== false,
      },
    };
  }

  return {
    ...base,
    options: null,
    correct_answer: {
      sample_answer: String(q.sample_answer ?? '').trim() || null,
      auto_grade: false,
    },
  };
}

export function computeTotals(questions) {
  const list = Array.isArray(questions) ? questions : [];
  const totalPoints = list.reduce((sum, q) => sum + (Number(q.points) > 0 ? Number(q.points) : 0), 0);
  return {
    questionCount: list.length,
    totalPoints,
    suggestedPassingPercent: 60,
  };
}

/** Passing score stays as percentage 0–100. */
export function validateBuilderForPublish({ title, questions, passingScore }) {
  if (!String(title || '').trim()) return 'عنوان التقييم مطلوب.';
  if (!questions?.length) return 'أضف سؤالًا واحدًا على الأقل.';

  const totals = computeTotals(questions);
  const passing = passingScore === '' || passingScore == null ? null : Number(passingScore);
  if (passing != null && (!Number.isFinite(passing) || passing < 0 || passing > 100)) {
    return 'علامة النجاح يجب أن تكون بين 0 و 100.';
  }
  if (passing != null && passing > 100) {
    return 'علامة النجاح أكبر من مجموع العلامات.';
  }

  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const n = i + 1;
    if (!String(q.question_text || '').trim()) return `السؤال ${n}: نص السؤال مطلوب.`;
    if (!(Number(q.points) > 0)) return `السؤال ${n}: علامة السؤال يجب أن تكون أكبر من صفر.`;

    const type = q.question_type;
    if (type === 'multiple_choice') {
      const { options } = normalizeMcqOptionList(q.options || []);
      const filled = options.map((o) => String(o).trim()).filter(Boolean);
      if (filled.length < 2) return `السؤال ${n}: أضف خيارين على الأقل.`;
      const correct = resolveMcqCorrectAnswer(q);
      if (!correct || !filled.includes(correct)) {
        return `السؤال ${n}: حدد إجابة صحيحة واحدة.`;
      }
    }
    if (type === 'multi_select') {
      const options = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
      if (options.length < 2) return `السؤال ${n}: أضف خيارين على الأقل.`;
      const selected = Array.isArray(q.correct_answer)
        ? q.correct_answer.map((v) => String(v).trim()).filter(Boolean)
        : [];
      if (!selected.length) return `السؤال ${n}: حدد إجابة صحيحة واحدة على الأقل.`;
    }
    if (type === 'true_false') {
      if (q.correct_answer !== 'true' && q.correct_answer !== 'false') {
        return `السؤال ${n}: حدد الإجابة الصحيحة (صح أو خطأ).`;
      }
    }
    if (type === 'short_text' && q.auto_grade !== false) {
      const answers = (q.accepted_answers || []).map((a) => String(a).trim()).filter(Boolean);
      if (!answers.length) {
        return `السؤال ${n}: أضف إجابة مقبولة أو اختر التصحيح اليدوي.`;
      }
    }
  }

  return null;
}

/** Returns true when a question is missing required builder fields (for summary UI). */
export function isQuestionIncomplete(q) {
  if (!q) return true;
  if (!String(q.question_text || '').trim()) return true;
  if (!(Number(q.points) > 0)) return true;
  const type = q.question_type;
  if (type === 'multiple_choice') {
    const { options } = normalizeMcqOptionList(q.options || []);
    const filled = options.map((o) => String(o).trim()).filter(Boolean);
    if (filled.length < 2) return true;
    const correct = resolveMcqCorrectAnswer(q);
    if (!correct || !filled.includes(correct)) return true;
  }
  if (type === 'multi_select') {
    const options = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
    if (options.length < 2) return true;
    const selected = Array.isArray(q.correct_answer)
      ? q.correct_answer.map((v) => String(v).trim()).filter(Boolean)
      : [];
    if (!selected.length) return true;
  }
  if (type === 'true_false') {
    if (q.correct_answer !== 'true' && q.correct_answer !== 'false') return true;
  }
  if (type === 'short_text' && q.auto_grade !== false) {
    const answers = (q.accepted_answers || []).map((a) => String(a).trim()).filter(Boolean);
    if (!answers.length) return true;
  }
  return false;
}

export function countIncompleteQuestions(questions = []) {
  return questions.filter(isQuestionIncomplete).length;
}

export { createClientKey };
