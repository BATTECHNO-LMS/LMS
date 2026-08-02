import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { FormInput } from '../../components/forms/FormInput.jsx';
import { FormSelect } from '../../components/forms/FormSelect.jsx';
import { FormTextarea } from '../../components/forms/FormTextarea.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { getTrainerCourse } from '../../features/training/trainer.service.js';
import {
  createProgramMaterial,
  createSession,
  createTask,
  getPrePostComparison,
  listProgramAssessments,
  listSessionAttendance,
  openAttendanceWindow,
} from '../../features/training/training.service.js';
import { TrainingAssessmentEditor } from '../../features/training/components/TrainingAssessmentEditor.jsx';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

const TABS = [
  { id: 'overview', label: 'نظرة عامة', perm: null },
  { id: 'cohorts', label: 'الدفعات', perm: null },
  { id: 'sessions', label: 'الجلسات', perm: 'canManageSessions', readFallback: true },
  { id: 'attendance', label: 'الحضور', perm: 'canManageAttendance', readFallback: true },
  { id: 'materials', label: 'المواد التدريبية', perm: 'canManageMaterials' },
  { id: 'tasks', label: 'المهمات', perm: 'canManageTasks', readFallback: true },
  { id: 'assessments', label: 'الاختبارات', perm: 'canManageAssessments', readFallback: true },
  { id: 'trainees', label: 'المتدربون', perm: 'canViewTrainees' },
  { id: 'progress', label: 'التقدم', perm: 'canViewProgress' },
  { id: 'reports', label: 'التقارير', perm: 'canViewReports' },
];

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ar');
  } catch {
    return '—';
  }
}

export function TrainerCoursePage() {
  const { programId, tab: tabParam } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabParam || searchParams.get('tab') || 'overview';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [lastAttendanceCode, setLastAttendanceCode] = useState('');
  const [sessionForm, setSessionForm] = useState({
    cohort_id: '',
    title: '',
    starts_at: '',
    ends_at: '',
    hours: '2',
    location: '',
  });
  const [taskForm, setTaskForm] = useState({ title: '', instructions: '' });
  const [materialForm, setMaterialForm] = useState({ title: '', url: '' });
  const [assessments, setAssessments] = useState([]);
  const [assessmentKind, setAssessmentKind] = useState('pre');
  const [comparison, setComparison] = useState(null);

  async function refresh() {
    if (!programId) return;
    setLoading(true);
    setError('');
    try {
      const course = await getTrainerCourse(programId);
      setData(course);
      setSessionForm((prev) => ({
        ...prev,
        cohort_id: prev.cohort_id || course?.cohorts?.[0]?.id || '',
      }));
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر تحميل الدورة.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  useEffect(() => {
    if (tab !== 'assessments' || !programId) return;
    listProgramAssessments(programId)
      .then((rows) => setAssessments(Array.isArray(rows) ? rows : []))
      .catch((err) => setError(getApiErrorMessage(err, 'تعذر تحميل الاختبارات.')));
  }, [tab, programId]);

  const permissions = data?.permissions || {};
  const visibleTabs = useMemo(
    () =>
      TABS.filter((item) => {
        if (!item.perm) return true;
        if (permissions[item.perm] === true) return true;
        if (item.readFallback && permissions[item.perm] === false) return true;
        return permissions[item.perm] !== false;
      }),
    [permissions]
  );

  function selectTab(nextTab) {
    navigate(`/trainer/courses/${programId}/${nextTab}`, { replace: true });
    setSearchParams({ tab: nextTab });
  }

  if (!programId) return <Navigate to="/trainer/courses" replace />;

  if (loading) {
    return (
      <div className="page page--dashboard" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page page--dashboard" dir="rtl">
        <p className="form-field__error" role="alert">
          {error}
        </p>
        <Link className="link" to="/trainer/courses">
          العودة إلى الدورات
        </Link>
      </div>
    );
  }

  const program = data?.program;
  const activeTab = visibleTabs.some((t) => t.id === tab) ? tab : 'overview';
  const canManageSessions = permissions.canManageSessions !== false;
  const canManageAttendance = permissions.canManageAttendance !== false;
  const canManageTasks = permissions.canManageTasks !== false;
  const canManageAssessments = permissions.canManageAssessments !== false;

  return (
    <div className="page page--dashboard crud-page" dir="rtl">
      <AdminPageHeader
        breadcrumb={
          <>
            <Link to="/trainer/courses">الدورات التدريبية</Link>
            <span aria-hidden> / </span>
            <span>{program?.title || 'الدورة'}</span>
          </>
        }
        title={program?.title || 'الدورة التدريبية'}
        description={data?.organization?.name || 'بوابة المؤسسات'}
        actions={
          <>
            <StatusBadge variant="info">{program?.status || '—'}</StatusBadge>
            {data?.isLeadTrainer ? <StatusBadge variant="success">مدرب رئيسي</StatusBadge> : null}
          </>
        }
      />

      <div className="admin-tabs" role="tablist" aria-label="أقسام الدورة">
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={activeTab === item.id}
            className={`admin-tabs__btn${activeTab === item.id ? ' admin-tabs__btn--active' : ''}`}
            onClick={() => selectTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' ? (
        <SectionCard title="نظرة عامة">
          <dl className="detail-list">
            <div className="detail-list__row">
              <dt>الوصف</dt>
              <dd>{program?.description || '—'}</dd>
            </div>
            <div className="detail-list__row">
              <dt>الأهداف</dt>
              <dd>{program?.objectives || '—'}</dd>
            </div>
            <div className="detail-list__row">
              <dt>المخرجات</dt>
              <dd>{program?.outcomes || '—'}</dd>
            </div>
            <div className="detail-list__row">
              <dt>عدد المتدربين</dt>
              <dd>{data?.traineeCount ?? 0}</dd>
            </div>
            <div className="detail-list__row">
              <dt>ساعات التدريب</dt>
              <dd>{program?.requiredHours ?? '—'}</dd>
            </div>
            <div className="detail-list__row">
              <dt>الجلسة القادمة</dt>
              <dd>
                {data?.overview?.upcomingSession
                  ? `${data.overview.upcomingSession.title} — ${formatDate(data.overview.upcomingSession.startsAt)}`
                  : '—'}
              </dd>
            </div>
            <div className="detail-list__row">
              <dt>الجلسات المكتملة</dt>
              <dd>
                {data?.overview?.completedSessions ?? 0} / {data?.overview?.totalSessions ?? 0}
              </dd>
            </div>
            <div className="detail-list__row">
              <dt>التسليمات المعلقة</dt>
              <dd>{data?.overview?.pendingSubmissions ?? 0}</dd>
            </div>
            <div className="detail-list__row">
              <dt>متدربون يحتاجون متابعة</dt>
              <dd>{data?.overview?.atRiskCount ?? 0}</dd>
            </div>
          </dl>
        </SectionCard>
      ) : null}

      {activeTab === 'cohorts' ? (
        <SectionCard title="الدفعات المسندة">
          {data?.cohorts?.length ? (
            <ul className="simple-list">
              {data.cohorts.map((cohort) => (
                <li key={cohort.id}>
                  <strong>{cohort.name}</strong>{' '}
                  <StatusBadge variant="info">{cohort.status}</StatusBadge>
                  <div style={{ opacity: 0.75, marginTop: '0.25rem' }}>
                    {formatDate(cohort.startDate)} — {formatDate(cohort.endDate)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد دفعات" description="لا توجد دفعات ضمن نطاق تعيينك." />
          )}
        </SectionCard>
      ) : null}

      {message ? <p className="auth-register__helper">{message}</p> : null}

      {activeTab === 'sessions' ? (
        <SectionCard title="الجلسات">
          {!canManageSessions ? (
            <StatusBadge variant="muted">عرض فقط — لا تملك صلاحية إدارة الجلسات</StatusBadge>
          ) : (
            <form
              className="crud-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await createSession(sessionForm.cohort_id, {
                    title: sessionForm.title.trim(),
                    starts_at: sessionForm.starts_at,
                    ends_at: sessionForm.ends_at,
                    hours: Number(sessionForm.hours) || null,
                    location: sessionForm.location || null,
                  });
                  setMessage('تم إنشاء الجلسة.');
                  setSessionForm((p) => ({ ...p, title: '', starts_at: '', ends_at: '', location: '' }));
                  await refresh();
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر إنشاء الجلسة.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="auth-form__fields-grid">
                <FormSelect
                  id="session-cohort"
                  label="الدفعة"
                  required
                  value={sessionForm.cohort_id}
                  onChange={(e) => setSessionForm((p) => ({ ...p, cohort_id: e.target.value }))}
                >
                  <option value="">اختر دفعة</option>
                  {(data?.cohorts || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </FormSelect>
                <FormInput
                  id="session-title"
                  label="عنوان الجلسة"
                  required
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm((p) => ({ ...p, title: e.target.value }))}
                />
                <FormInput
                  id="session-start"
                  label="البداية"
                  type="datetime-local"
                  required
                  value={sessionForm.starts_at}
                  onChange={(e) => setSessionForm((p) => ({ ...p, starts_at: e.target.value }))}
                />
                <FormInput
                  id="session-end"
                  label="النهاية"
                  type="datetime-local"
                  required
                  value={sessionForm.ends_at}
                  onChange={(e) => setSessionForm((p) => ({ ...p, ends_at: e.target.value }))}
                />
                <FormInput
                  id="session-hours"
                  label="الساعات"
                  type="number"
                  value={sessionForm.hours}
                  onChange={(e) => setSessionForm((p) => ({ ...p, hours: e.target.value }))}
                />
                <FormInput
                  id="session-location"
                  label="الموقع"
                  value={sessionForm.location}
                  onChange={(e) => setSessionForm((p) => ({ ...p, location: e.target.value }))}
                />
              </div>
              <Button type="submit" variant="primary" disabled={busy || !sessionForm.title.trim()}>
                إنشاء جلسة
              </Button>
            </form>
          )}
          {data?.sessions?.length ? (
            <ul className="simple-list">
              {data.sessions.map((session) => (
                <li key={session.id}>
                  <strong>{session.title}</strong>{' '}
                  <StatusBadge variant="info">{session.status}</StatusBadge>
                  <div dir="ltr">{formatDate(session.startsAt)}</div>
                  {session.location ? <div>المكان: {session.location}</div> : null}
                  {canManageAttendance ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError('');
                        try {
                          const win = await openAttendanceWindow(session.id, {
                            duration_seconds: 600,
                          });
                          setLastAttendanceCode(win.code || '');
                          setMessage(`تم فتح نافذة الحضور. الرمز: ${win.code}`);
                          await listSessionAttendance(session.id);
                        } catch (err) {
                          setError(getApiErrorMessage(err, 'تعذر فتح نافذة الحضور.'));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      فتح نافذة الحضور
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد جلسات" description="أنشئ جلسة ضمن دفعة مسندة إليك." />
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'attendance' ? (
        <SectionCard title="الحضور">
          {!canManageAttendance ? (
            <StatusBadge variant="muted">عرض فقط — لا تملك صلاحية إدارة الحضور</StatusBadge>
          ) : null}
          <p>
            سجلات الحضور غير المؤكدة ضمن نطاقك:{' '}
            <strong>{data?.overview?.unconfirmedAttendance ?? 0}</strong>
          </p>
          {lastAttendanceCode ? (
            <p className="auth-register__helper">
              آخر رمز حضور تم إنشاؤه: <strong dir="ltr">{lastAttendanceCode}</strong>
            </p>
          ) : (
            <p className="auth-register__helper">
              افتح نافذة الحضور من تبويب الجلسات. الرمز يُعرض مرة واحدة فقط من استجابة الخادم.
            </p>
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'materials' ? (
        <SectionCard title="المواد التدريبية">
          {permissions.canManageMaterials === false ? (
            <StatusBadge variant="muted">لا تملك صلاحية إدارة المواد</StatusBadge>
          ) : (
            <form
              className="crud-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await createProgramMaterial(programId, {
                    title: materialForm.title.trim(),
                    url: materialForm.url.trim(),
                    material_type: 'LINK',
                    is_published: true,
                  });
                  setMaterialForm({ title: '', url: '' });
                  setMessage('تم إضافة المادة.');
                  await refresh();
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر إضافة المادة.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="auth-form__fields-grid">
                <FormInput
                  id="material-title"
                  label="عنوان المادة"
                  required
                  value={materialForm.title}
                  onChange={(e) => setMaterialForm((p) => ({ ...p, title: e.target.value }))}
                />
                <FormInput
                  id="material-url"
                  label="الرابط"
                  required
                  value={materialForm.url}
                  onChange={(e) => setMaterialForm((p) => ({ ...p, url: e.target.value }))}
                />
              </div>
              <Button type="submit" variant="primary" disabled={busy}>
                إضافة مادة
              </Button>
            </form>
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'tasks' ? (
        <SectionCard title="المهمات">
          {!canManageTasks ? (
            <StatusBadge variant="muted">عرض فقط — لا تملك صلاحية إدارة المهمات</StatusBadge>
          ) : (
            <form
              className="crud-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await createTask(programId, {
                    title: taskForm.title.trim(),
                    instructions: taskForm.instructions || null,
                    publish: true,
                    is_required: true,
                  });
                  setTaskForm({ title: '', instructions: '' });
                  setMessage('تم إنشاء المهمة.');
                  await refresh();
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر إنشاء المهمة.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <FormInput
                id="task-title"
                label="عنوان المهمة"
                required
                value={taskForm.title}
                onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))}
              />
              <FormTextarea
                id="task-instructions"
                label="التعليمات"
                value={taskForm.instructions}
                onChange={(e) => setTaskForm((p) => ({ ...p, instructions: e.target.value }))}
              />
              <Button type="submit" variant="primary" disabled={busy || !taskForm.title.trim()}>
                إنشاء ونشر مهمة
              </Button>
            </form>
          )}
          {data?.tasks?.length ? (
            <ul className="simple-list">
              {data.tasks.map((task) => (
                <li key={task.id}>
                  <strong>{task.title}</strong>{' '}
                  {task.isFinal ? <StatusBadge variant="warning">مهمة نهائية</StatusBadge> : null}
                  <div>الموعد: {formatDate(task.deadline)}</div>
                  <div>
                    {task.isPublished ? 'منشورة' : 'مسودة'} — تقييم: {task.gradingMode || '—'}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد مهمات" description="أنشئ مهمة ونشرها للمتدربين." />
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'assessments' ? (
        <SectionCard title="الاختبارات">
          {!canManageAssessments ? (
            <StatusBadge variant="muted">عرض فقط — لا تملك صلاحية إدارة الاختبارات</StatusBadge>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <Button
              type="button"
              variant={assessmentKind === 'pre' ? 'primary' : 'outline'}
              onClick={async () => {
                setAssessmentKind('pre');
                try {
                  const rows = await listProgramAssessments(programId);
                  setAssessments(Array.isArray(rows) ? rows : []);
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر تحميل الاختبارات.'));
                }
              }}
            >
              الاختبار القبلي
            </Button>
            <Button
              type="button"
              variant={assessmentKind === 'post' ? 'primary' : 'outline'}
              onClick={async () => {
                setAssessmentKind('post');
                try {
                  const rows = await listProgramAssessments(programId);
                  setAssessments(Array.isArray(rows) ? rows : []);
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر تحميل الاختبارات.'));
                }
              }}
            >
              الاختبار البعدي
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  const rows = await listProgramAssessments(programId);
                  setAssessments(Array.isArray(rows) ? rows : []);
                  const cmp = await getPrePostComparison(programId);
                  setComparison(cmp);
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر تحميل المقارنة.'));
                }
              }}
            >
              تحديث / مقارنة
            </Button>
          </div>
          <TrainingAssessmentEditor
            programId={programId}
            kind={assessmentKind}
            assessment={
              assessments.find((a) =>
                assessmentKind === 'pre' ? a.kind === 'PRE_TEST' : a.kind === 'POST_TEST'
              ) || null
            }
            readOnly={!canManageAssessments}
            titleFallback={assessmentKind === 'pre' ? 'اختبار قبلي' : 'اختبار بعدي'}
            onSaved={async () => {
              const rows = await listProgramAssessments(programId);
              setAssessments(Array.isArray(rows) ? rows : []);
              setMessage('تم تحديث الاختبار.');
            }}
          />
          {comparison?.items?.length ? (
            <ul className="simple-list" style={{ marginTop: '1rem' }}>
              {comparison.items.map((row) => (
                <li key={row.enrollmentId}>
                  <strong>{row.traineeName}</strong> — قبلي: {row.preScore ?? '—'}% — بعدي:{' '}
                  {row.postScore ?? '—'}%
                </li>
              ))}
            </ul>
          ) : null}
        </SectionCard>
      ) : null}

      {activeTab === 'trainees' ? (
        <SectionCard title="المتدربون">
          {data?.trainees?.length ? (
            <ul className="simple-list">
              {data.trainees.map((trainee) => (
                <li key={trainee.enrollmentId}>
                  <strong>{trainee.fullName}</strong>{' '}
                  <StatusBadge variant="info">{trainee.status}</StatusBadge>
                  <div>{trainee.cohortName || '—'}</div>
                  {trainee.progress ? (
                    <div>
                      التقدم: {trainee.progress.completionPct}% — الحضور:{' '}
                      {trainee.progress.attendancePct}%
                      {trainee.progress.atRisk ? (
                        <>
                          {' '}
                          <StatusBadge variant="danger">يحتاج متابعة</StatusBadge>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا يوجد متدربون" description="يظهر هنا متدربو الدورات المسندة فقط." />
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'progress' ? (
        <SectionCard title="التقدم">
          {data?.progressRows?.length ? (
            <ul className="simple-list">
              {data.progressRows.map((row) => (
                <li key={row.enrollmentId}>
                  <strong>{row.fullName}</strong>
                  <div>
                    الإكمال: {row.progress?.completionPct ?? 0}% — الساعات:{' '}
                    {row.progress?.hoursCompleted ?? 0}
                    {row.progress?.hoursRequired != null ? ` / ${row.progress.hoursRequired}` : ''}
                  </div>
                  <div>الحالة: {row.progress?.status || row.status}</div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد بيانات تقدم" description="التقدم يظهر ضمن نطاق تعيينك فقط." />
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'reports' ? (
        <SectionCard title="تقارير الدورة">
          {data?.reportsSummary ? (
            <dl className="detail-list">
              <div className="detail-list__row">
                <dt>المتدربون</dt>
                <dd>{data.reportsSummary.traineeCount}</dd>
              </div>
              <div className="detail-list__row">
                <dt>الجلسات</dt>
                <dd>
                  {data.reportsSummary.completedSessions} / {data.reportsSummary.totalSessions}
                </dd>
              </div>
              <div className="detail-list__row">
                <dt>تسليمات معلقة</dt>
                <dd>{data.reportsSummary.pendingSubmissions}</dd>
              </div>
              <div className="detail-list__row">
                <dt>حضور غير مؤكد</dt>
                <dd>{data.reportsSummary.unconfirmedAttendance}</dd>
              </div>
              <div className="detail-list__row">
                <dt>يحتاجون متابعة</dt>
                <dd>{data.reportsSummary.atRiskCount}</dd>
              </div>
            </dl>
          ) : (
            <EmptyState title="التقارير غير متاحة" description="لا تملك صلاحية عرض تقارير هذه الدورة." />
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
