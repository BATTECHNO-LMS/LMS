import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Award, Bell } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { listMyPrograms } from '../../features/training/training.service.js';
import { useAuth } from '../../features/auth/index.js';
import { getRoleLabelAr } from '../../utils/authRouting.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function TraineeDashboardPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const roleLabel = getRoleLabelAr(user?.role || 'trainee', user?.organizationType);

  useEffect(() => {
    setLoading(true);
    listMyPrograms()
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => setError(getApiErrorMessage(err, 'تعذر تحميل الدورات.')))
      .finally(() => setLoading(false));
  }, []);

  const active = items.filter((i) => ['ACTIVE', 'APPROVED', 'REQUIREMENTS_COMPLETED'].includes(i.status));
  const completed = items.filter((i) => i.status === 'COMPLETED');

  return (
    <div className="page page--dashboard" dir="rtl">
      <AdminPageHeader
        title="لوحة المتدرب"
        description={`مرحباً ${user?.name || roleLabel} — تابع دوراتك وتقدمك في بوابة المؤسسات.`}
        actions={<StatusBadge variant="info">{roleLabel}</StatusBadge>}
      />

      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <LoadingSpinner /> : null}

      {!loading ? (
        <div className="crud-page__grid crud-page__grid--2">
          <SectionCard title="دوراتي النشطة">
            {active.length ? (
              <ul className="simple-list">
                {active.slice(0, 5).map((item) => (
                  <li key={item.enrollmentId || item.programId}>
                    <Link className="link" to={`/trainee/courses/${item.programId}`}>
                      {item.programTitle || 'دورة تدريبية'}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="لا توجد دورات نشطة"
                description="لا توجد دورات تدريبية مرتبطة بحسابك حاليًا."
              />
            )}
            <p style={{ marginTop: '1rem' }}>
              <Link className="link" to="/trainee/courses">
                عرض كل الدورات
              </Link>
            </p>
          </SectionCard>

          <SectionCard title="ملخص سريع">
            <ul className="simple-list">
              <li>
                <BookOpen size={16} aria-hidden /> الدورات النشطة: {active.length}
              </li>
              <li>
                <Award size={16} aria-hidden /> المكتملة: {completed.length}
              </li>
              <li>
                <Bell size={16} aria-hidden />{' '}
                <Link className="link" to="/trainee/notifications">
                  الإشعارات
                </Link>
              </li>
            </ul>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
