export function mergeTraineeProgramDetail(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  return {
    ...prev,
    ...next,
    sessions: next.sessions ?? prev.sessions,
    tasks: next.tasks ?? prev.tasks,
    assessments: next.assessments ?? prev.assessments,
    materials: next.materials ?? prev.materials,
    recordedLectures: next.recordedLectures ?? prev.recordedLectures,
    certificate: next.certificate !== undefined ? next.certificate : prev.certificate,
    progress: next.progress ?? prev.progress,
  };
}

export function mergeTrainerCourseDetail(prev, next) {
  if (!prev) return next;
  if (!next) return prev;
  return {
    ...prev,
    ...next,
    overview: { ...(prev.overview || {}), ...(next.overview || {}) },
    sessions: next.sessions ?? prev.sessions,
    tasks: next.tasks ?? prev.tasks,
    assessments: next.assessments ?? prev.assessments,
    trainees: next.trainees ?? prev.trainees,
    cohorts: next.cohorts ?? prev.cohorts,
    progressRows: next.progressRows ?? prev.progressRows,
    reportsSummary: next.reportsSummary ?? prev.reportsSummary,
  };
}
