import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  Layers,
  AlertTriangle,
  ClipboardCheck,
  FileCheck,
  FileBarChart2,
} from 'lucide-react';
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

  const firstCourseId = data?.courses?.[0]?.program?.id;

  return (
    <div className="page page--dashboard" dir="rtl">
      <AdminPageHeader
        title="لوحة التحكم"
        description="إدارة الدورات المسندة إليك: الجلسات، الحضور، المهمات، الاختبارات، والتقارير."
      />

      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}

      <AdminStatsGrid>
        <Link to="/trainer/courses" className="link" style={{ textDecoration: 'none', color: 'inherit' }}>
          <StatCard label="دوراتي التدريبية" value={data?.activeCourses ?? 0} icon={BookOpen} />
        </Link>
        <Link
          to={firstCourseId ? `/trainer/courses/${firstCourseId}/sessions` : '/trainer/courses'}
          className="link"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <StatCard label="الجلسات القادمة" value={data?.upcomingSessions ?? 0} icon={CalendarDays} />
        </Link>
        <Link
          to={firstCourseId ? `/trainer/courses/${firstCourseId}/attendance` : '/trainer/courses'}
          className="link"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <StatCard
            label="الحضور المطلوب اعتماده"
            value={data?.unconfirmedAttendance ?? 0}
            icon={ClipboardCheck}
          />
        </Link>
        <Link
          to={firstCourseId ? `/trainer/courses/${firstCourseId}/tasks` : '/trainer/courses'}
          className="link"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <StatCard label="المهمات بانتظار التصحيح" value={data?.pendingSubmissions ?? 0} icon={Layers} />
        </Link>
        <Link
          to={firstCourseId ? `/trainer/courses/${firstCourseId}/assessments` : '/trainer/courses'}
          className="link"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <StatCard
            label="الاختبارات / التقييم"
            value={data?.pendingSubmissions ?? 0}
            icon={FileCheck}
          />
        </Link>
        <Link
          to={firstCourseId ? `/trainer/courses/${firstCourseId}/progress` : '/trainer/courses'}
          className="link"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <StatCard
            label="المتدربون المتعثرون"
            value={data?.traineesNeedingFollowUp ?? 0}
            icon={AlertTriangle}
          />
        </Link>
        <Link
          to={firstCourseId ? `/trainer/courses/${firstCourseId}/finalization` : '/trainer/courses'}
          className="link"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <StatCard
            label="إنهاء التدريب والتقارير"
            value={data?.assignedCohorts ?? 0}
            icon={FileBarChart2}
          />
        </Link>
      </AdminStatsGrid>

      <div className="crud-page__grid crud-page__grid--2">
        <SectionCard title="دوراتي التدريبية">
          {data?.courses?.length ? (
            <ul className="simple-list">
              {data.courses.map((item) => (
                <li key={item.program?.id}>
                  <Link className="link" to={`/trainer/courses/${item.program?.id}`}>
                    {item.program?.title || 'دورة'}
                  </Link>
                  {item.isLeadTrainer ? (
                    <span style={{ marginInlineStart: '0.5rem' }}>
                      <strong>المدرب الأساسي</strong>
                    </span>
                  ) : null}
                  {item.organization?.name ? (
                    <span style={{ marginInlineStart: '0.5rem', opacity: 0.75 }}>
                      — {item.organization.name}
                    </span>
                  ) : null}
                  <div style={{ marginTop: '0.35rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <Link className="link" to={`/trainer/courses/${item.program?.id}/sessions`}>
                      الجلسات
                    </Link>
                    <Link className="link" to={`/trainer/courses/${item.program?.id}/attendance`}>
                      الحضور
                    </Link>
                    <Link className="link" to={`/trainer/courses/${item.program?.id}/tasks`}>
                      المهمات
                    </Link>
                    <Link className="link" to={`/trainer/courses/${item.program?.id}/finalization`}>
                      التقارير / الإنهاء
                    </Link>
                  </div>
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
                  {session.program_id || session.programId ? (
                    <div>
                      <Link
                        className="link"
                        to={`/trainer/courses/${session.program_id || session.programId}/attendance`}
                      >
                        إدارة الحضور
                      </Link>
                    </div>
                  ) : null}
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
