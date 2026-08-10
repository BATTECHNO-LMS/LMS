import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { CourseEditForm } from '../../features/training/components/CourseEditForm.jsx';
import { getProgram } from '../../features/training/training.service.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function TrainerCourseEditPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [course, setCourse] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await getProgram(programId);
        if (!cancelled) setCourse(data);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, 'تعذر تحميل الدورة.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  if (loading) {
    return (
      <div className="page page--dashboard" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page page--dashboard crud-page course-content-fade" dir="rtl">
      <AdminPageHeader title="تعديل معلومات الدورة" />
      <p style={{ marginBottom: '1rem' }}>
        <Link className="link" to={`/trainer/courses/${programId}`}>
          ← العودة للدورة
        </Link>
      </p>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {course ? (
        <CourseEditForm
          course={course}
          programId={programId}
          allowStatus={false}
          onCancel={() => navigate(`/trainer/courses/${programId}`)}
          onSaved={(updated) => {
            setCourse(updated);
            navigate(`/trainer/courses/${programId}`, { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}
