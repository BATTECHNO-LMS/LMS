import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Building2,
  Layers,
  Users,
  BookOpen,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { StatCard } from '../../../components/common/StatCard.jsx';
import { AdminStatsGrid } from '../../../components/admin/AdminStatsGrid.jsx';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import {
  changeMemberActivation,
  createBranch,
  createDepartment,
  getOrgDashboard,
  listBranches,
  listDepartments,
  listMembers,
  listOrganizations,
  updateBranch,
  updateInstitution,
  verifyMemberEmail,
} from '../../../features/organizations/organizations.service.js';
import {
  listPrograms,
  getOrgReport,
  listKpiAlerts,
} from '../../../features/training/training.service.js';
import {
  assignTrainerToCourse,
  createInstitutionTrainer,
  listTrainerAssignments,
  revokeTrainerAssignment,
} from '../../../features/training/trainer.service.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { useAuth } from '../../../features/auth/index.js';
import { getRoleLabelAr } from '../../../utils/authRouting.js';
import { ROLES } from '../../../constants/roles.js';
import { FormSelect } from '../../../components/forms/FormSelect.jsx';

const TABS = [
  { id: 'members', label: 'التفعيل والأعضاء', icon: Users },
  { id: 'trainers', label: 'المدربون', icon: Users },
  { id: 'structure', label: 'الفروع والأقسام', icon: Layers },
  { id: 'programs', label: 'الدورات التدريبية', icon: BookOpen },
  { id: 'reports', label: 'التقارير ومؤشرات الأداء', icon: BarChart3 },
  { id: 'settings', label: 'إعدادات التسجيل', icon: Building2 },
];

export function AdminInstitutionDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const readOnly = Boolean(user?.role === 'reviewer' || user?.organizationAssignment?.roleCode === 'reviewer');
  const isSuperAdmin = Boolean(user?.isGlobal || user?.role === ROLES.SUPER_ADMIN);
  const [tab, setTab] = useState('members');
  const [summary, setSummary] = useState(null);
  const [institution, setInstitution] = useState(null);
  const [members, setMembers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [report, setReport] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [branchName, setBranchName] = useState('');
  const [deptName, setDeptName] = useState('');
  const [trainerForm, setTrainerForm] = useState({
    full_name: '',
    email: '',
    phone: '',
  });
  const [trainerAccounts, setTrainerAccounts] = useState([]);
  const [trainerAssignments, setTrainerAssignments] = useState([]);
  const [assignForm, setAssignForm] = useState({
    trainer_user_id: '',
    training_program_id: '',
    is_lead_trainer: false,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [dash, mem, br, dep, prog, orgs, trainers, assignments] = await Promise.all([
        getOrgDashboard(id),
        listMembers(id, { pending_activation: true }),
        listBranches(id),
        listDepartments(id),
        listPrograms(id),
        listOrganizations({ type: 'INSTITUTION' }),
        listMembers(id, { role_code: 'trainer' }),
        listTrainerAssignments(id).catch(() => []),
      ]);
      setSummary(dash);
      setMembers(Array.isArray(mem) ? mem : []);
      setBranches(Array.isArray(br) ? br : []);
      setDepartments(Array.isArray(dep) ? dep : []);
      setPrograms(Array.isArray(prog) ? prog : []);
      setTrainerAccounts(Array.isArray(trainers) ? trainers : []);
      setTrainerAssignments(Array.isArray(assignments) ? assignments : []);
      const orgList = Array.isArray(orgs) ? orgs : [];
      setInstitution(orgList.find((o) => String(o.id) === String(id)) || null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر تحميل بيانات المؤسسة.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function loadReports() {
    setBusy(true);
    try {
      const [r, a] = await Promise.all([getOrgReport(id), listKpiAlerts(id)]);
      setReport(r);
      setAlerts(Array.isArray(a) ? a : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر تحميل التقارير.'));
    } finally {
      setBusy(false);
    }
  }

  const memberRows = useMemo(
    () =>
      members.map((m) => ({
        id: m.userId,
        fullName: m.fullName || '—',
        email: m.email || '—',
        overdue48h: Boolean(m.overdue48h),
        roleCode: m.roleCode || 'student',
      })),
    [members]
  );

  const memberColumns = [
    { key: 'fullName', label: 'الاسم', mobileTitle: true },
    { key: 'email', label: 'البريد', mobileSubtitle: true },
    {
      key: 'role',
      label: 'الدور',
      render: (row) => getRoleLabelAr(row.roleCode, 'INSTITUTION'),
    },
    {
      key: 'status',
      label: 'الحالة',
      render: (row) =>
        row.overdue48h ? (
          <StatusBadge variant="warning">متأخر أكثر من 48 ساعة</StatusBadge>
        ) : (
          <StatusBadge variant="info">بانتظار التفعيل</StatusBadge>
        ),
    },
    {
      key: 'actions',
      label: 'إجراءات',
      hideOnMobile: false,
      render: (row) =>
        readOnly ? (
          <StatusBadge variant="muted">عرض فقط</StatusBadge>
        ) : (
          <div className="table-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMessage('');
                try {
                  await verifyMemberEmail(id, {
                    user_id: row.id,
                    reason: 'توثيق إداري',
                    method: 'ADMIN',
                  });
                  setMessage('تم توثيق البريد الإلكتروني.');
                  await refresh();
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر توثيق البريد.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              توثيق البريد
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setMessage('');
                try {
                  await changeMemberActivation(id, { user_id: row.id, action: 'activate' });
                  setMessage('تم تفعيل الحساب.');
                  await refresh();
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر تفعيل الحساب.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              تفعيل
            </Button>
          </div>
        ),
    },
  ];

  if (loading) {
    return (
      <div className="page page--dashboard page--admin" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page" dir="rtl">
      <AdminPageHeader
        breadcrumb={
          <>
            <Link to="/admin/institutions">المؤسسات</Link>
            <span aria-hidden> / </span>
            <span>تفاصيل المؤسسة</span>
          </>
        }
        title={summary?.organizationName || 'إدارة المؤسسة'}
        description={
          readOnly
            ? 'مراجع المؤسسة — عرض فقط. لا تتوفر إجراءات التعديل.'
            : 'إدارة الأعضاء والفروع والأقسام والدورات ومؤشرات الأداء.'
        }
        actions={
          readOnly ? <StatusBadge variant="muted">عرض فقط</StatusBadge> : null
        }
      />

      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="auth-register__helper" role="status">
          {message}
        </p>
      ) : null}

      <AdminStatsGrid>
        <StatCard label="الأعضاء" value={summary?.memberCount ?? 0} icon={Users} />
        <StatCard
          label="بانتظار التفعيل"
          value={summary?.pendingActivationCount ?? 0}
          icon={AlertTriangle}
        />
        <StatCard label="الدورات" value={summary?.programCount ?? 0} icon={BookOpen} />
        <StatCard label="التنبيهات" value={summary?.activeAlertCount ?? 0} icon={BarChart3} />
      </AdminStatsGrid>

      <div className="admin-tabs" role="tablist" aria-label="أقسام إدارة المؤسسة">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`admin-tabs__btn${active ? ' admin-tabs__btn--active' : ''}`}
              onClick={() => {
                setTab(item.id);
                if (item.id === 'reports') loadReports();
              }}
            >
              <Icon size={16} aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'members' ? (
        <SectionCard title="الحسابات بانتظار التفعيل">
          <DataTable
            columns={memberColumns}
            rows={memberRows}
            emptyTitle="لا توجد حسابات بانتظار التفعيل"
            emptyDescription="ستظهر هنا طلبات المتدربين بعد توثيق البريد."
          />
        </SectionCard>
      ) : null}

      {tab === 'trainers' ? (
        <div className="crud-page__grid crud-page__grid--2">
          <SectionCard title="إنشاء مدرب مؤسسة">
            <p className="auth-register__helper">
              المدرب يُنشأ من الإدارة فقط. لا يوجد تسجيل عام لدور المدرب. يُعرض في الواجهة باسم{' '}
              <strong>المدرب</strong>.
            </p>
            {!readOnly ? (
              <form
                className="crud-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setMessage('');
                  setError('');
                  try {
                    await createInstitutionTrainer(id, {
                      full_name: trainerForm.full_name.trim(),
                      email: trainerForm.email.trim().toLowerCase(),
                      phone: trainerForm.phone.trim(),
                      activate: true,
                    });
                    setTrainerForm({ full_name: '', email: '', phone: '' });
                    setMessage('تم إنشاء/تحديث حساب المدرب وربطه بالمؤسسة.');
                    await refresh();
                  } catch (err) {
                    setError(getApiErrorMessage(err, 'تعذر إنشاء المدرب.'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div className="auth-form__fields-grid">
                  <FormInput
                    id="trainer-full-name"
                    label="الاسم الكامل"
                    required
                    value={trainerForm.full_name}
                    onChange={(e) => setTrainerForm((f) => ({ ...f, full_name: e.target.value }))}
                  />
                  <FormInput
                    id="trainer-phone"
                    label="رقم الهاتف"
                    required
                    dir="ltr"
                    value={trainerForm.phone}
                    onChange={(e) => setTrainerForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                  <FormInput
                    id="trainer-email"
                    type="email"
                    label="البريد الإلكتروني"
                    required
                    dir="ltr"
                    className="auth-form__span-full"
                    value={trainerForm.email}
                    onChange={(e) => setTrainerForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <Button type="submit" variant="primary" disabled={busy}>
                  إنشاء المدرب
                </Button>
              </form>
            ) : (
              <StatusBadge variant="muted">عرض فقط</StatusBadge>
            )}
          </SectionCard>

          <SectionCard title="إسناد مدرب إلى دورة">
            <p className="auth-register__helper">
              الوصول للدورة يعتمد على التعيين والصلاحيات، وليس على دور المدرب وحده.
            </p>
            {!readOnly ? (
              <form
                className="crud-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!assignForm.trainer_user_id || !assignForm.training_program_id) return;
                  setBusy(true);
                  setMessage('');
                  setError('');
                  try {
                    await assignTrainerToCourse(id, {
                      trainer_user_id: assignForm.trainer_user_id,
                      training_program_id: assignForm.training_program_id,
                      is_lead_trainer: Boolean(assignForm.is_lead_trainer),
                    });
                    setAssignForm({
                      trainer_user_id: '',
                      training_program_id: '',
                      is_lead_trainer: false,
                    });
                    setMessage('تم إسناد المدرب إلى الدورة.');
                    await refresh();
                  } catch (err) {
                    setError(getApiErrorMessage(err, 'تعذر إسناد المدرب.'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <FormSelect
                  id="assign-trainer"
                  label="المدرب"
                  required
                  value={assignForm.trainer_user_id}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, trainer_user_id: e.target.value }))
                  }
                >
                  <option value="">اختر المدرب</option>
                  {trainerAccounts.map((t) => (
                    <option key={t.userId} value={t.userId}>
                      {t.fullName} ({t.email})
                    </option>
                  ))}
                </FormSelect>
                <FormSelect
                  id="assign-program"
                  label="الدورة التدريبية"
                  required
                  value={assignForm.training_program_id}
                  onChange={(e) =>
                    setAssignForm((f) => ({ ...f, training_program_id: e.target.value }))
                  }
                >
                  <option value="">اختر الدورة</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || p.name || p.id}
                    </option>
                  ))}
                </FormSelect>
                <label className="form-field__checkbox">
                  <input
                    type="checkbox"
                    checked={assignForm.is_lead_trainer}
                    onChange={(e) =>
                      setAssignForm((f) => ({ ...f, is_lead_trainer: e.target.checked }))
                    }
                  />
                  مدرب رئيسي
                </label>
                <Button type="submit" variant="primary" disabled={busy}>
                  إسناد إلى الدورة
                </Button>
              </form>
            ) : (
              <StatusBadge variant="muted">عرض فقط</StatusBadge>
            )}
          </SectionCard>

          <SectionCard title="تعيينات المدربين" className="auth-form__span-full">
            {trainerAssignments.length ? (
              <ul className="simple-list">
                {trainerAssignments.map((item) => (
                  <li key={item.id}>
                    <strong>{item.trainer?.full_name || item.trainerUserId}</strong>
                    {' — '}
                    {item.program?.title || item.trainingProgramId}
                    {item.cohort?.name ? ` / ${item.cohort.name}` : ' / مستوى الدورة'}
                    {' '}
                    <StatusBadge variant={item.isActive ? 'success' : 'muted'}>
                      {item.isActive ? 'نشط' : 'ملغى'}
                    </StatusBadge>
                    {!readOnly && item.isActive ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError('');
                          try {
                            await revokeTrainerAssignment(id, item.id);
                            setMessage('تم إلغاء تعيين المدرب.');
                            await refresh();
                          } catch (err) {
                            setError(getApiErrorMessage(err, 'تعذر إلغاء التعيين.'));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        إلغاء التعيين
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="لا توجد تعيينات"
                description="أسند المدرب إلى دورة تدريبية ليتمكن من الدخول إلى مساحة الدورة."
              />
            )}
          </SectionCard>
        </div>
      ) : null}

      {tab === 'structure' ? (
        <div className="crud-page__grid crud-page__grid--2">
          <SectionCard title="الفروع">
            {!readOnly ? (
              <form
                className="crud-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!branchName.trim()) return;
                  setBusy(true);
                  try {
                    await createBranch(id, { name: branchName.trim() });
                    setBranchName('');
                    await refresh();
                  } catch (err) {
                    setError(getApiErrorMessage(err, 'تعذر إضافة الفرع.'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <FormInput
                  id="branch-name"
                  label="اسم الفرع"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="فرع جديد"
                />
                <Button type="submit" variant="primary" disabled={busy || !branchName.trim()}>
                  إضافة فرع
                </Button>
              </form>
            ) : null}
            {branches.length ? (
              <ul className="simple-list">
                {branches.map((b) => (
                  <li key={b.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Building2 size={14} aria-hidden />
                    <span>{b.name}</span>
                    <StatusBadge variant={b.isActive === false ? 'muted' : 'success'}>
                      {b.isActive === false ? 'غير نشط' : 'نشط'}
                    </StatusBadge>
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setMessage('');
                          try {
                            await updateBranch(id, b.id, { is_active: b.isActive === false });
                            setMessage('تم تحديث حالة الفرع.');
                            await refresh();
                          } catch (err) {
                            setError(getApiErrorMessage(err, 'تعذر تحديث الفرع.'));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {b.isActive === false ? 'تفعيل الفرع' : 'إيقاف الفرع'}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="لا توجد فروع" description="يمكنك إضافة فروع عند الحاجة." />
            )}
          </SectionCard>

          <SectionCard title="الأقسام">
            {!readOnly ? (
              <form
                className="crud-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!deptName.trim()) return;
                  setBusy(true);
                  try {
                    await createDepartment(id, { name: deptName.trim() });
                    setDeptName('');
                    await refresh();
                  } catch (err) {
                    setError(getApiErrorMessage(err, 'تعذر إضافة القسم.'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <FormInput
                  id="dept-name"
                  label="اسم القسم"
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="قسم جديد"
                />
                <Button type="submit" variant="primary" disabled={busy || !deptName.trim()}>
                  إضافة قسم
                </Button>
              </form>
            ) : null}
            {departments.length ? (
              <ul className="simple-list">
                {departments.map((d) => (
                  <li key={d.id}>
                    <Layers size={14} aria-hidden /> {d.name}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="لا توجد أقسام" description="يمكنك إضافة أقسام عند الحاجة." />
            )}
          </SectionCard>
        </div>
      ) : null}

      {tab === 'programs' ? (
        <SectionCard title="الدورات التدريبية">
          {!readOnly ? (
            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link
                className="btn btn--primary btn--sm"
                to={`/admin/training-courses/create?organizationId=${id}`}
              >
                إنشاء دورة تدريبية
              </Link>
              <Link className="btn btn--outline btn--sm" to={`/admin/training-courses?organizationId=${id}`}>
                عرض كل الدورات
              </Link>
            </div>
          ) : null}
          <DataTable
            columns={[
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
              {
                key: 'status',
                label: 'الحالة',
                render: (row) => <StatusBadge variant="info">{row.status}</StatusBadge>,
              },
              {
                key: 'actions',
                label: 'إجراءات',
                render: (row) => (
                  <Link className="btn btn--outline btn--sm" to={`/admin/training-courses/${row.id}`}>
                    إدارة
                  </Link>
                ),
              },
            ]}
            rows={programs.map((p) => ({
              id: p.id,
              title: p.title || '—',
              status: p.status || '—',
            }))}
            emptyTitle="لم تتم إضافة دورات تدريبية لهذه المؤسسة بعد."
            emptyDescription="أنشئ أول دورة تدريبية لهذه المؤسسة."
          />
        </SectionCard>
      ) : null}

      {tab === 'settings' ? (
        <SectionCard title="التسجيل العام للمتدربين">
          <p className="auth-register__helper">
            عند التفعيل تظهر المؤسسة في نموذج التسجيل العام للمتدربين فقط.
          </p>
          {isSuperAdmin && !readOnly ? (
            <Button
              type="button"
              variant="primary"
              disabled={busy || !institution}
              onClick={async () => {
                setBusy(true);
                setMessage('');
                try {
                  const next = !institution?.allowsPublicTraineeRegistration;
                  await updateInstitution(id, { allows_public_trainee_registration: next });
                  setMessage(next ? 'تم تفعيل التسجيل العام.' : 'تم إيقاف التسجيل العام.');
                  await refresh();
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر تحديث إعداد التسجيل.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {institution?.allowsPublicTraineeRegistration
                ? 'إيقاف التسجيل العام للمتدربين'
                : 'تفعيل التسجيل العام للمتدربين'}
            </Button>
          ) : (
            <StatusBadge
              variant={institution?.allowsPublicTraineeRegistration ? 'success' : 'muted'}
            >
              {institution?.allowsPublicTraineeRegistration
                ? 'التسجيل العام مفعّل'
                : 'التسجيل العام غير مفعّل'}
            </StatusBadge>
          )}
        </SectionCard>
      ) : null}

      {tab === 'reports' ? (
        <div className="crud-page__grid crud-page__grid--2">
          <SectionCard title="ملخص تقرير المؤسسة">
            {busy && !report ? <LoadingSpinner /> : null}
            {report ? (
              <dl className="detail-list">
                {Object.entries(report).map(([key, value]) => (
                  <div key={key} className="detail-list__row">
                    <dt>{key}</dt>
                    <dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : !busy ? (
              <EmptyState title="لا يوجد تقرير" description="لم تتوفر بيانات التقرير بعد." />
            ) : null}
          </SectionCard>
          <SectionCard title="التنبيهات المبكرة">
            {alerts.length ? (
              <ul className="simple-list">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <StatusBadge variant={a.status === 'OPEN' ? 'warning' : 'muted'}>
                      {a.status}
                    </StatusBadge>{' '}
                    {a.message}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="لا توجد تنبيهات" description="مؤشرات الأداء ضمن الحدود الطبيعية." />
            )}
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
