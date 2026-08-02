import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { listTrainerCourses } from '../../features/training/trainer.service.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function TrainerCoursesPage() {
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listTrainerCourses()
      .then((data) => setCourses(Array.isArray(data) ? data : []))
      .catch((err) => setError(getApiErrorMessage(err, 'تعذر تحميل الدورات.')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page page--dashboard" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  const rows = courses.map((item) => ({
    id: item.program?.id,
    title: item.program?.title || '—',
    status: item.program?.status || '—',
    organization: item.organization?.name || '—',
    cohorts: item.assignments?.length || 0,
  }));

  return (
    <div className="page page--dashboard crud-page" dir="rtl">
      <AdminPageHeader
        title="الدورات التدريبية"
        description="الدورات والدفعات المسندة إليك فقط."
      />
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <SectionCard title="دوراتي">
        <DataTable
          columns={[
            {
              key: 'title',
              label: 'الدورة',
              mobileTitle: true,
              render: (row) => (
                <Link className="link" to={`/trainer/courses/${row.id}`}>
                  {row.title}
                </Link>
              ),
            },
            { key: 'organization', label: 'المؤسسة', mobileSubtitle: true },
            {
              key: 'status',
              label: 'الحالة',
              render: (row) => <StatusBadge variant="info">{row.status}</StatusBadge>,
            },
            { key: 'cohorts', label: 'التعيينات' },
          ]}
          rows={rows}
          emptyTitle="لا توجد دورات"
          emptyDescription="لم يتم إسناد أي دورة تدريبية لحسابك بعد."
        />
        {!rows.length ? (
          <EmptyState title="لا توجد دورات" description="تواصل مع مسؤول المؤسسة لإسناد دورة." />
        ) : null}
      </SectionCard>
    </div>
  );
}
