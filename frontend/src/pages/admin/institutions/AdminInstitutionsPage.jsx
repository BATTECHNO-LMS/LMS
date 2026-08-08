import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus } from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { AdminActionBar } from '../../../components/admin/AdminActionBar.jsx';
import { AdminFilterBar } from '../../../components/admin/AdminFilterBar.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { SearchInput } from '../../../components/admin/SearchInput.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormSelect } from '../../../components/forms/FormSelect.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import {
  createInstitution,
  listOrganizations,
} from '../../../features/organizations/organizations.service.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { useAuth } from '../../../features/auth/index.js';
import { ROLES } from '../../../constants/roles.js';

function statusVariant(status) {
  if (status === 'active') return 'success';
  if (status === 'inactive' || status === 'archived') return 'muted';
  return 'default';
}

function statusLabel(status) {
  if (status === 'active') return 'نشطة';
  if (status === 'inactive') return 'غير نشطة';
  if (status === 'archived') return 'مؤرشفة';
  return status || '—';
}

export function AdminInstitutionsPage() {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.isGlobal || user?.role === ROLES.SUPER_ADMIN);
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [publicRegFilter, setPublicRegFilter] = useState('');
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  async function refresh() {
    setListLoading(true);
    setListError('');
    try {
      const data = await listOrganizations({ type: 'INSTITUTION' });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setItems([]);
      setListError(getApiErrorMessage(err, 'تعذر تحميل المؤسسات حاليًا. يرجى المحاولة مرة أخرى.'));
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setLoading(true);
    setError('');
    try {
      await createInstitution({ name: name.trim() });
      setName('');
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر إنشاء المؤسسة. حاول مرة أخرى.'));
    } finally {
      setLoading(false);
    }
  }

  const rows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items
      .filter((org) => !qq || String(org.name || '').toLowerCase().includes(qq) || String(org.code || '').toLowerCase().includes(qq))
      .filter((org) => !statusFilter || String(org.status) === statusFilter)
      .filter((org) => {
        if (publicRegFilter === 'true') return Boolean(org.allowsPublicTraineeRegistration);
        if (publicRegFilter === 'false') return !org.allowsPublicTraineeRegistration;
        return true;
      })
      .map((org) => ({
        id: String(org.id),
        name: String(org.name || '—'),
        status: String(org.status || ''),
        code: org.code != null ? String(org.code) : '—',
        branchCount: org.branchCount ?? 0,
        trainingCourseCount: org.trainingCourseCount ?? 0,
        adminCount: org.adminCount ?? 0,
        trainerCount: org.trainerCount ?? 0,
        traineeCount: org.traineeCount ?? 0,
        publicReg: Boolean(org.allowsPublicTraineeRegistration),
        createdAt: org.createdAt,
      }));
  }, [items, q, statusFilter, publicRegFilter]);

  const columns = [
    {
      key: 'name',
      label: 'المؤسسة',
      mobileTitle: true,
      render: (row) => (
        <Link className="link" to={`/admin/institutions/${row.id}`}>
          {row.name}
        </Link>
      ),
    },
    { key: 'code', label: 'الرمز', mobileSubtitle: true },
    {
      key: 'status',
      label: 'الحالة',
      render: (row) => (
        <StatusBadge variant={statusVariant(row.status)}>{statusLabel(row.status)}</StatusBadge>
      ),
    },
    { key: 'branchCount', label: 'الفروع' },
    { key: 'trainingCourseCount', label: 'الدورات' },
    { key: 'trainerCount', label: 'المدربون' },
    { key: 'traineeCount', label: 'المتدربون' },
    {
      key: 'publicReg',
      label: 'التسجيل العام',
      render: (row) => (
        <StatusBadge variant={row.publicReg ? 'success' : 'muted'}>
          {row.publicReg ? 'مفعّل' : 'معطّل'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      label: 'إجراءات',
      render: (row) => (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <Link className="btn btn--outline btn--sm" to={`/admin/institutions/${row.id}`}>
            إدارة
          </Link>
          <Link
            className="btn btn--primary btn--sm"
            to={`/admin/training-courses/create?organizationId=${row.id}`}
          >
            دورة جديدة
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="page page--dashboard page--admin crud-page" dir="rtl">
      <AdminPageHeader
        title="المؤسسات"
        description="إدارة مؤسسات بوابة الدورات التدريبية — نفس السجلات المستخدمة في التسجيل العام."
      />

      <AdminActionBar>
        <span className="text-muted" style={{ fontSize: '0.9rem' }}>
          إجمالي المؤسسات: {items.length}
        </span>
        <Link className="btn btn--outline btn--sm" to="/admin/training-courses">
          الدورات التدريبية
        </Link>
      </AdminActionBar>

      {isSuperAdmin ? (
        <SectionCard title="إنشاء مؤسسة جديدة">
          <form className="crud-form crud-form--inline" onSubmit={onCreate}>
            {error ? (
              <p className="form-field__error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="auth-form__fields-grid" style={{ gridTemplateColumns: '1fr auto' }}>
              <FormInput
                id="institution-name"
                label="اسم المؤسسة"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: معهد التدريب المهني"
              />
              <div className="form-field" style={{ justifyContent: 'flex-end' }}>
                <label className="form-field__label" aria-hidden>
                  &nbsp;
                </label>
                <Button type="submit" variant="primary" disabled={loading || !name.trim()}>
                  <Plus size={16} aria-hidden /> {loading ? 'جاري الإنشاء...' : 'إضافة مؤسسة'}
                </Button>
              </div>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث باسم المؤسسة أو الرمز"
          aria-label="بحث"
        />
        <FormSelect
          id="status-filter"
          label="الحالة"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">كل الحالات</option>
          <option value="active">نشطة</option>
          <option value="inactive">غير نشطة</option>
          <option value="archived">مؤرشفة</option>
        </FormSelect>
        <FormSelect
          id="public-reg-filter"
          label="التسجيل العام"
          value={publicRegFilter}
          onChange={(e) => setPublicRegFilter(e.target.value)}
        >
          <option value="">الكل</option>
          <option value="true">مفعّل</option>
          <option value="false">معطّل</option>
        </FormSelect>
      </AdminFilterBar>

      <SectionCard title="قائمة المؤسسات">
        {listLoading ? (
          <LoadingSpinner />
        ) : listError ? (
          <p className="form-field__error" role="alert">
            {listError}
          </p>
        ) : rows.length === 0 && !q && !statusFilter && !publicRegFilter ? (
          <EmptyState
            icon={Building2}
            title="لا توجد مؤسسات مضافة حتى الآن."
            description={
              isSuperAdmin
                ? 'أنشئ أول مؤسسة للبدء في إدارة الدورات والمتدربين.'
                : 'لا يوجد ارتباط نشط بين حسابك وأي مؤسسة. يرجى التواصل مع إدارة النظام.'
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
