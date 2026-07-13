import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchLessonTraining,
  startLessonTraining,
  submitLessonTrainingAnswers,
  uploadLessonSubmission,
} from '../courses.service.js';
import { coursesKeys } from './coursesQueryKeys.js';

export function lessonTrainingKey(courseId, lessonId) {
  return ['lessonTraining', courseId, lessonId];
}

export function useLessonTraining(courseId, lessonId, options = {}) {
  return useQuery({
    queryKey: lessonTrainingKey(courseId, lessonId),
    queryFn: () => fetchLessonTraining(courseId, lessonId),
    enabled: Boolean(courseId && lessonId),
    retry: (failureCount, error) => {
      const status = error?.response?.status;
      if (status === 403 || status === 404) return false;
      return failureCount < 2;
    },
    ...options,
  });
}

export function useLessonTrainingMutations(courseId, lessonId) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: lessonTrainingKey(courseId, lessonId) });
    qc.invalidateQueries({ queryKey: coursesKeys.studentDetail(courseId) });
  };

  const start = useMutation({
    mutationFn: () => startLessonTraining(courseId, lessonId),
    onSuccess: invalidate,
  });

  const upload = useMutation({
    mutationFn: (file) => uploadLessonSubmission(courseId, lessonId, file),
    onSuccess: invalidate,
  });

  const submitAnswers = useMutation({
    mutationFn: (answers) => submitLessonTrainingAnswers(courseId, lessonId, answers),
    onSuccess: invalidate,
  });

  return { start, upload, submitAnswers };
}
