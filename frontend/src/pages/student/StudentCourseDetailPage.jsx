import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { Button } from '../../components/common/Button.jsx';
import {
  useCompleteLesson,
  useStartStudentCourse,
  useStudentCourse,
} from '../../features/courses/index.js';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';

function embedVideoUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
  } catch {
    return null;
  }
  return null;
}

export function StudentCourseDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation('courses');
  const { data, isLoading, isError, refetch } = useStudentCourse(id);
  const startMut = useStartStudentCourse();
  const completeMut = useCompleteLesson(id);
  const [activeLessonId, setActiveLessonId] = useState(null);

  const course = data?.course;
  const sections = data?.sections ?? [];
  const allLessons = sections.flatMap((s) => s.lessons);
  const activeLesson = allLessons.find((l) => l.id === activeLessonId) ?? allLessons[0] ?? null;

  async function handleStart() {
    await startMut.mutateAsync(id);
    refetch();
  }

  async function handleComplete(lessonId) {
    await completeMut.mutateAsync(lessonId);
    refetch();
  }

  if (isLoading) return <LoadingSpinner />;

  if (isError || !data?.course) {
    return (
      <PagePermissionGate permission={UI_PERMISSION.canViewCourses}>
        <div className="page page--dashboard page--student">
          <Link className="btn btn--ghost btn--sm" to="/student/courses" style={{ marginBottom: '1rem' }}>
            <ArrowLeft size={16} /> {t('student.backToList')}
          </Link>
          <p className="crud-muted" role="alert">{t('student.courseNotFound')}</p>
        </div>
      </PagePermissionGate>
    );
  }

  const embed = activeLesson?.type === 'video' ? embedVideoUrl(activeLesson.video_url) : null;

  return (
    <PagePermissionGate permission={UI_PERMISSION.canViewCourses}>
      <div className="page page--dashboard page--student">
        <Link className="btn btn--ghost btn--sm" to="/student/courses" style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={16} /> {t('student.backToList')}
        </Link>
        <AdminPageHeader
          title={course?.title ?? ''}
          description={course?.short_description || course?.description || ''}
        />
        <p className="crud-muted">
          {t('student.progress')}: {data?.progress_percent ?? 0}%
        </p>
        {!course?.enrollment_status ? (
          <Button type="button" variant="primary" onClick={handleStart} disabled={startMut.isPending}>
            {t('student.start')}
          </Button>
        ) : null}
        <div className="course-detail-layout">
          <SectionCard title={t('structure.title')}>
            {sections.map((sec) => (
              <div key={sec.id} style={{ marginBottom: '1rem' }}>
                <h4 className="section-card__title" style={{ fontSize: '1rem' }}>{sec.title}</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {sec.lessons.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        className={`btn btn--ghost btn--sm${activeLesson?.id === l.id ? ' btn--primary' : ''}`}
                        style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 4 }}
                        onClick={() => setActiveLessonId(l.id)}
                      >
                        {l.is_completed ? '✓ ' : ''}{l.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </SectionCard>
          {activeLesson ? (
            <SectionCard title={activeLesson.title}>
              {activeLesson.type === 'video' && embed ? (
                <div className="course-video-embed">
                  <iframe title={activeLesson.title} src={embed} allowFullScreen />
                </div>
              ) : null}
              {activeLesson.type === 'video' && !embed && activeLesson.video_url ? (
                <p><a href={activeLesson.video_url} target="_blank" rel="noreferrer">{activeLesson.video_url}</a></p>
              ) : null}
              {activeLesson.type === 'text' ? <div className="course-text-content">{activeLesson.content}</div> : null}
              {activeLesson.type === 'link' && activeLesson.resource_url ? (
                <a className="btn btn--primary" href={activeLesson.resource_url} target="_blank" rel="noreferrer">{t('student.openLink')}</a>
              ) : null}
              {activeLesson.type === 'file' && activeLesson.resource_url ? (
                <a className="btn btn--primary" href={activeLesson.resource_url} target="_blank" rel="noreferrer">{t('student.openFile')}</a>
              ) : null}
              {!activeLesson.is_completed ? (
                <Button type="button" variant="primary" style={{ marginTop: '1rem' }} onClick={() => handleComplete(activeLesson.id)} disabled={completeMut.isPending}>
                  {t('student.completeLesson')}
                </Button>
              ) : null}
            </SectionCard>
          ) : null}
        </div>
      </div>
    </PagePermissionGate>
  );
}
