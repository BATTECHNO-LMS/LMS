import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BookOpen,
  Users,
  Layers,
  CalendarDays,
  ClipboardCheck,
  FileCheck,
  ListChecks,
  BarChart3,
  Settings,
  FileBarChart2,
  Clock3,
  UserRound,
  Target,
} from 'lucide-react';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { AdminStatsGrid } from '../../../components/admin/AdminStatsGrid.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { StatCard } from '../../../components/common/StatCard.jsx';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormSelect } from '../../../components/forms/FormSelect.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import {
  approveCompletion,
  createCohort,
  createSession,
  createTask,
  enrollUser,
  getEnrollmentProgress,
  getProgram,
  issueCertificate,
  listCohortSessions,
  listCohorts,
  listEnrollments,
  getPrePostComparison,
  listProgramAssessments,
  listProgramTasks,
  listSessionAttendance,
  openAttendanceWindow,
  publishProgram,
  recomputeProgress,
  updateProgram,
  getCompletionReadiness,
} from '../../../features/training/training.service.js';
import {
  assignTrainerToCourse,
  listTrainerAssignments,
  revokeTrainerAssignment,
} from '../../../features/training/trainer.service.js';
import { listBranches, listMembers } from '../../../features/organizations/organizations.service.js';
import { isAdminRole } from '../../../utils/helpers.js';
import { TrainingAssessmentEditor } from '../../../features/training/components/TrainingAssessmentEditor.jsx';
import { TrainingReadinessCard } from '../../../features/training/components/completion/TrainingReadinessCard.jsx';
import { CompletionStatusBadge } from '../../../features/training/components/completion/CompletionStatusBadge.jsx';
import { TrainingFinalizationModal } from '../../../features/training/components/completion/TrainingFinalizationModal.jsx';
import { CourseReportDashboard } from '../../../features/training/components/reports/CourseReportDashboard.jsx';
import { IndividualReportView } from '../../../features/training/components/reports/IndividualReportView.jsx';
import { CourseMaterialsManager } from '../../../features/training/components/CourseMaterialsManager.jsx';
import { RecordedLecturesManager } from '../../../features/training/components/RecordedLecturesManager.jsx';
import { CourseTasksManager } from '../../../features/training/components/CourseTasksManager.jsx';
import { AppModal } from '../../../components/designSystem/AppModal.jsx';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { useAuth } from '../../../features/auth/index.js';

const TABS = [
  { id: 'overview', label: 'نظرة عامة', icon: BookOpen },
  { id: 'cohorts', label: 'الدفعات', icon: Layers },
  { id: 'trainers', label: 'المدربون', icon: Users },
  { id: 'trainees', label: 'المتدربون', icon: Users },
  { id: 'sessions', label: 'الجلسات', icon: CalendarDays },
  { id: 'attendance', label: 'الحضور', icon: ClipboardCheck },
  { id: 'lectures', label: 'المحاضرات المسجلة', icon: FileCheck },
  { id: 'materials', label: 'المواد التعليمية', icon: ListChecks },
  { id: 'tasks', label: 'المهمات', icon: ListChecks },
  { id: 'pretest', label: 'الاختبار القبلي', icon: FileCheck },
  { id: 'posttest', label: 'الاختبار البعدي', icon: FileCheck },
  { id: 'progress', label: 'التقدم والساعات', icon: BarChart3 },
  { id: 'finalization', label: 'إنهاء التدريب والتقارير', icon: FileBarChart2 },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
];

function statusLabel(status) {
  const map = {
    DRAFT: 'مسودة',
    PUBLISHED: 'منشورة',
    REGISTRATION_OPEN: 'التسجيل مفتوح',
    REGISTRATION_CLOSED: 'التسجيل مغلق',
    IN_PROGRESS: 'قيد التنفيذ',
    COMPLETED: 'مكتملة',
    CANCELLED: 'ملغاة',
    ARCHIVED: 'مؤرشفة',
  };
  return map[status] || status || '—';
}

function formatDateAr(value) {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T12:00:00+03:00`;
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Amman',
    }).format(new Date(iso));
  } catch {
    return raw;
  }
}

function formatDateRangeShort(start, end) {
  const s = formatDateAr(start);
  const e = formatDateAr(end);
  if (s && e) {
    const startShort = s.replace(/\s*2026\s*$/, '').trim();
    return `${startShort} – ${e}`;
  }
  if (s) return s;
  if (e) return e;
  return '—';
}

function parseDomains(course) {
  if (Array.isArray(course?.domains) && course.domains.length) {
    return course.domains.map((d) => String(d).trim()).filter(Boolean);
  }
  return String(course?.field || '')
    .split(/[،,•|]/)
    .map((d) => d.trim())
    .filter(Boolean);
}

function MultilineBlock({ text }) {
  if (!text) return <p className="muted">—</p>;
  const lines = String(text)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{text}</p>;
  return (
    <ul style={{ margin: 0, paddingInlineStart: '1.25rem', lineHeight: 1.85 }}>
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

export function AdminTrainingCourseDetailPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const readOnly = Boolean(user?.role === 'reviewer');
  const isAdmin = isAdminRole(user?.role);
  const [tab, setTab] = useState('overview');
  const [readiness, setReadiness] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState('');
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [reportEnrollmentId, setReportEnrollmentId] = useState(null);
  const [course, setCourse] = useState(null);
  const [cohorts, setCohorts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [selectedCohortId, setSelectedCohortId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [cohortForm, setCohortForm] = useState({
    name: '',
    branch_id: '',
    start_date: '',
    end_date: '',
    capacity: '',
    status: 'DRAFT',
  });
  const [sessionForm, setSessionForm] = useState({
    title: '',
    starts_at: '',
    ends_at: '',
    hours: '',
    location: '',
  });
  const [taskForm, setTaskForm] = useState({ title: '', instructions: '', publish: true });
  const [enrollForm, setEnrollForm] = useState({ user_id: '', status: 'ACTIVE' });
  const [assignForm, setAssignForm] = useState({ trainer_user_id: '', is_lead_trainer: false });
  const [comparison, setComparison] = useState(null);

  const refresh = useCallback(async () => {
    if (!programId) return;
    setLoading(true);
    setError('');
    try {
      const program = await getProgram(programId);
      const [cohortRows, branchRows, trainerRows, assignmentRows, taskRows, assessmentRows] =
        await Promise.all([
          listCohorts(programId),
          listBranches(program.organizationId),
          listMembers(program.organizationId, { role_code: 'trainer' }),
          listTrainerAssignments(program.organizationId),
          listProgramTasks(programId),
          listProgramAssessments(programId),
        ]);
      setCourse(program);
      setCohorts(Array.isArray(cohortRows) ? cohortRows : []);
      setBranches(Array.isArray(branchRows) ? branchRows : []);
      setTrainers(Array.isArray(trainerRows) ? trainerRows : []);
      setAssignments(
        (Array.isArray(assignmentRows) ? assignmentRows : []).filter(
          (a) => String(a.trainingProgramId || a.training_program_id) === String(programId)
        )
      );
      setTasks(Array.isArray(taskRows) ? taskRows : []);
      setAssessments(Array.isArray(assessmentRows) ? assessmentRows : []);
      setSelectedCohortId((prev) => prev || (cohortRows[0]?.id ?? ''));
      const traineeMembers = await listMembers(program.organizationId, { role_code: 'trainee' });
      setTrainees(Array.isArray(traineeMembers) ? traineeMembers : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر تحميل الدورة التدريبية.'));
      setCourse(null);
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedCohortId) {
      setEnrollments([]);
      setSessions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [ens, sess] = await Promise.all([
          listEnrollments(selectedCohortId),
          listCohortSessions(selectedCohortId),
        ]);
        if (!cancelled) {
          setEnrollments(Array.isArray(ens) ? ens : []);
          setSessions(Array.isArray(sess) ? sess : []);
        }
      } catch {
        if (!cancelled) {
          setEnrollments([]);
          setSessions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCohortId]);

  const loadReadiness = useCallback(async () => {
    if (!programId) return;
    setReadinessLoading(true);
    setReadinessError('');
    try {
      const data = await getCompletionReadiness(programId, { cohortId: selectedCohortId || undefined });
      setReadiness(data);
    } catch (err) {
      setReadinessError(getApiErrorMessage(err, 'تعذر تحميل جاهزية إنهاء التدريب.'));
      setReadiness(null);
    } finally {
      setReadinessLoading(false);
    }
  }, [programId, selectedCohortId]);

  useEffect(() => {
    if (tab === 'finalization') {
      loadReadiness();
    }
  }, [tab, loadReadiness]);

  const preAssessment = useMemo(
    () => assessments.find((a) => a.kind === 'PRE_TEST') || null,
    [assessments]
  );
  const postAssessment = useMemo(
    () => assessments.find((a) => a.kind === 'POST_TEST') || null,
    [assessments]
  );

  const domains = useMemo(() => parseDomains(course), [course]);
  const leadTrainer = useMemo(() => {
    if (course?.leadTrainer?.fullName) return course.leadTrainer;
    const lead = assignments.find((a) => a.isLeadTrainer || a.is_lead_trainer);
    if (!lead) return null;
    return {
      fullName:
        lead.trainer?.full_name ||
        lead.trainer?.fullName ||
        lead.trainerName ||
        null,
      email: lead.trainer?.email || null,
      userId: lead.trainerUserId || lead.trainer_user_id,
    };
  }, [course, assignments]);
  const startLabel = formatDateAr(course?.startDate);
  const endLabel = formatDateAr(course?.endDate);

  if (loading) {
    return (
      <div className="page page--dashboard page--admin" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="page page--dashboard page--admin" dir="rtl">
        <p className="form-field__error" role="alert">
          {error || 'الدورة غير موجودة.'}
        </p>
        <Link className="link" to="/admin/training-courses">
          العودة
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page" dir="rtl">
      <AdminPageHeader
        title={course.title}
        description={
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <StatusBadge variant="info">{statusLabel(course.status)}</StatusBadge>
            <span>{course.organizationName || course.organization?.name || 'مؤسسة'}</span>
            {course.code ? (
              <span dir="ltr" style={{ fontFamily: 'ui-monospace, monospace' }}>
                {course.code}
              </span>
            ) : null}
            {startLabel || endLabel ? (
              <span>
                {startLabel || '—'}
                {' إلى '}
                {endLabel || '—'}
              </span>
            ) : null}
          </span>
        }
      />

      <p style={{ marginBottom: '0.75rem' }}>
        <Link className="link" to="/admin/training-courses">
          ← الدورات التدريبية
        </Link>
        {' · '}
        <Link className="link" to={`/admin/institutions/${course.organizationId}`}>
          المؤسسة
        </Link>
      </p>

      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="auth-register__helper">{message}</p> : null}

      <div className="admin-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`btn btn--sm ${tab === t.id ? 'btn--primary' : 'btn--outline'}`}
              onClick={() => setTab(t.id)}
            >
              <Icon size={14} aria-hidden /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' ? (
        <div className="stack-lg" style={{ display: 'grid', gap: '1rem' }}>
          <AdminStatsGrid>
            <StatCard
              label="مدة البرنامج"
              value={formatDateRangeShort(course.startDate, course.endDate)}
              icon={CalendarDays}
            />
            <StatCard
              label="الساعات التدريبية"
              value={
                course.requiredHours != null && course.requiredHours !== ''
                  ? `${Number(course.requiredHours)} ساعة`
                  : '—'
              }
              icon={Clock3}
            />
            <StatCard
              label="نسبة الحضور المطلوبة"
              value={
                course.requiredAttendancePct != null && course.requiredAttendancePct !== ''
                  ? `${Number(course.requiredAttendancePct)}%`
                  : '—'
              }
              icon={ClipboardCheck}
            />
            <StatCard
              label="السعة"
              value={
                course.maxParticipants != null
                  ? `${course.maxParticipants} متدربين`
                  : '—'
              }
              icon={Users}
            />
          </AdminStatsGrid>

          <SectionCard title="تفاصيل الدورة">
            <div
              className="auth-form__fields-grid"
              style={{ alignItems: 'start' }}
            >
              <div className="auth-form__span-full">
                <strong>المجالات</strong>
                {domains.length ? (
                  <p style={{ marginTop: '0.35rem', lineHeight: 1.8 }}>
                    {domains.join(' • ')}
                  </p>
                ) : (
                  <p className="muted" style={{ marginTop: '0.35rem' }}>
                    —
                  </p>
                )}
              </div>

              <div>
                <strong>المدرب الأساسي</strong>
                <p style={{ marginTop: '0.35rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <UserRound size={16} aria-hidden />
                  {leadTrainer?.fullName || 'لم يتم تعيين مدرب أساسي بعد'}
                </p>
              </div>

              <div>
                <strong>رمز الدورة</strong>
                <p style={{ marginTop: '0.35rem' }} dir="ltr">
                  {course.code || '—'}
                </p>
              </div>

              <div>
                <strong>تاريخ البداية</strong>
                <p style={{ marginTop: '0.35rem' }}>{startLabel || '—'}</p>
              </div>
              <div>
                <strong>تاريخ النهاية</strong>
                <p style={{ marginTop: '0.35rem' }}>{endLabel || '—'}</p>
              </div>

              {course.level ? (
                <div>
                  <strong>المستوى</strong>
                  <p style={{ marginTop: '0.35rem' }}>{course.level}</p>
                </div>
              ) : null}
              {course.language ? (
                <div>
                  <strong>اللغة</strong>
                  <p style={{ marginTop: '0.35rem' }}>{course.language}</p>
                </div>
              ) : null}
              {course.deliveryMode ? (
                <div>
                  <strong>طريقة التدريب</strong>
                  <p style={{ marginTop: '0.35rem' }}>{course.deliveryMode}</p>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="الوصف">
            <MultilineBlock text={course.description} />
          </SectionCard>

          <SectionCard title="الأهداف">
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <Target size={18} aria-hidden style={{ marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <MultilineBlock text={course.objectives} />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="المخرجات">
            <MultilineBlock text={course.outcomes} />
          </SectionCard>

          <SectionCard title="المتطلبات">
            <p style={{ margin: 0, lineHeight: 1.8 }}>
              {[
                course.requiresPreTest ? 'اختبار قبلي' : null,
                course.requiresPostTest ? 'اختبار بعدي' : null,
                course.requiresTasks !== false ? 'مهمات' : null,
                course.requiresEvaluation ? 'تقييم نهائي' : null,
              ]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
          </SectionCard>

          <SectionCard title="إدارة المحتوى">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <Button type="button" variant="primary" onClick={() => navigate(`/admin/training-courses/${programId}/edit`)}>
                تعديل معلومات الدورة
              </Button>
              <Button type="button" variant="outline" onClick={() => setTab('sessions')}>
                إدارة الجلسات
              </Button>
              <Button type="button" variant="outline" onClick={() => setTab('lectures')}>
                إدارة المحاضرات المسجلة
              </Button>
              <Button type="button" variant="outline" onClick={() => setTab('materials')}>
                إدارة المواد التعليمية
              </Button>
              <Button type="button" variant="outline" onClick={() => setTab('tasks')}>
                إدارة المهمات
              </Button>
              <Button type="button" variant="outline" onClick={() => setTab('pretest')}>
                إدارة الاختبارات
              </Button>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {tab === 'cohorts' ? (
        <SectionCard title="الدفعات">
          {!readOnly ? (
            <form
              className="crud-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await createCohort(programId, {
                    name: cohortForm.name.trim(),
                    branch_id: cohortForm.branch_id || null,
                    start_date: cohortForm.start_date || null,
                    end_date: cohortForm.end_date || null,
                    capacity: cohortForm.capacity !== '' ? Number(cohortForm.capacity) : null,
                    status: cohortForm.status,
                  });
                  setCohortForm({
                    name: '',
                    branch_id: '',
                    start_date: '',
                    end_date: '',
                    capacity: '',
                    status: 'DRAFT',
                  });
                  setMessage('تم إنشاء الدفعة.');
                  await refresh();
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر إنشاء الدفعة.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="auth-form__fields-grid">
                <FormInput
                  id="cohort-name"
                  label="اسم الدفعة"
                  required
                  value={cohortForm.name}
                  onChange={(e) => setCohortForm((p) => ({ ...p, name: e.target.value }))}
                />
                <FormSelect
                  id="cohort-branch"
                  label="الفرع"
                  value={cohortForm.branch_id}
                  onChange={(e) => setCohortForm((p) => ({ ...p, branch_id: e.target.value }))}
                >
                  <option value="">بدون فرع</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </FormSelect>
                <FormInput
                  id="cohort-start"
                  label="تاريخ البداية"
                  type="date"
                  value={cohortForm.start_date}
                  onChange={(e) => setCohortForm((p) => ({ ...p, start_date: e.target.value }))}
                />
                <FormInput
                  id="cohort-end"
                  label="تاريخ النهاية"
                  type="date"
                  value={cohortForm.end_date}
                  onChange={(e) => setCohortForm((p) => ({ ...p, end_date: e.target.value }))}
                />
                <FormInput
                  id="cohort-capacity"
                  label="السعة"
                  type="number"
                  min="1"
                  value={cohortForm.capacity}
                  onChange={(e) => setCohortForm((p) => ({ ...p, capacity: e.target.value }))}
                />
                <FormSelect
                  id="cohort-status"
                  label="حالة الدفعة"
                  value={cohortForm.status}
                  onChange={(e) => setCohortForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="DRAFT">مسودة</option>
                  <option value="OPEN">مفتوحة</option>
                  <option value="IN_PROGRESS">قيد التنفيذ</option>
                  <option value="COMPLETED">مكتملة</option>
                </FormSelect>
              </div>
              <Button type="submit" variant="primary" disabled={busy || !cohortForm.name.trim()}>
                إنشاء دفعة
              </Button>
            </form>
          ) : null}
          <DataTable
            columns={[
              { key: 'name', label: 'الدفعة', mobileTitle: true },
              { key: 'status', label: 'الحالة' },
              { key: 'capacity', label: 'السعة' },
            ]}
            rows={cohorts.map((c) => ({
              id: c.id,
              name: c.name,
              status: c.status,
              capacity: c.capacity ?? '—',
            }))}
            emptyTitle="لا توجد دفعات"
            emptyDescription="أنشئ دفعة أولى لهذه الدورة."
          />
        </SectionCard>
      ) : null}

      {tab === 'trainers' ? (
        <SectionCard title="المدربون">
          {!readOnly ? (
            <form
              className="crud-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await assignTrainerToCourse(course.organizationId, {
                    trainer_user_id: assignForm.trainer_user_id,
                    training_program_id: programId,
                    is_lead_trainer: assignForm.is_lead_trainer,
                  });
                  setMessage('تم تعيين المدرب.');
                  await refresh();
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر تعيين المدرب.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="auth-form__fields-grid">
                <FormSelect
                  id="trainer"
                  label="المدرب"
                  required
                  value={assignForm.trainer_user_id}
                  onChange={(e) => setAssignForm((p) => ({ ...p, trainer_user_id: e.target.value }))}
                >
                  <option value="">اختر مدربًا</option>
                  {trainers.map((t) => (
                    <option key={t.userId || t.id} value={t.userId || t.id}>
                      {t.fullName || t.full_name || t.email}
                    </option>
                  ))}
                </FormSelect>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={assignForm.is_lead_trainer}
                    onChange={(e) =>
                      setAssignForm((p) => ({ ...p, is_lead_trainer: e.target.checked }))
                    }
                  />
                  مدرب رئيسي
                </label>
              </div>
              <Button type="submit" variant="primary" disabled={busy || !assignForm.trainer_user_id}>
                تعيين مدرب
              </Button>
            </form>
          ) : null}
          <DataTable
            columns={[
              {
                key: 'name',
                label: 'المدرب',
                mobileTitle: true,
                render: (row) => row.name,
              },
              { key: 'lead', label: 'رئيسي' },
              {
                key: 'actions',
                label: 'إجراءات',
                render: (row) =>
                  readOnly ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await revokeTrainerAssignment(course.organizationId, row.id);
                          await refresh();
                        } catch (err) {
                          setError(getApiErrorMessage(err, 'تعذر إلغاء التعيين.'));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      إلغاء
                    </Button>
                  ),
              },
            ]}
            rows={assignments.map((a) => ({
              id: a.id,
              name:
                a.trainer?.full_name ||
                a.trainer?.fullName ||
                a.trainerName ||
                a.trainerUserId ||
                a.trainer_user_id,
              lead: a.isLeadTrainer || a.is_lead_trainer ? 'نعم' : 'لا',
            }))}
            emptyTitle="لا يوجد مدربون مسندون"
            emptyDescription="عيّن مدربًا للدورة."
          />
        </SectionCard>
      ) : null}

      {tab === 'trainees' ? (
        <SectionCard title="المتدربون">
          <FormSelect
            id="enroll-cohort"
            label="الدفعة"
            value={selectedCohortId}
            onChange={(e) => setSelectedCohortId(e.target.value)}
          >
            <option value="">اختر دفعة</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </FormSelect>
          {!readOnly && selectedCohortId ? (
            <form
              className="crud-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await enrollUser(selectedCohortId, {
                    user_id: enrollForm.user_id,
                    status: enrollForm.status,
                  });
                  setMessage('تم تحديث تسجيل المتدرب.');
                  const ens = await listEnrollments(selectedCohortId);
                  setEnrollments(Array.isArray(ens) ? ens : []);
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر تسجيل المتدرب.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="auth-form__fields-grid">
                <FormSelect
                  id="trainee"
                  label="المتدرب"
                  required
                  value={enrollForm.user_id}
                  onChange={(e) => setEnrollForm((p) => ({ ...p, user_id: e.target.value }))}
                >
                  <option value="">اختر متدربًا من المؤسسة</option>
                  {trainees.map((t) => (
                    <option key={t.userId || t.id} value={t.userId || t.id}>
                      {t.fullName || t.full_name || t.email}
                    </option>
                  ))}
                </FormSelect>
                <FormSelect
                  id="enroll-status"
                  label="الحالة"
                  value={enrollForm.status}
                  onChange={(e) => setEnrollForm((p) => ({ ...p, status: e.target.value }))}
                >
                  <option value="INVITED">دعوة</option>
                  <option value="PENDING">بانتظار الموافقة</option>
                  <option value="ACTIVE">نشط</option>
                  <option value="APPROVED">موافق عليه</option>
                  <option value="REJECTED">مرفوض</option>
                  <option value="WITHDRAWN">منسحب</option>
                </FormSelect>
              </div>
              <Button type="submit" variant="primary" disabled={busy || !enrollForm.user_id}>
                إضافة / تحديث تسجيل
              </Button>
            </form>
          ) : null}
          <DataTable
            columns={[
              { key: 'userId', label: 'المتدرب', mobileTitle: true },
              { key: 'status', label: 'الحالة' },
            ]}
            rows={enrollments.map((e) => ({
              id: e.id,
              userId: e.userName || e.user_id || e.fullName || '—',
              status: e.status,
            }))}
            emptyTitle="لا يوجد متدربون في هذه الدفعة"
            emptyDescription="أضف متدربًا أو أنشئ دفعة أولًا."
          />
        </SectionCard>
      ) : null}

      {tab === 'sessions' ? (
        <SectionCard title="الجلسات">
          <FormSelect
            id="session-cohort"
            label="الدفعة"
            value={selectedCohortId}
            onChange={(e) => setSelectedCohortId(e.target.value)}
          >
            <option value="">اختر دفعة</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </FormSelect>
          {!readOnly && selectedCohortId ? (
            <form
              className="crud-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await createSession(selectedCohortId, {
                    title: sessionForm.title.trim(),
                    starts_at: sessionForm.starts_at,
                    ends_at: sessionForm.ends_at,
                    hours: sessionForm.hours !== '' ? Number(sessionForm.hours) : null,
                    location: sessionForm.location || null,
                  });
                  setSessionForm({ title: '', starts_at: '', ends_at: '', hours: '', location: '' });
                  const sess = await listCohortSessions(selectedCohortId);
                  setSessions(Array.isArray(sess) ? sess : []);
                  setMessage('تم إنشاء الجلسة.');
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر إنشاء الجلسة.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="auth-form__fields-grid">
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
          ) : null}
          <DataTable
            columns={[
              { key: 'title', label: 'الجلسة', mobileTitle: true },
              { key: 'startsAt', label: 'البداية' },
              { key: 'status', label: 'الحالة' },
              { key: 'hours', label: 'الساعات' },
            ]}
            rows={sessions.map((s) => ({
              id: s.id,
              title: s.title,
              startsAt: s.startsAt ? String(s.startsAt).slice(0, 16) : '—',
              status: s.status,
              hours: s.hours ?? '—',
            }))}
            emptyTitle="لا توجد جلسات"
            emptyDescription="أنشئ جلسة بعد اختيار الدفعة."
          />
        </SectionCard>
      ) : null}

      {tab === 'attendance' ? (
        <SectionCard title="الحضور">
          <FormSelect
            id="attendance-cohort"
            label="الدفعة"
            value={selectedCohortId}
            onChange={(e) => setSelectedCohortId(e.target.value)}
          >
            <option value="">اختر دفعة</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </FormSelect>
          {sessions.length ? (
            <ul className="simple-list">
              {sessions.map((s) => (
                <li key={s.id}>
                  <strong>{s.title}</strong>
                  {!readOnly ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setError('');
                        try {
                          const win = await openAttendanceWindow(s.id, { duration_seconds: 600 });
                          const attendance = await listSessionAttendance(s.id);
                          setMessage(
                            `نافذة حضور مفتوحة. الرمز: ${win.code} — سجلات: ${attendance?.records?.length ?? 0}`
                          );
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
            <EmptyState title="لا توجد جلسات" description="أنشئ جلسة من تبويب الجلسات أولًا." />
          )}
        </SectionCard>
      ) : null}

      {tab === 'lectures' ? (
        <SectionCard title="المحاضرات المسجلة">
          <RecordedLecturesManager
            programId={programId}
            canManage={!readOnly}
            sessions={(sessions || []).map((s) => ({ id: s.id, title: s.title }))}
            viewBasePath={`/admin/training-courses/${programId}/lectures`}
          />
        </SectionCard>
      ) : null}

      {tab === 'materials' ? (
        <SectionCard title="المواد التعليمية">
          <CourseMaterialsManager programId={programId} canManage={!readOnly} />
        </SectionCard>
      ) : null}

      {tab === 'tasks' ? (
        <SectionCard title="المهمات">
          <CourseTasksManager programId={programId} canManage={!readOnly} />
        </SectionCard>
      ) : null}

      {tab === 'pretest' || tab === 'posttest' ? (
        <SectionCard title={tab === 'pretest' ? 'الاختبار القبلي' : 'الاختبار البعدي'}>
          <TrainingAssessmentEditor
            programId={programId}
            kind={tab === 'pretest' ? 'pre' : 'post'}
            assessment={tab === 'pretest' ? preAssessment : postAssessment}
            readOnly={readOnly}
            titleFallback={tab === 'pretest' ? 'اختبار قبلي' : 'اختبار بعدي'}
            onSaved={async () => {
              const rows = await listProgramAssessments(programId);
              setAssessments(Array.isArray(rows) ? rows : []);
              setMessage('تم تحديث الاختبار.');
            }}
          />
          <div style={{ marginTop: '1.5rem' }}>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  const data = await getPrePostComparison(programId);
                  setComparison(data);
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر تحميل مقارنة القبلي/البعدي.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              مقارنة القبلي / البعدي
            </Button>
            {comparison?.items?.length ? (
              <ul className="simple-list" style={{ marginTop: '0.75rem' }}>
                {comparison.items.map((row) => (
                  <li key={row.enrollmentId}>
                    <strong>{row.traineeName}</strong> — قبلي: {row.preScore ?? '—'}% — بعدي:{' '}
                    {row.postScore ?? '—'}%
                    {row.difference != null ? ` — فرق: ${row.difference}` : ''}
                    {row.improvementPct != null ? ` — تحسّن: ${row.improvementPct}%` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {tab === 'progress' ? (
        <SectionCard title="التقدم والإكمال والشهادات">
          <FormSelect
            id="progress-cohort"
            label="الدفعة"
            value={selectedCohortId}
            onChange={(e) => setSelectedCohortId(e.target.value)}
          >
            <option value="">اختر دفعة</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </FormSelect>
          <DataTable
            columns={[
              { key: 'userId', label: 'المتدرب', mobileTitle: true },
              { key: 'status', label: 'حالة التسجيل' },
              {
                key: 'actions',
                label: 'إجراءات',
                render: (row) =>
                  readOnly ? null : (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <Button
                        type="button"
                        variant="outline"
                        className="btn--sm"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const p = await recomputeProgress(row.id);
                            setMessage(
                              `التقدم: ${p.completionPct}% — ${p.status}`
                            );
                            await getEnrollmentProgress(row.id);
                          } catch (err) {
                            setError(getApiErrorMessage(err, 'تعذر إعادة احتساب التقدم.'));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        إعادة حساب
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        className="btn--sm"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await approveCompletion(row.id);
                            setMessage('تم اعتماد الإكمال.');
                          } catch (err) {
                            setError(getApiErrorMessage(err, 'تعذر اعتماد الإكمال.'));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        اعتماد الإكمال
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="btn--sm"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const cert = await issueCertificate(row.id);
                            setMessage(`صدرت شهادة: ${cert.certificateNumber}`);
                          } catch (err) {
                            setError(getApiErrorMessage(err, 'تعذر إصدار الشهادة.'));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        إصدار شهادة
                      </Button>
                    </div>
                  ),
              },
            ]}
            rows={enrollments.map((e) => ({
              id: e.id,
              userId: e.userId || e.user_id || '—',
              status: e.status,
            }))}
            emptyTitle="لا يوجد متدربون"
            emptyDescription="أضف متدربين من تبويب المتدربون."
          />
        </SectionCard>
      ) : null}

      {tab === 'finalization' ? (
        <>
          <SectionCard
            title="جاهزية إنهاء التدريب"
            actions={
              !readOnly ? (
                <Button type="button" variant="primary" onClick={() => setFinalizeModalOpen(true)}>
                  إنهاء التدريب
                </Button>
              ) : null
            }
          >
            <FormSelect
              id="finalization-cohort"
              label="الدفعة"
              value={selectedCohortId}
              onChange={(e) => setSelectedCohortId(e.target.value)}
            >
              <option value="">كل الدفعات</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FormSelect>
            {readinessLoading ? (
              <LoadingSpinner label="جاري تحميل الجاهزية" />
            ) : readinessError ? (
              <p className="form-field__error" role="alert">
                {readinessError}
              </p>
            ) : readiness ? (
              <>
                <TrainingReadinessCard counts={readiness.counts} />
                <DataTable
                  columns={[
                    { key: 'name', label: 'المتدرب', mobileTitle: true },
                    { key: 'cohort', label: 'الدفعة' },
                    { key: 'enrollmentStatus', label: 'حالة التسجيل' },
                    { key: 'eligibility', label: 'الجاهزية', render: (row) => <CompletionStatusBadge status={row.lifecycleStatus} /> },
                    {
                      key: 'actions',
                      label: 'إجراءات',
                      render: (row) => (
                        <Button
                          type="button"
                          variant="outline"
                          className="btn--sm"
                          onClick={() => setReportEnrollmentId(row.id)}
                        >
                          التقرير الفردي
                        </Button>
                      ),
                    },
                  ]}
                  rows={(readiness.trainees || []).map((t) => ({
                    id: t.enrollmentId,
                    name: t.fullName,
                    cohort: t.cohortName || '—',
                    enrollmentStatus: t.enrollmentStatus,
                    lifecycleStatus: t.lifecycleStatus,
                  }))}
                  emptyTitle="لا يوجد متدربون"
                  emptyDescription="أضف متدربين إلى هذه الدورة أولًا."
                />
              </>
            ) : null}
          </SectionCard>

          <SectionCard title="تقرير الدورة">
            <CourseReportDashboard programId={programId} cohortId={selectedCohortId || undefined} canGenerate={!readOnly} />
          </SectionCard>

          <TrainingFinalizationModal
            open={finalizeModalOpen}
            onClose={() => setFinalizeModalOpen(false)}
            programId={programId}
            cohorts={cohorts}
            canExceptional={isAdmin}
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
            {reportEnrollmentId ? <IndividualReportView enrollmentId={reportEnrollmentId} canGenerate={!readOnly} /> : null}
          </AppModal>
        </>
      ) : null}

      {tab === 'settings' ? (
        <SectionCard title="الإعدادات">
          {!readOnly ? (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Button
                type="button"
                variant="primary"
                disabled={busy || course.status === 'PUBLISHED'}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await publishProgram(programId);
                    setMessage('تم نشر الدورة.');
                    await refresh();
                  } catch (err) {
                    setError(getApiErrorMessage(err, 'تعذر نشر الدورة.'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                نشر الدورة
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await updateProgram(programId, { status: 'ARCHIVED' });
                    setMessage('تم أرشفة الدورة.');
                    await refresh();
                  } catch (err) {
                    setError(getApiErrorMessage(err, 'تعذر أرشفة الدورة.'));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                أرشفة
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/admin/training-courses/${programId}/edit`)}>
                تعديل البيانات
              </Button>
            </div>
          ) : (
            <p>عرض فقط.</p>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
