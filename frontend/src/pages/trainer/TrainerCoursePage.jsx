import { useCallback, useEffect, useMemo, useState } from 'react';
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
  createSession,
  getPrePostComparison,
  getCompletionReadiness,
  listProgramAssessments,
  listSessionAttendance,
  markAllPresent,
  openAttendanceWindow,
  setAttendanceStatus,
  updateProgram,
  updateSession,
  getProgramEvaluation,
  getEnrollmentCertificate,
} from '../../features/training/training.service.js';
import { CourseMaterialsManager } from '../../features/training/components/CourseMaterialsManager.jsx';
import { RecordedLecturesManager } from '../../features/training/components/RecordedLecturesManager.jsx';
import { CourseTasksManager } from '../../features/training/components/CourseTasksManager.jsx';
import { TrainingAssessmentEditor } from '../../features/training/components/TrainingAssessmentEditor.jsx';
import { TrainingReadinessCard } from '../../features/training/components/completion/TrainingReadinessCard.jsx';
import { CompletionStatusBadge } from '../../features/training/components/completion/CompletionStatusBadge.jsx';
import { TrainingFinalizationModal } from '../../features/training/components/completion/TrainingFinalizationModal.jsx';
import { CourseReportDashboard } from '../../features/training/components/reports/CourseReportDashboard.jsx';
import { IndividualReportView } from '../../features/training/components/reports/IndividualReportView.jsx';
import { AppModal } from '../../components/designSystem/AppModal.jsx';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

const TABS = [
  { id: 'overview', label: 'نظرة عامة', perm: null },
  { id: 'trainees', label: 'المتدربون', perm: 'canViewTrainees' },
  { id: 'sessions', label: 'الجلسات', perm: 'canManageSessions', readFallback: true },
  { id: 'attendance', label: 'الحضور', perm: 'canManageAttendance', readFallback: true },
  { id: 'lectures', label: 'المحاضرات المسجلة', perm: 'canManageMaterials', readFallback: true },
  { id: 'materials', label: 'المواد التعليمية', perm: 'canManageMaterials', readFallback: true },
  { id: 'tasks', label: 'المهمات', perm: 'canManageTasks', readFallback: true },
  { id: 'assessments', label: 'الاختبارات', perm: 'canManageAssessments', readFallback: true },
  { id: 'progress', label: 'التقدم', perm: 'canViewProgress' },
  { id: 'evaluation', label: 'التقييم النهائي', perm: 'canViewReports', readFallback: true },
  { id: 'finalization', label: 'إنهاء التدريب والتقارير', perm: 'canViewReports' },
  { id: 'certificates', label: 'الشهادات', perm: 'canViewReports', readFallback: true },
  { id: 'settings', label: 'الإعدادات', perm: null },
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
    meeting_url: '',
  });
  const [attendanceSessionId, setAttendanceSessionId] = useState('');
  const [attendanceData, setAttendanceData] = useState(null);
  const [settingsForm, setSettingsForm] = useState({
    description: '',
    objectives: '',
    outcomes: '',
    field: '',
  });
  const [evaluation, setEvaluation] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [assessmentKind, setAssessmentKind] = useState('pre');
  const [comparison, setComparison] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState('');
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [reportEnrollmentId, setReportEnrollmentId] = useState(null);
  const [certificatePreview, setCertificatePreview] = useState(null);

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
      setSettingsForm({
        description: course?.program?.description || '',
        objectives: course?.program?.objectives || '',
        outcomes: course?.program?.outcomes || '',
        field: course?.program?.field || '',
      });
      setAttendanceSessionId((prev) => prev || course?.sessions?.[0]?.id || '');
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

  useEffect(() => {
    if (tab !== 'evaluation' || !programId) return;
    getProgramEvaluation(programId)
      .then(setEvaluation)
      .catch((err) => setError(getApiErrorMessage(err, 'تعذر تحميل التقييم النهائي.')));
  }, [tab, programId]);

  useEffect(() => {
    if (!attendanceSessionId || (tab !== 'attendance' && tab !== 'sessions')) return;
    listSessionAttendance(attendanceSessionId)
      .then(setAttendanceData)
      .catch(() => setAttendanceData(null));
  }, [attendanceSessionId, tab]);

  const permissions = data?.permissions || {};

  const loadReadiness = useCallback(async () => {
    if (!programId) return;
    setReadinessLoading(true);
    setReadinessError('');
    try {
      const readinessData = await getCompletionReadiness(programId);
      setReadiness(readinessData);
    } catch (err) {
      setReadinessError(getApiErrorMessage(err, 'تعذر تحميل جاهزية إنهاء التدريب.'));
      setReadiness(null);
    } finally {
      setReadinessLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    if ((tab === 'finalization' || tab === 'certificates') && permissions.canViewReports) {
      loadReadiness();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, programId, permissions.canViewReports]);
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
  const canManageMaterials = permissions.canManageMaterials !== false;
  const canEditSettings = Boolean(data?.assignment || data?.isLeadTrainer || canManageSessions);

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
          <div className="auth-form__fields-grid" style={{ marginBottom: '1rem' }}>
            <p>
              <strong>الحالة:</strong> {program?.status || '—'}
            </p>
            <p>
              <strong>المجال:</strong> {program?.field || '—'}
            </p>
            <p>
              <strong>الساعات:</strong> {program?.requiredHours ?? '—'}
            </p>
            <p>
              <strong>المتدربون:</strong> {data?.traineeCount ?? 0}
            </p>
            <p>
              <strong>تسليمات معلقة:</strong> {data?.overview?.pendingSubmissions ?? 0}
            </p>
            <p>
              <strong>حضور غير معتمد:</strong> {data?.overview?.unconfirmedAttendance ?? 0}
            </p>
          </div>
          <dl className="detail-list">
            <div className="detail-list__row">
              <dt>الوصف</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>{program?.description || '—'}</dd>
            </div>
            <div className="detail-list__row">
              <dt>الأهداف</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>{program?.objectives || '—'}</dd>
            </div>
            <div className="detail-list__row">
              <dt>المخرجات</dt>
              <dd style={{ whiteSpace: 'pre-wrap' }}>{program?.outcomes || '—'}</dd>
            </div>
          </dl>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
            <Button type="button" variant="primary" onClick={() => navigate(`/trainer/courses/${programId}/edit`)}>
              تعديل معلومات الدورة
            </Button>
            <Button type="button" variant="outline" onClick={() => selectTab('sessions')}>
              إدارة الجلسات
            </Button>
            <Button type="button" variant="outline" onClick={() => selectTab('lectures')}>
              إدارة المحاضرات المسجلة
            </Button>
            <Button type="button" variant="outline" onClick={() => selectTab('materials')}>
              إدارة المواد التعليمية
            </Button>
            <Button type="button" variant="outline" onClick={() => selectTab('tasks')}>
              إدارة المهمات
            </Button>
            <Button type="button" variant="outline" onClick={() => selectTab('assessments')}>
              إدارة الاختبارات
            </Button>
            <Button type="button" variant="outline" onClick={() => selectTab('finalization')}>
              إنهاء التدريب
            </Button>
          </div>
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
                    meeting_url: sessionForm.meeting_url || null,
                  });
                  setMessage('تم إنشاء الجلسة.');
                  setSessionForm((p) => ({
                    ...p,
                    title: '',
                    starts_at: '',
                    ends_at: '',
                    location: '',
                    meeting_url: '',
                  }));
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
                <FormInput
                  id="session-meeting"
                  label="رابط الاجتماع"
                  value={sessionForm.meeting_url}
                  onChange={(e) => setSessionForm((p) => ({ ...p, meeting_url: e.target.value }))}
                />
              </div>
              <Button type="submit" variant="primary" disabled={busy || !sessionForm.title.trim()}>
                إضافة جلسة
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
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
                              duration_seconds: 120,
                            });
                            setLastAttendanceCode(win.code || '');
                            setAttendanceSessionId(session.id);
                            setMessage(`تم فتح نافذة الحضور (دقيقتان). الرمز: ${win.code}`);
                            const att = await listSessionAttendance(session.id);
                            setAttendanceData(att);
                          } catch (err) {
                            setError(getApiErrorMessage(err, 'تعذر فتح نافذة الحضور.'));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        فتح الحضور
                      </Button>
                    ) : null}
                    {canManageSessions ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="btn--sm"
                        disabled={busy}
                        onClick={async () => {
                          if (!window.confirm('تأكيد إلغاء هذه الجلسة؟')) return;
                          setBusy(true);
                          try {
                            await updateSession(session.id, { status: 'CANCELLED' });
                            setMessage('تم إلغاء الجلسة.');
                            await refresh();
                          } catch (err) {
                            setError(getApiErrorMessage(err, 'تعذر إلغاء الجلسة.'));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        إلغاء الجلسة
                      </Button>
                    ) : null}
                  </div>
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
          <FormSelect
            id="attendance-session"
            label="الجلسة"
            value={attendanceSessionId}
            onChange={(e) => setAttendanceSessionId(e.target.value)}
          >
            <option value="">اختر جلسة</option>
            {(data?.sessions || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </FormSelect>
          {canManageAttendance && attendanceSessionId ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', margin: '0.75rem 0' }}>
              <Button
                type="button"
                variant="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const win = await openAttendanceWindow(attendanceSessionId, { duration_seconds: 120 });
                    setLastAttendanceCode(win.code || '');
                    setMessage(`نافذة حضور مفتوحة لدقيقتين. الرمز: ${win.code}`);
                    setAttendanceData(await listSessionAttendance(attendanceSessionId));
                  } catch (err) {
                    setError(getApiErrorMessage(err, 'تعذر فتح نافذة الحضور.'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                فتح الحضور (دقيقتان)
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  if (!window.confirm('تأكيد تعليم جميع المتدربين المؤهلين حاضرين؟')) return;
                  setBusy(true);
                  try {
                    const result = await markAllPresent(attendanceSessionId, { mode: 'safe' });
                    setMessage(`تم تحديث ${result?.updated ?? 0} سجل حضور.`);
                    setAttendanceData(await listSessionAttendance(attendanceSessionId));
                  } catch (err) {
                    setError(getApiErrorMessage(err, 'تعذر تعليم الجميع حاضرين.'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                تعليم الجميع حاضرين
              </Button>
            </div>
          ) : null}
          {lastAttendanceCode ? (
            <p className="auth-register__helper">
              آخر رمز حضور: <strong dir="ltr">{lastAttendanceCode}</strong>
            </p>
          ) : null}
          {attendanceData?.records?.length ? (
            <ul className="simple-list">
              {attendanceData.records.map((row) => {
                const trainee = (data?.trainees || []).find((t) => t.enrollmentId === row.enrollmentId);
                return (
                  <li key={row.id || `${row.enrollmentId}-${row.status}`}>
                    <strong>{trainee?.fullName || row.enrollmentId}</strong>{' '}
                    <StatusBadge variant="info">{row.status}</StatusBadge>
                    {canManageAttendance ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.35rem' }}>
                        {['present', 'absent', 'late', 'excused'].map((status) => (
                          <Button
                            key={status}
                            type="button"
                            variant="outline"
                            className="btn--sm"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await setAttendanceStatus(attendanceSessionId, {
                                  enrollment_id: row.enrollmentId,
                                  status,
                                });
                                setAttendanceData(await listSessionAttendance(attendanceSessionId));
                                setMessage('تم تحديث الحضور.');
                              } catch (err) {
                                setError(getApiErrorMessage(err, 'تعذر تحديث الحضور.'));
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            {status === 'present'
                              ? 'حاضر'
                              : status === 'absent'
                                ? 'غائب'
                                : status === 'late'
                                  ? 'متأخر'
                                  : 'معذور'}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="auth-register__helper">لا توجد سجلات حضور لهذه الجلسة بعد.</p>
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'lectures' ? (
        <SectionCard title="المحاضرات المسجلة">
          <RecordedLecturesManager
            programId={programId}
            canManage={canManageMaterials}
            sessions={(data?.sessions || []).map((s) => ({ id: s.id, title: s.title }))}
            viewBasePath={`/trainer/courses/${programId}/lectures`}
          />
        </SectionCard>
      ) : null}

      {activeTab === 'materials' ? (
        <SectionCard title="المواد التعليمية">
          <CourseMaterialsManager programId={programId} canManage={canManageMaterials} />
        </SectionCard>
      ) : null}

      {activeTab === 'tasks' ? (
        <SectionCard title="المهمات">
          <CourseTasksManager programId={programId} canManage={canManageTasks} />
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

      {activeTab === 'evaluation' ? (
        <SectionCard title="التقييم النهائي">
          {evaluation ? (
            <dl className="detail-list">
              <div className="detail-list__row">
                <dt>نسبة الاستجابة</dt>
                <dd>{evaluation.responseRate ?? evaluation.stats?.responseRate ?? '—'}</dd>
              </div>
              <div className="detail-list__row">
                <dt>متوسط التقييم</dt>
                <dd>{evaluation.averageRating ?? evaluation.stats?.averageRating ?? '—'}</dd>
              </div>
              <div className="detail-list__row">
                <dt>NPS</dt>
                <dd>{evaluation.nps ?? evaluation.stats?.nps ?? '—'}</dd>
              </div>
              <div className="detail-list__row">
                <dt>المكتمل / الإجمالي</dt>
                <dd>
                  {evaluation.submittedCount ?? evaluation.stats?.submittedCount ?? '—'} /{' '}
                  {evaluation.assignedCount ?? evaluation.stats?.assignedCount ?? '—'}
                </dd>
              </div>
            </dl>
          ) : (
            <EmptyState title="لا توجد بيانات تقييم" description="ستظهر إحصاءات التقييم النهائي هنا عند توفرها." />
          )}
        </SectionCard>
      ) : null}

      {activeTab === 'finalization' ? (
        <>
          <SectionCard
            title="إنهاء التدريب والتقارير"
            actions={
              permissions.canFinalizeTraining ? (
                <Button type="button" variant="primary" onClick={() => setFinalizeModalOpen(true)}>
                  إنهاء التدريب
                </Button>
              ) : (
                <StatusBadge variant="muted">لا تملك صلاحية إنهاء التدريب</StatusBadge>
              )
            }
          >
            {readinessLoading ? (
              <LoadingSpinner label="جاري تحميل الجاهزية" />
            ) : readinessError ? (
              <p className="form-field__error" role="alert">
                {readinessError}
              </p>
            ) : readiness ? (
              <>
                <TrainingReadinessCard counts={readiness.counts} />
                <ul className="simple-list">
                  {(readiness.trainees || []).map((t) => (
                    <li key={t.enrollmentId}>
                      <strong>{t.fullName}</strong> <CompletionStatusBadge status={t.lifecycleStatus} />
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          className="btn--sm"
                          onClick={() => setReportEnrollmentId(t.enrollmentId)}
                        >
                          التقرير الفردي
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </SectionCard>

          <SectionCard title="تقرير الدورة">
            <CourseReportDashboard programId={programId} canGenerate={Boolean(permissions.canViewReports)} />
          </SectionCard>

          <TrainingFinalizationModal
            open={finalizeModalOpen}
            onClose={() => setFinalizeModalOpen(false)}
            programId={programId}
            cohorts={data?.cohorts || []}
            canExceptional={false}
            onFinalized={() => {
              setMessage('تم تنفيذ إجراء إنهاء التدريب.');
              loadReadiness();
            }}
          />

          <AppModal
            open={Boolean(reportEnrollmentId)}
            onClose={() => setReportEnrollmentId(null)}
            title="التقرير الفردي"
            size="lg"
          >
            {reportEnrollmentId ? (
              <IndividualReportView enrollmentId={reportEnrollmentId} canGenerate={Boolean(permissions.canViewReports)} />
            ) : null}
          </AppModal>
        </>
      ) : null}

      {activeTab === 'certificates' ? (
        <SectionCard title="الشهادات">
          {(readiness?.trainees || data?.trainees || []).length ? (
            <ul className="simple-list">
              {(readiness?.trainees || data?.trainees || []).map((t) => (
                <li key={t.enrollmentId}>
                  <strong>{t.fullName}</strong>
                  <div>
                    الأهلية: {t.certificateEligible || t.progress?.certificateEligible ? 'مؤهل' : 'غير مؤهل / قيد التحقق'}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="btn--sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const cert = await getEnrollmentCertificate(t.enrollmentId);
                        setCertificatePreview(cert);
                        setMessage('تم تحميل بيانات الشهادة.');
                      } catch (err) {
                        setCertificatePreview(null);
                        setError(getApiErrorMessage(err, 'لا توجد شهادة صادرة لهذا المتدرب.'));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    عرض الشهادة
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد شهادات للعرض" description="ستظهر الشهادات بعد أهلية المتدربين." />
          )}
          {certificatePreview ? (
            <dl className="detail-list" style={{ marginTop: '1rem' }}>
              <div className="detail-list__row">
                <dt>رقم الشهادة</dt>
                <dd dir="ltr">{certificatePreview.certificateNumber}</dd>
              </div>
              <div className="detail-list__row">
                <dt>رمز التحقق</dt>
                <dd dir="ltr">{certificatePreview.verificationCode}</dd>
              </div>
              <div className="detail-list__row">
                <dt>الحالة</dt>
                <dd>{certificatePreview.status}</dd>
              </div>
            </dl>
          ) : null}
          <p className="auth-register__helper" style={{ marginTop: '0.75rem' }}>
            إصدار الشهادات يبقى لمسؤول المؤسسة / سوبر أدمن وفق قواعد الحوكمة الحالية.
          </p>
        </SectionCard>
      ) : null}

      {activeTab === 'settings' ? (
        <SectionCard title="الإعدادات التشغيلية">
          {!canEditSettings ? (
            <StatusBadge variant="muted">عرض فقط</StatusBadge>
          ) : (
            <form
              className="crud-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await updateProgram(programId, {
                    description: settingsForm.description || null,
                    objectives: settingsForm.objectives || null,
                    outcomes: settingsForm.outcomes || null,
                    field: settingsForm.field || null,
                  });
                  setMessage('تم حفظ الإعدادات التشغيلية.');
                  await refresh();
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر حفظ الإعدادات.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <FormInput
                id="settings-field"
                label="المجال"
                value={settingsForm.field}
                onChange={(e) => setSettingsForm((p) => ({ ...p, field: e.target.value }))}
              />
              <FormTextarea
                id="settings-description"
                label="الوصف"
                value={settingsForm.description}
                onChange={(e) => setSettingsForm((p) => ({ ...p, description: e.target.value }))}
              />
              <FormTextarea
                id="settings-objectives"
                label="الأهداف"
                value={settingsForm.objectives}
                onChange={(e) => setSettingsForm((p) => ({ ...p, objectives: e.target.value }))}
              />
              <FormTextarea
                id="settings-outcomes"
                label="المخرجات"
                value={settingsForm.outcomes}
                onChange={(e) => setSettingsForm((p) => ({ ...p, outcomes: e.target.value }))}
              />
              <Button type="submit" variant="primary" disabled={busy}>
                حفظ الإعدادات التشغيلية
              </Button>
            </form>
          )}
          <p className="auth-register__helper">
            لا يمكن للمدرب تغيير ملكية الدورة أو حذفها أو تنفيذ إجراءات إدارية عالية الخطورة.
          </p>
        </SectionCard>
      ) : null}
    </div>
  );
}
