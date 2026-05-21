import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, PlayCircle, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Button } from '../../components/common/Button.jsx';
import { useStartStudentCourse, useStudentCourse } from '../../features/courses/index.js';
import { LessonTrainingWorkflow } from './components/LessonTrainingWorkflow.jsx';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';

export function StudentCourseDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation('courses');
  const { data, isLoading, isError, refetch } = useStudentCourse(id);
  const startMut = useStartStudentCourse();
  const [activeLessonId, setActiveLessonId] = useState(null);

  const course = data?.course;
  const sections = data?.sections ?? [];
  const progress = data?.progress_percent ?? 0;

  const allLessons = useMemo(
    () => sections.flatMap((s) => s.lessons.map((l) => ({ ...l, sectionTitle: s.title }))),
    [sections]
  );

  const activeLesson = useMemo(
    () => allLessons.find((l) => l.id === activeLessonId) ?? allLessons[0] ?? null,
    [allLessons, activeLessonId]
  );

  const activeIndex = activeLesson ? allLessons.findIndex((l) => l.id === activeLesson.id) : -1;
  const completedCount = allLessons.filter((l) => l.is_completed).length;
  const enrolled = Boolean(course?.enrollment_status) || progress > 0;

  useEffect(() => {
    if (!allLessons.length) return;
    setActiveLessonId((prev) => {
      if (prev && allLessons.some((l) => l.id === prev)) return prev;
      const next = allLessons.find((l) => !l.is_completed) ?? allLessons[0];
      return next?.id ?? null;
    });
  }, [allLessons]);

  async function handleStart() {
    await startMut.mutateAsync(id);
    refetch();
  }

  function selectLesson(lessonId) {
    setActiveLessonId(lessonId);
  }

  const headerActionLabel =
    progress >= 100
      ? t('student.review')
      : progress > 0
        ? t('student.continue')
        : t('student.start');

  if (isLoading) return <LoadingSpinner />;

  if (isError || !course) {
    return (
      <PagePermissionGate permission={UI_PERMISSION.canViewCourses}>
        <div className="page page--dashboard page--student">
          <Link className="course-detail-back" to="/student/courses">
            <ArrowLeft size={18} aria-hidden />
            {t('student.backToList')}
          </Link>
          <p className="crud-muted" role="alert">
            {t('student.courseNotFound')}
          </p>
        </div>
      </PagePermissionGate>
    );
  }

  return (
    <PagePermissionGate permission={UI_PERMISSION.canViewCourses}>
      <div className="page page--dashboard page--student course-detail-page">
        <Link className="course-detail-back" to="/student/courses">
          <ArrowLeft size={18} aria-hidden />
          {t('student.backToList')}
        </Link>

        <header className="course-detail-hero">
          <div className="course-detail-hero__main">
            <h1 className="course-detail-hero__title">{course.title}</h1>
            {course.short_description || course.description ? (
              <p className="course-detail-hero__desc">
                {course.short_description || course.description}
              </p>
            ) : null}
            <div className="course-detail-hero__meta">
              <span>
                {completedCount}/{allLessons.length} {t('student.lessons')}
              </span>
              {activeLesson && activeIndex >= 0 ? (
                <span className="course-detail-hero__meta-sep" aria-hidden>
                  ·
                </span>
              ) : null}
              {activeLesson && activeIndex >= 0 ? (
                <span>
                  {t('student.lessonOf', { current: activeIndex + 1, total: allLessons.length })}
                </span>
              ) : null}
            </div>
          </div>

          <div className="course-detail-hero__aside">
            <div className="course-detail-progress">
              <div className="course-detail-progress__labels">
                <span className="course-detail-progress__label">{t('student.progress')}</span>
                <span className="course-detail-progress__pct">{progress}%</span>
              </div>
              <div
                className="course-detail-progress__bar"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span
                  className="course-detail-progress__fill"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
            </div>

            {!enrolled ? (
              <Button
                type="button"
                variant="primary"
                className="course-detail-hero__cta"
                onClick={handleStart}
                disabled={startMut.isPending}
              >
                {t('student.start')}
              </Button>
            ) : progress < 100 ? (
              <Button
                type="button"
                variant="primary"
                className="course-detail-hero__cta"
                onClick={() => {
                  const next = allLessons.find((l) => !l.is_completed);
                  if (next) selectLesson(next.id);
                }}
              >
                <PlayCircle size={18} aria-hidden />
                {headerActionLabel}
              </Button>
            ) : (
              <span className="course-detail-hero__badge">
                <CheckCircle2 size={18} aria-hidden />
                {t('student.completed')}
              </span>
            )}
          </div>
        </header>

        <div className="course-detail-layout">
          <aside className="course-detail-sidebar">
            <div className="course-detail-sidebar__head">
              <h2 className="course-detail-sidebar__title">{t('structure.title')}</h2>
            </div>
            <nav className="course-detail-outline" aria-label={t('structure.title')}>
              {sections.map((sec) => (
                <div key={sec.id} className="course-detail-outline__section">
                  <h3 className="course-detail-outline__section-title">{sec.title}</h3>
                  <ul className="course-detail-outline__list">
                    {sec.lessons.map((lesson) => {
                      const isActive = activeLesson?.id === lesson.id;
                      return (
                        <li key={lesson.id}>
                          <button
                            type="button"
                            className={`course-detail-lesson-btn${isActive ? ' course-detail-lesson-btn--active' : ''}${lesson.is_completed ? ' course-detail-lesson-btn--done' : ''}`}
                            onClick={() => selectLesson(lesson.id)}
                          >
                            <span className="course-detail-lesson-btn__icon" aria-hidden>
                              {lesson.is_completed ? (
                                <CheckCircle2 size={18} />
                              ) : isActive ? (
                                <PlayCircle size={18} />
                              ) : (
                                <Circle size={18} />
                              )}
                            </span>
                            <span className="course-detail-lesson-btn__text">{lesson.title}</span>
                            {lesson.type === 'video' ? (
                              <Video
                                size={16}
                                className="course-detail-lesson-btn__type"
                                aria-hidden
                              />
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          <main className="course-detail-main">
            {activeLesson ? (
              <div className="course-detail-player-card">
                <header className="course-detail-player-card__head">
                  <h2 className="course-detail-player-card__title">{activeLesson.title}</h2>
                  {activeLesson.sectionTitle ? (
                    <p className="course-detail-player-card__section">
                      {activeLesson.sectionTitle}
                    </p>
                  ) : null}
                </header>
                <div className="course-detail-player-card__body course-detail-player-card__body--training">
                  <LessonTrainingWorkflow
                    courseId={id}
                    lesson={activeLesson}
                    onFinished={() => refetch()}
                  />
                </div>
              </div>
            ) : (
              <div className="course-detail-empty">
                <p>{t('student.noLessonsInCourse')}</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </PagePermissionGate>
  );
}
