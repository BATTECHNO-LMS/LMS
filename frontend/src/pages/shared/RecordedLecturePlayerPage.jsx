import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import {
  getMaterialPlaybackUrl,
  listRecordedLectures,
} from '../../features/training/training.service.js';
import { formatDuration } from '../../features/training/components/RecordedLecturesManager.jsx';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

function resolveRole(pathname) {
  if (pathname.includes('/admin/')) return 'admin';
  if (pathname.includes('/trainer/')) return 'trainer';
  return 'trainee';
}

/**
 * Institutional recorded-lecture player.
 * Uses signed/private playback URL from training materials (shared files storage).
 */
export function RecordedLecturePlayerPage() {
  const { programId, lectureId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const roleBase = resolveRole(location.pathname);
  const [lectures, setLectures] = useState([]);
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const current = useMemo(
    () => lectures.find((l) => l.id === lectureId) || null,
    [lectures, lectureId]
  );
  const index = lectures.findIndex((l) => l.id === lectureId);
  const prev = index > 0 ? lectures[index - 1] : null;
  const next = index >= 0 && index < lectures.length - 1 ? lectures[index + 1] : null;

  const coursePath =
    roleBase === 'trainer'
      ? `/trainer/courses/${programId}/lectures`
      : roleBase === 'admin'
        ? `/admin/training-courses/${programId}`
        : `/trainee/courses/${programId}/lectures`;

  const lecturePath = (id) =>
    roleBase === 'admin'
      ? `/admin/training-courses/${programId}/lectures/${id}`
      : `/${roleBase}/courses/${programId}/lectures/${id}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await listRecordedLectures(programId);
        if (cancelled) return;
        setLectures(Array.isArray(rows) ? rows : []);
        const data = await getMaterialPlaybackUrl(lectureId);
        if (cancelled) return;
        setPlaybackUrl(data?.url || '');
        setMimeType(data?.mimeType || '');
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'تعذر تشغيل المحاضرة.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, lectureId]);

  if (loading) {
    return (
      <div className="page page--dashboard" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page page--dashboard course-content-fade" dir="rtl">
      <AdminPageHeader title={current?.title || 'محاضرة مسجلة'} />
      <p>
        <Link className="link" to={coursePath}>
          ← العودة للمحاضرات المسجلة
        </Link>
      </p>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <SectionCard title="مشغل المحاضرة">
        {playbackUrl ? (
          mimeType?.startsWith('video/') || !mimeType || /\.(mp4|webm|mov)(\?|$)/i.test(playbackUrl) ? (
            <video
              className="course-lecture-player"
              controls
              playsInline
              src={playbackUrl}
              key={playbackUrl}
            >
              متصفحك لا يدعم تشغيل الفيديو.
            </video>
          ) : (
            <p>
              <a className="link" href={playbackUrl} target="_blank" rel="noreferrer">
                فتح الملف
              </a>
            </p>
          )
        ) : current?.url ? (
          <p>
            <a className="link" href={current.url} target="_blank" rel="noreferrer" dir="ltr">
              فتح الرابط الخارجي
            </a>
          </p>
        ) : (
          <p>لا يتوفر مصدر تشغيل.</p>
        )}
        {current?.description ? (
          <p className="auth-register__helper" style={{ marginTop: '1rem' }}>
            {current.description}
          </p>
        ) : null}
        <p className="auth-register__helper">المدة: {formatDuration(current?.durationSeconds)}</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <Button type="button" variant="outline" disabled={!prev} onClick={() => prev && navigate(lecturePath(prev.id))}>
            المحاضرة السابقة
          </Button>
          <Button type="button" variant="outline" disabled={!next} onClick={() => next && navigate(lecturePath(next.id))}>
            المحاضرة التالية
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
