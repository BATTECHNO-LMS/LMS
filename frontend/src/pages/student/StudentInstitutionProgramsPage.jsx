import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays } from 'lucide-react';
import { StudentPageHeader } from '../../components/student/StudentPageHeader.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { listMyPrograms } from '../../features/training/training.service.js';
import { useAuth } from '../../features/auth/index.js';
import { getRoleLabelAr } from '../../utils/authRouting.js';

function progressVariant(pct) {
  if (pct >= 80) return 'success';
  if (pct >= 40) return 'info';
  return 'warning';
}

export function StudentInstitutionProgramsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    listMyPrograms()
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => {
        setItems([]);
        setError('تعذر تحميل الدورات التدريبية حاليًا.');
      })
      .finally(() => setLoading(false));
  }, []);

  const roleLabel = getRoleLabelAr(user?.role || 'student', user?.organizationType);

  return (
    <div className="page page--dashboard page--student" dir="rtl">
      <StudentPageHeader
        title="دوراتي التدريبية"
        description={`مرحباً ${user?.name || roleLabel} — تابع دوراتك وجلساتك وتقدمك في بوابة المؤسسات.`}
        actions={<StatusBadge variant="info">{roleLabel}</StatusBadge>}
      />

      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <LoadingSpinner /> : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="لا توجد دورات مسجّلة بعد"
          description="عند تسجيلك في دورة تدريبية ستظهر هنا مع نسبة الإنجاز والجلسات القادمة."
        />
      ) : null}

      {!loading && items.length ? (
        <div className="student-program-grid">
          {items.map((item) => {
            const pct = Number(item.progress?.completionPct ?? 0);
            return (
              <article key={item.enrollmentId || item.programId} className="student-program-card">
                <div className="student-program-card__header">
                  <span className="student-program-card__icon" aria-hidden>
                    <BookOpen size={22} />
                  </span>
                  <div className="student-program-card__info">
                    <h2 className="student-program-card__title">{item.programTitle || 'دورة تدريبية'}</h2>
                    <p className="student-program-card__subtitle">
                      <CalendarDays size={14} aria-hidden /> {item.cohortName || 'دفعة غير محددة'}
                    </p>
                  </div>
                  <StatusBadge variant="info">{item.status || 'مسجّل'}</StatusBadge>
                </div>
                <div className="student-program-card__content">
                  <div className="student-program-card__metric-label">
                    <span>نسبة الإنجاز</span>
                    <StatusBadge variant={progressVariant(pct)}>{pct}%</StatusBadge>
                  </div>
                  <div
                    className="progress-bar"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span
                      className="progress-bar__fill"
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
