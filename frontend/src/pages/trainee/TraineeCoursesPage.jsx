import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { listMyPrograms } from '../../features/training/training.service.js';
import { useAuth } from '../../features/auth/index.js';
import { getRoleLabelAr } from '../../utils/authRouting.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

function progressVariant(pct) {
  if (pct >= 80) return 'success';
  if (pct >= 40) return 'info';
  return 'warning';
}

function sectionForStatus(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'INVITED') return 'invited';
  if (s === 'PENDING') return 'pending';
  if (s === 'COMPLETED') return 'completed';
  if (['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED'].includes(s)) return 'active';
  return 'other';
}

export function TraineeCoursesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const roleLabel = getRoleLabelAr(user?.role || 'trainee', user?.organizationType);

  useEffect(() => {
    setLoading(true);
    listMyPrograms()
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => {
        setItems([]);
        setError(getApiErrorMessage(err, 'تعذر تحميل الدورات التدريبية حاليًا.'));
      })
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const buckets = {
      invited: [],
      pending: [],
      active: [],
      completed: [],
      other: [],
    };
    for (const item of items) {
      buckets[sectionForStatus(item.status)].push(item);
    }
    return buckets;
  }, [items]);

  function renderGroup(title, rows) {
    if (!rows.length) return null;
    return (
      <section className="student-program-section" style={{ marginBottom: '1.5rem' }}>
        <h2 className="section-card__title">{title}</h2>
        <div className="student-program-grid">
          {rows.map((item) => {
            const pct = Number(item.progress?.completionPct ?? 0);
            return (
              <article key={item.enrollmentId || item.programId} className="student-program-card">
                <div className="student-program-card__header">
                  <span className="student-program-card__icon" aria-hidden>
                    <BookOpen size={22} />
                  </span>
                  <div className="student-program-card__info">
                    <h3 className="student-program-card__title">
                      <Link className="link" to={`/trainee/courses/${item.programId}`}>
                        {item.programTitle || 'دورة تدريبية'}
                      </Link>
                    </h3>
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
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="page page--dashboard page--student" dir="rtl">
      <AdminPageHeader
        title="دوراتي التدريبية"
        description={`مرحباً ${user?.name || roleLabel} — قائمة الدورات المرتبطة بحسابك (لا تتطلب اختيار دورة واحدة لفتح هذه الصفحة).`}
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
          title="لا توجد دورات تدريبية مرتبطة بحسابك حاليًا"
          description="عند دعوتك أو تسجيلك في دورة تدريبية ستظهر هنا مع حالة التسجيل ونسبة الإنجاز."
        />
      ) : null}

      {!loading && items.length ? (
        <>
          {renderGroup('الدورات المدعو إليها', grouped.invited)}
          {renderGroup('طلبات التسجيل المعلقة', grouped.pending)}
          {renderGroup('الدورات النشطة', grouped.active)}
          {renderGroup('الدورات المكتملة', grouped.completed)}
          {renderGroup('دورات أخرى', grouped.other)}
        </>
      ) : null}
    </div>
  );
}
