import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CalendarDays, Layers, AlertTriangle } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminStatsGrid } from '../../components/admin/AdminStatsGrid.jsx';
import { StatCard } from '../../components/common/StatCard.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { getTrainerDashboard } from '../../features/training/trainer.service.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function TrainerDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTrainerDashboard()
      .then(setData)
      .catch((err) => setError(getApiErrorMessage(err, 'تعذر تحميل لوحة المدرب.')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page page--dashboard" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page page--dashboard" dir="rtl">
      <AdminPageHeader
        title="لوحة التحكم"
        description="ملخص الدورات والدفعات والجلسات المسندة إليك فقط."
      />

      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}

      <AdminStatsGrid>
        <StatCard label="الدورات النشطة" value={data?.activeCourses ?? 0} icon={BookOpen} />
        <StatCard label="الدفعات المسندة" value={data?.assignedCohorts ?? 0} icon={Layers} />
        <StatCard label="الجلسات القادمة" value={data?.upcomingSessions ?? 0} icon={CalendarDays} />
        <StatCard
          label="التسليمات المعلقة"
          value={data?.pendingSubmissions ?? 0}
          icon={Layers}
        />
        <StatCard
          label="الحضور غير المعتمد"
          value={data?.unconfirmedAttendance ?? 0}
          icon={CalendarDays}
        />
        <StatCard
          label="المتدربون الذين يحتاجون متابعة"
          value={data?.traineesNeedingFollowUp ?? 0}
          icon={AlertTriangle}
        />
      </AdminStatsGrid>

      <div className="crud-page__grid crud-page__grid--2">
        <SectionCard title="الدورات المسندة">
          {data?.courses?.length ? (
            <ul className="simple-list">
              {data.courses.map((item) => (
                <li key={item.program?.id}>
                  <Link className="link" to={`/trainer/courses/${item.program?.id}`}>
                    {item.program?.title || 'دورة'}
                  </Link>
                  {item.organization?.name ? (
                    <span style={{ marginInlineStart: '0.5rem', opacity: 0.75 }}>
                      — {item.organization.name}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="لا توجد دورات مسندة"
              description="سيظهر هنا ما يسنده إليك مسؤول المؤسسة."
            />
          )}
        </SectionCard>

        <SectionCard title="الجلسات القادمة">
          {data?.nextSessions?.length ? (
            <ul className="simple-list">
              {data.nextSessions.map((session) => (
                <li key={session.id}>
                  <strong>{session.title}</strong>
                  <br />
                  <span dir="ltr">
                    {session.starts_at ? new Date(session.starts_at).toLocaleString('ar') : '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد جلسات قادمة" description="ستظهر الجلسات ضمن الدورات المسندة." />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
