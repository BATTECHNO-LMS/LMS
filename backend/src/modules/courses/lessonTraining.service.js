const path = require('path');
const { ApiError } = require('../../utils/apiError');
const { resolvePublicUrl } = require('../../shared/storage/fileStorage');
const repo = require('./lessonTraining.repository');
const coursesRepo = require('./courses.repository');

const DEFAULT_INSTRUCTIONS =
  'حل المطلوب في الملف وارفع الحل بصيغة PDF. الدرجة الكلية: 100 درجة.';
const DEFAULT_PROMPT =
  'صحّح إجابة الطالب وفق المعايير التالية: صحة الحل، اكتمال الإجابة، اتباع التعليمات، تنظيم المحتوى.';

function buildDefaultTraining(lesson) {
  return {
    lesson_id: lesson.id,
    task_instructions: lesson.description || DEFAULT_INSTRUCTIONS,
    task_file_url: lesson.type === 'file' ? lesson.resource_url : null,
    task_file_name: null,
    model_answer_url: null,
    model_answer_name: null,
    correction_prompt: DEFAULT_PROMPT,
    max_score: 100,
    pass_score: 60,
    upload_weight: 30,
    lesson,
  };
}

async function getTrainingConfig(lessonId, courseId) {
  const lesson = await repo.findLessonInCourse(lessonId, courseId);
  if (!lesson) throw new ApiError(404, 'Lesson not found');

  const row = await repo.findTraining(lessonId);
  const questions = await repo.findQuestions(lessonId);

  if (!row) {
    const def = buildDefaultTraining(lesson);
    return {
      lesson_id: lessonId,
      video_url: lesson.video_url,
      title: lesson.title,
      type: lesson.type,
      task_instructions: def.task_instructions,
      task_file_url: resolvePublicUrl(def.task_file_url),
      task_file_name: def.task_file_name,
      model_answer_url: null,
      model_answer_name: null,
      correction_prompt: def.correction_prompt,
      max_score: def.max_score,
      pass_score: def.pass_score,
      upload_weight: def.upload_weight,
      questions: questions.map(mapQuestionForStudent),
      is_default: true,
    };
  }

  return {
    lesson_id: lessonId,
    video_url: lesson.video_url,
    title: lesson.title,
    type: lesson.type,
    task_instructions: row.task_instructions || DEFAULT_INSTRUCTIONS,
    task_file_url: resolvePublicUrl(row.task_file_url),
    task_file_name: row.task_file_name,
    model_answer_url: resolvePublicUrl(row.model_answer_url),
    model_answer_name: row.model_answer_name,
    correction_prompt: row.correction_prompt || DEFAULT_PROMPT,
    max_score: row.max_score,
    pass_score: row.pass_score,
    upload_weight: row.upload_weight,
    questions: questions.map(mapQuestionForStudent),
    is_default: false,
  };
}

function mapQuestionForStudent(q) {
  return {
    id: q.id,
    question_text: q.question_text,
    code_snippet: q.code_snippet,
    points: q.points,
    sort_order: q.sort_order,
  };
}

function mapWorkflow(wf, config) {
  if (!wf) {
    return {
      started: false,
      submitted: false,
      finished: false,
      current_step: 1,
      submission: null,
      answers: {},
      upload_score: null,
      quiz_score: null,
      total_score: null,
      passed: null,
      feedback_summary: null,
      correction_details: null,
    };
  }

  const answers = wf.answers_json && typeof wf.answers_json === 'object' ? wf.answers_json : {};
  let current_step = 1;
  if (wf.started_at) current_step = 2;
  if (wf.submitted_at) current_step = 4;
  if (wf.finished_at) current_step = 6;
  else if (wf.submitted_at && config.questions?.length) current_step = 5;

  return {
    started: Boolean(wf.started_at),
    submitted: Boolean(wf.submitted_at),
    finished: Boolean(wf.finished_at),
    current_step,
    submission: wf.submission_file_path
      ? {
          file_name: wf.submission_file_name,
          file_url: resolvePublicUrl(wf.submission_file_path),
          size_bytes: wf.submission_size_bytes,
          submitted_at: wf.submitted_at,
        }
      : null,
    answers,
    upload_score: wf.upload_score,
    quiz_score: wf.quiz_score,
    total_score: wf.total_score,
    passed: wf.passed,
    feedback_summary: wf.feedback_summary,
    correction_details: wf.correction_details,
    started_at: wf.started_at,
    finished_at: wf.finished_at,
  };
}

async function getStudentTrainingState(courseId, lessonId, studentId) {
  const enrollment = await coursesRepo.findEnrollment(courseId, studentId);
  if (!enrollment) throw new ApiError(403, 'يجب بدء الكورس أولاً');
  const config = await getTrainingConfig(lessonId, courseId);
  const wf = await repo.findWorkflow(lessonId, studentId);
  return { config, workflow: mapWorkflow(wf, config) };
}

async function startTraining(courseId, lessonId, studentId) {
  const lesson = await repo.findLessonInCourse(lessonId, courseId);
  if (!lesson) throw new ApiError(404, 'Lesson not found');

  const wf = await repo.upsertWorkflow(lessonId, studentId, courseId, {
    started_at: new Date(),
  });
  const config = await getTrainingConfig(lessonId, courseId);
  return { config, workflow: mapWorkflow(wf, config) };
}

async function submitFile(courseId, lessonId, studentId, file) {
  const lesson = await repo.findLessonInCourse(lessonId, courseId);
  if (!lesson) throw new ApiError(404, 'Lesson not found');

  let wf = await repo.findWorkflow(lessonId, studentId);
  if (!wf?.started_at) {
    throw new ApiError(400, 'ابدأ التدريب أولاً');
  }

  const relativePath = path
    .join('lesson-training', lessonId, file.filename)
    .replace(/\\/g, '/');

  wf = await repo.upsertWorkflow(lessonId, studentId, courseId, {
    submission_file_path: relativePath,
    submission_file_name: file.originalname,
    submission_size_bytes: file.size,
    submitted_at: new Date(),
    upload_score: null,
  });

  const config = await getTrainingConfig(lessonId, courseId);
  return { config, workflow: mapWorkflow(wf, config) };
}

function gradeAnswers(questions, answersMap) {
  let earned = 0;
  let possible = 0;
  const details = [];

  for (const q of questions) {
    possible += q.points;
    const raw = answersMap[q.id];
    const studentAns = String(raw ?? '').trim().toLowerCase();
    const expected = String(q.expected_answer ?? '').trim().toLowerCase();
    const correct = expected.length > 0 && studentAns === expected;
    if (correct) earned += q.points;
    details.push({
      question_id: q.id,
      correct,
      points_awarded: correct ? q.points : 0,
      max_points: q.points,
    });
  }

  return { earned, possible, details };
}

function buildFeedback(total, max, passed, details, prompt) {
  const lines = [
    passed ? 'أحسنت! اجتزت التدريب بنجاح.' : 'لم تجتز بعد — راجع الإجابة النموذجية وحاول تحسين حلك.',
    `الدرجة: ${total}/${max}`,
    '',
    'ملخص التصحيح الآلي للأسئلة:',
  ];
  for (const d of details) {
    lines.push(`- سؤال: ${d.correct ? 'صحيح' : 'يحتاج مراجعة'} (${d.points_awarded}/${d.max_points})`);
  }
  lines.push('', 'معيار التصحيح (للمراجعة):', prompt);
  return lines.join('\n');
}

async function submitAnswers(courseId, lessonId, studentId, answersInput) {
  const lesson = await repo.findLessonInCourse(lessonId, courseId);
  if (!lesson) throw new ApiError(404, 'Lesson not found');

  let wf = await repo.findWorkflow(lessonId, studentId);
  if (!wf?.submitted_at) {
    throw new ApiError(400, 'ارفع ملف الحل أولاً');
  }

  const configRow = await getTrainingConfig(lessonId, courseId);
  const questions = await repo.findQuestions(lessonId);

  const answersMap = {};
  for (const a of answersInput || []) {
    if (a.question_id) answersMap[a.question_id] = a.answer_text;
  }

  const training = await repo.findTraining(lessonId);
  const maxScore = training?.max_score ?? 100;
  const passScore = training?.pass_score ?? 60;
  const uploadWeight = training?.upload_weight ?? 30;
  const quizWeight = Math.max(0, 100 - uploadWeight);

  const { earned, possible, details } = gradeAnswers(questions, answersMap);

  let quizScore = 0;
  if (possible > 0) {
    quizScore = Math.round((earned / possible) * quizWeight);
  } else {
    quizScore = quizWeight;
  }

  const uploadScore = wf.submission_file_path ? uploadWeight : 0;
  const totalScore = Math.min(maxScore, uploadScore + quizScore);
  const passed = totalScore >= passScore;

  const prompt = configRow.correction_prompt || DEFAULT_PROMPT;
  const feedback = buildFeedback(totalScore, maxScore, passed, details, prompt);
  const correctionDetails = JSON.stringify({ details, prompt_used: prompt }, null, 2);

  wf = await repo.upsertWorkflow(lessonId, studentId, courseId, {
    answers_json: answersMap,
    upload_score: uploadScore,
    quiz_score: quizScore,
    total_score: totalScore,
    passed,
    feedback_summary: feedback,
    correction_details: correctionDetails,
    finished_at: new Date(),
  });

  await coursesRepo.upsertLessonComplete(courseId, lessonId, studentId);

  const config = await getTrainingConfig(lessonId, courseId);
  return { config, workflow: mapWorkflow(wf, config) };
}

async function upsertAdminTraining(courseId, lessonId, body) {
  const lesson = await repo.findLessonAny(lessonId, courseId);
  if (!lesson) throw new ApiError(404, 'Lesson not found');

  const data = {
    task_instructions: body.task_instructions ?? null,
    task_file_url: body.task_file_url ?? null,
    task_file_name: body.task_file_name ?? null,
    model_answer_url: body.model_answer_url ?? null,
    model_answer_name: body.model_answer_name ?? null,
    correction_prompt: body.correction_prompt ?? null,
    max_score: body.max_score ?? 100,
    pass_score: body.pass_score ?? 60,
    upload_weight: body.upload_weight ?? 30,
  };

  await repo.upsertTraining(lessonId, data);
  if (body.questions) {
    await repo.replaceQuestions(lessonId, body.questions);
  }

  const questions = await repo.findQuestions(lessonId);
  const training = await repo.findTraining(lessonId);
  return {
    ...training,
    task_file_url: resolvePublicUrl(training.task_file_url),
    model_answer_url: resolvePublicUrl(training.model_answer_url),
    questions,
  };
}

async function getAdminTraining(courseId, lessonId) {
  const lesson = await repo.findLessonAny(lessonId, courseId);
  if (!lesson) throw new ApiError(404, 'Lesson not found');

  const training = await repo.findTraining(lessonId);
  const questions = await repo.findQuestions(lessonId);
  if (!training) {
    const def = buildDefaultTraining(lesson);
    return {
      lesson_id: lessonId,
      task_instructions: def.task_instructions,
      task_file_url: def.task_file_url,
      model_answer_url: null,
      correction_prompt: def.correction_prompt,
      max_score: 100,
      pass_score: 60,
      upload_weight: 30,
      questions,
    };
  }

  return {
    ...training,
    task_file_url: training.task_file_url,
    model_answer_url: training.model_answer_url,
    questions,
  };
}

module.exports = {
  getStudentTrainingState,
  startTraining,
  submitFile,
  submitAnswers,
  upsertAdminTraining,
  getAdminTraining,
};
