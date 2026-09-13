'use strict';

import { watchStatusKey } from './recordedLectureTime.js';
import { fieldTrainingKeys } from './hooks/fieldTrainingQueryKeys.js';

export const LECTURE_FILTERS = ['all', 'notStarted', 'inProgress', 'completed'];

export function lectureCtaKey(progress) {
  const status = watchStatusKey(progress);
  if (status === 'completed') return 'watchAgain';
  if (status === 'inProgress' || Number(progress?.resumePositionSeconds || 0) > 0) {
    return 'continue';
  }
  return 'startWatching';
}

export function summarizeStudentLectures(lectures = []) {
  const list = Array.isArray(lectures) ? lectures : [];
  return {
    total: list.length,
    completed: list.filter((row) => watchStatusKey(row.progress) === 'completed').length,
  };
}

export function filterStudentLectures(lectures = [], { query = '', status = 'all' } = {}) {
  const list = Array.isArray(lectures) ? lectures : [];
  const q = String(query || '').trim().toLowerCase();
  const statusKey = status === 'all' || !status ? 'all' : status;
  return list.filter((lecture) => {
    if (statusKey !== 'all' && watchStatusKey(lecture.progress) !== statusKey) return false;
    if (!q) return true;
    const hay = `${lecture.title || ''} ${lecture.instructorName || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

export function mergeLectureProgress(listData, lectureId, progress) {
  if (!listData || !Array.isArray(listData.lectures)) return listData;
  const lectures = listData.lectures.map((row) =>
    String(row.id) === String(lectureId) ? { ...row, progress } : row
  );
  return {
    ...listData,
    lectures,
    summary: summarizeStudentLectures(lectures),
  };
}

export function mergeDetailProgress(detail, progress) {
  if (!detail?.lecture) return detail;
  return {
    ...detail,
    lecture: { ...detail.lecture, progress },
  };
}

export function patchRecordedLectureProgressCache(queryClient, opportunityId, lectureId, progress) {
  if (!queryClient || !opportunityId || !lectureId || !progress) return;
  queryClient.setQueryData(
    fieldTrainingKeys.studentRecordedLecture(opportunityId, lectureId),
    (old) => mergeDetailProgress(old, progress)
  );
  queryClient.setQueryData(
    fieldTrainingKeys.recordedLectures(opportunityId, 'student'),
    (old) => mergeLectureProgress(old, lectureId, progress)
  );
}

export function removeStudentLectureFromCache(queryClient, opportunityId, lectureId) {
  if (!queryClient || !opportunityId || !lectureId) return;
  queryClient.removeQueries({
    queryKey: fieldTrainingKeys.studentRecordedLecture(opportunityId, lectureId),
  });
  queryClient.setQueryData(fieldTrainingKeys.recordedLectures(opportunityId, 'student'), (old) => {
    if (!old || !Array.isArray(old.lectures)) return old;
    const lectures = old.lectures.filter((row) => String(row.id) !== String(lectureId));
    return {
      ...old,
      lectures,
      summary: summarizeStudentLectures(lectures),
    };
  });
}
