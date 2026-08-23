import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, Plus } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { AdminActionBar } from '../../../components/admin/AdminActionBar.jsx';
import { AdminFilterBar } from '../../../components/admin/AdminFilterBar.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../../components/admin/SearchInput.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { FormSelect } from '../../../components/forms/FormSelect.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { listTrainingCourses } from '../../../features/training/training.service.js';
import { listOrganizations } from '../../../features/organizations/organizations.service.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { useAuth } from '../../../features/auth/index.js';
import { ROLES } from '../../../constants/roles.js';
import { trainingProgramStatusLabel, TRAINING_PROGRAM_STATUS_LABEL_AR } from '../../../features/training/trainingProgramStatus.js';

const COURSE_LIST_STATUS_FILTERS = ['DRAFT', 'PUBLISHED', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'];

export function AdminTrainingCoursesPage() {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.isGlobal || user?.role === ROLES.SUPER_ADMIN);
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [organizationId, setOrganizationId] = useState(searchParams.get('organizationId') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (status) params.status = status;
      if (isSuperAdmin && organizationId) params.organizationId = organizationId;
      const [courses, orgs] = await Promise.all([
        listTrainingCourses(params),
        isSuperAdmin ? listOrganizations({ type: 'INSTITUTION' }) : Promise.resolve([]),
      ]);
      setItems(Array.isArray(courses) ? courses : []);
      setInstitutions(Array.isArray(orgs) ? orgs : []);
    } catch (err) {
      setItems([]);
      setError(getApiErrorMessage(err, 'تعذر تحميل الدورات التدريبية حاليًا. يرجى المحاولة مرة أخرى.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, organizationId, isSuperAdmin]);

  useEffect(() => {
    const next = {};
    if (status) next.status = status;
    if (organizationId) next.organizationId = organizationId;
    setSearchParams(next, { replace: true });
  }, [status, organizationId, setSearchParams]);

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items
      .filter(
        (c) =>
          !qq ||
          String(c.title || '')
            .toLowerCase()
            .includes(qq) ||
          String(c.organizationName || '')
            .toLowerCase()
            .includes(qq)
      )
      .map((c) => ({
        id: c.id,
        title: c.title || '—',
        organizationName: c.organizationName || '—',
        organizationId: c.organizationId,
        status: c.status || '',
        startDate: c.startDate ? String(c.startDate).slice(0, 10) : '—',
        endDate: c.endDate ? String(c.endDate).slice(0, 10) : '—',
        cohortCount: c.cohortCount ?? 0,
        trainerCount: c.trainerCount ?? 0,
        traineeCount: c.traineeCount ?? 0,
        requiredHours: c.requiredHours ?? '—',
      }));
  }, [items, q]);

  const columns = [
    {
      key: 'title',
      label: 'الدورة',
      mobileTitle: true,
      render: (row) => (
        <Link className="link" to={`/admin/training-courses/${row.id}`}>
          {row.title}
        </Link>
      ),
    },
    { key: 'organizationName', label: 'المؤسسة', mobileSubtitle: true },
    {
      key: 'status',
      label: 'الحالة',
      render: (row) => <StatusBadge variant="info">{trainingProgramStatusLabel(row.status)}</StatusBadge>,
    },
    { key: 'startDate', label: 'البداية' },
    { key: 'endDate', label: 'النهاية' },
    { key: 'cohortCount', label: 'الدفعات' },
    { key: 'trainerCount', label: 'المدربون' },
    { key: 'traineeCount', label: 'المتدربون' },
    { key: 'requiredHours', label: 'الساعات' },
    {
      key: 'actions',
      label: 'إجراءات',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <Link className="btn btn--outline btn--sm" to={`/admin/training-courses/${row.id}`}>
            إدارة
          </Link>
          <Link className="btn btn--primary btn--sm" to={`/admin/training-courses/${row.id}/edit`}>
            تعديل
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="page page--dashboard page--admin crud-page" dir="rtl">
      <AdminPageHeader
        title="الدورات التدريبية"
        description="إدارة دورات المؤسسات من نوع TRAINING_COURSE عبر محرك التدريب المشترك."
      />

      <AdminActionBar>
        <span className="text-muted" style={{ fontSize: '0.9rem' }}>
          إجمالي الدورات: {items.length}
        </span>
        <Link className="btn btn--primary btn--sm" to="/admin/training-courses/create">
          <Plus size={16} aria-hidden /> إنشاء دورة تدريبية
        </Link>
      </AdminActionBar>

      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث باسم الدورة أو المؤسسة"
          aria-label="بحث"
        />
        <FormSelect id="course-status" label="الحالة" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          {COURSE_LIST_STATUS_FILTERS.map((code) => (
              <option key={code} value={code}>
                {TRAINING_PROGRAM_STATUS_LABEL_AR[code]}
              </option>
            ))}
        </FormSelect>
        {isSuperAdmin ? (
          <FormSelect
            id="course-org"
            label="المؤسسة"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
          >
            <option value="">كل المؤسسات</option>
            {institutions.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </FormSelect>
        ) : null}
      </AdminFilterBar>

      <SectionCard title="قائمة الدورات">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <p className="form-field__error" role="alert">
            {error}
          </p>
        ) : rows.length === 0 && !q ? (
          <EmptyState
            icon={BookOpen}
            title="لم تتم إضافة دورات تدريبية لهذه المؤسسة بعد."
            description="أنشئ أول دورة تدريبية لبدء إدارة الدفعات والمدربين والمتدربين."
            action={
              <Link className="btn btn--primary btn--sm" to="/admin/training-courses/create">
                إنشاء أول دورة تدريبية
              </Link>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            emptyTitle="لا توجد نتائج"
            emptyDescription="جرّب تعديل عوامل التصفية أو كلمة البحث."
          />
        )}
      </SectionCard>
    </div>
  );
}
