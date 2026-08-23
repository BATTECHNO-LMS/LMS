import { useCallback, useEffect, useState, Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { FormInput } from '../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../components/forms/FormTextarea.jsx';
import { FileUploader } from '../../components/forms/FileUploader.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import {
  confirmAttendance,
  getTraineeProgramDetail,
  getPrePostComparison,
  submitTask,
  getTaskInstructionFile,
} from '../../features/training/training.service.js';
import {
  TrainingAssessmentAttemptPanel,
  EvaluationWizard,
  IndividualReportView,
} from '../../features/training/components/lazyTrainingUi.js';
import { CompletionRequirementList } from '../../features/training/components/completion/CompletionRequirementList.jsx';
import { getApiErrorMessage, isCanceledRequest } from '../../services/apiHelpers.js';
import { RouteFallback } from '../../components/common/RouteFallback.jsx';
import { formatAssessmentDateTime } from '../../features/training/assessmentPresentation/assessmentDate.js';
import { trainingTaskStatusLabel } from '../../features/training/trainingTaskStatus.js';
import { mergeTraineeProgramDetail } from '../../features/training/mergeCourseDetail.js';

const TABS = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'sessions', label: 'الجلسات' },
  { id: 'lectures', label: 'المحاضرات المسجلة' },
  { id: 'materials', label: 'المواد التعليمية' },
  { id: 'tasks', label: 'المهمات' },
  { id: 'assessments', label: 'الاختبارات' },
  { id: 'evaluation', label: 'التقييم النهائي' },
  { id: 'progress', label: 'التقدم' },
  { id: 'report', label: 'التقرير الفردي' },
  { id: 'certificate', label: 'الشهادة' },
];

const TAB_SECTIONS = {
  overview: 'overview',
  sessions: 'sessions',
  lectures: 'materials',
  materials: 'materials',
  tasks: 'tasks',
  assessments: 'overview',
  evaluation: 'overview',
  progress: 'overview',
  report: 'overview',
  certificate: 'certificate',
};

export function TraineeCourseDetailPage() {
  const { programId, tab: tabParam } = useParams();
  const [tab, setTab] = useState(tabParam || 'overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [businessCode, setBusinessCode] = useState('');
  const [attendanceCodes, setAttendanceCodes] = useState({});
  const [taskDrafts, setTaskDrafts] = useState({});
  const [taskFiles, setTaskFiles] = useState({});
  const [comparison, setComparison] = useState(null);
  const [tabLoading, setTabLoading] = useState(false);

  const refresh = useCallback(async ({ silent = false, sections = 'overview' } = {}) => {
    if (!programId) return;
    if (!silent) {
      setLoading(true);
      setError('');
      setBusinessCode('');
    }
    try {
      const detail = await getTraineeProgramDetail(programId, { sections });
      setData((prev) => mergeTraineeProgramDetail(prev, detail));
      setError('');
      setBusinessCode('');
    } catch (err) {
      if (isCanceledRequest(err)) return;
      const code = err?.response?.data?.code || err?.code;
      if (code === 'COURSE_ENROLLMENT_REQUIRED' || code === 'ENROLLMENT_PENDING') {
        setBusinessCode(code);
        setData(null);
      } else {
        setError(getApiErrorMessage(err, 'تعذر تحميل الدورة.'));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    refresh({ sections: 'overview' });
  }, [refresh]);

  useEffect(() => {
    if (tabParam) setTab(tabParam);
  }, [tabParam]);

  useEffect(() => {
    if (!programId || loading || !data) return;
    const sections = TAB_SECTIONS[tab] || 'overview';
    if (sections === 'overview') return;
    if (sections === 'sessions' && data.sessions) return;
    if (sections === 'materials' && (data.materials || data.recordedLectures)) return;
    if (sections === 'tasks' && data.tasks) return;
    if (sections === 'certificate' && Object.prototype.hasOwnProperty.call(data, 'certificate')) return;
    let cancelled = false;
    setTabLoading(true);
    getTraineeProgramDetail(programId, { sections })
      .then((detail) => {
        if (!cancelled) setData((prev) => mergeTraineeProgramDetail(prev, detail));
      })
      .catch((err) => {
        if (!cancelled && !isCanceledRequest(err)) {
          setError(getApiErrorMessage(err, 'تعذر تحميل محتوى التبويب.'));
        }
      })
      .finally(() => {
        if (!cancelled) setTabLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, programId, loading, data]);

  if (loading) {
    return (
      <div className="page page--dashboard" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  if (businessCode === 'COURSE_ENROLLMENT_REQUIRED') {
    return (
      <div className="page page--dashboard" dir="rtl">
        <EmptyState
          title="غير مسجّل في هذه الدورة"
          description="لا يمكنك الوصول إلى محتوى هذه الدورة لأنك غير مسجل فيها."
        />
        <Link className="link" to="/trainee/courses">
          العودة إلى الدورات
        </Link>
      </div>
    );
  }

  if (businessCode === 'ENROLLMENT_PENDING') {
    return (
      <div className="page page--dashboard" dir="rtl">
        <EmptyState
          title="بانتظار الموافقة"
          description="طلب تسجيلك في هذه الدورة ما زال بانتظار الموافقة."
        />
        <Link className="link" to="/trainee/courses">
          العودة إلى الدورات
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page page--dashboard" dir="rtl">
        <p className="form-field__error" role="alert">
          {error || 'تعذر تحميل الدورة.'}
        </p>
        <Button type="button" variant="primary" onClick={() => refresh()}>
          إعادة المحاولة
        </Button>{' '}
        <Link className="link" to="/trainee/courses">
          العودة إلى الدورات
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard crud-page" dir="rtl">
      <AdminPageHeader
        breadcrumb={
          <>
            <Link to="/trainee/courses">دوراتي التدريبية</Link>
            <span aria-hidden> / </span>
            <span>{data.program?.title || 'الدورة'}</span>
          </>
        }
        title={data.program?.title || 'الدورة التدريبية'}
        description={data.cohort?.name || 'بوابة المؤسسات'}
        actions={<StatusBadge variant="info">{data.status || '—'}</StatusBadge>}
      />

      <Suspense fallback={<RouteFallback />}>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="auth-register__helper">{message}</p> : null}
      {data.contentLocked ? (
        <p className="form-field__error" role="status">
          {data.contentLockReason || 'يجب إكمال الاختبار القبلي قبل الوصول إلى محتوى الدورة.'}
        </p>
      ) : null}
      {data.trainerAssignmentNote ? (
        <p className="auth-register__helper">{data.trainerAssignmentNote}</p>
      ) : null}

      <div className="admin-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '1rem' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn btn--sm ${tab === t.id ? 'btn--primary' : 'btn--outline'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <SectionCard title="نظرة عامة">
          <dl className="detail-list">
            <div className="detail-list__row">
              <dt>الوصف</dt>
              <dd>{data.program?.description || '—'}</dd>
            </div>
            <div className="detail-list__row">
              <dt>الأهداف</dt>
              <dd>{data.program?.objectives || '—'}</dd>
            </div>
            <div className="detail-list__row">
              <dt>نسبة الإنجاز</dt>
              <dd>{data.progress?.completionPct ?? 0}%</dd>
            </div>
            <div className="detail-list__row">
              <dt>الساعات</dt>
              <dd>{data.progress?.hoursCompleted ?? 0}</dd>
            </div>
          </dl>
        </SectionCard>
      ) : null}

      {tab === 'sessions' ? (
        <SectionCard title="الجلسات والحضور">
          {tabLoading && data.sessions == null ? (
            <LoadingSpinner />
          ) : (data.sessions || []).length ? (
            <ul className="simple-list">
              {(data.sessions || []).map((s) => (
                <li key={s.id}>
                  <strong>{s.title}</strong>{' '}
                  <StatusBadge variant="info">{s.attendance?.status || s.status}</StatusBadge>
                  <div>{s.startsAt ? formatAssessmentDateTime(s.startsAt) : '—'}</div>
                  {!s.attendance?.confirmedAt ? (
                    <form
                      className="crud-form"
                      style={{ marginTop: '0.5rem' }}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setBusy(true);
                        setError('');
                        try {
                          await confirmAttendance(s.id, attendanceCodes[s.id]);
                          setMessage('تم تأكيد الحضور.');
                          setAttendanceCodes((prev) => ({ ...prev, [s.id]: '' }));
                          await refresh({ silent: true, sections: 'sessions' });
                        } catch (err) {
                          setError(getApiErrorMessage(err, 'تعذر تأكيد الحضور.'));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <FormInput
                        id={`code-${s.id}`}
                        label="رمز الحضور"
                        value={attendanceCodes[s.id] || ''}
                        onChange={(e) =>
                          setAttendanceCodes((prev) => ({ ...prev, [s.id]: e.target.value }))
                        }
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={busy || !(attendanceCodes[s.id] || '').trim()}
                      >
                        تأكيد الحضور
                      </Button>
                    </form>
                  ) : (
                    <div>تم التأكيد: {s.attendance.confirmedAt ? formatAssessmentDateTime(s.attendance.confirmedAt) : '—'}</div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد جلسات" description="ستظهر الجلسات بعد إنشائها من المدرب." />
          )}
        </SectionCard>
      ) : null}

      {tab === 'lectures' ? (
        <SectionCard title="المحاضرات المسجلة">
          {tabLoading && data.recordedLectures == null ? (
            <LoadingSpinner />
          ) : (data.recordedLectures || []).length ? (
            <ul className="simple-list course-lecture-list">
              {data.recordedLectures.map((lec) => (
                <li key={lec.id} className="course-lecture-card">
                  <strong>{lec.title}</strong>
                  {lec.description ? (
                    <div className="auth-register__helper">{lec.description}</div>
                  ) : null}
                  <div className="auth-register__helper">
                    المدة:{' '}
                    {lec.durationSeconds != null
                      ? [
                          Math.floor(lec.durationSeconds / 3600),
                          Math.floor((lec.durationSeconds % 3600) / 60),
                          Math.floor(lec.durationSeconds % 60),
                        ]
                          .map((v) => String(v).padStart(2, '0'))
                          .join(':')
                      : '—'}
                  </div>
                  <Link
                    className="btn btn--primary btn--sm"
                    to={`/trainee/courses/${programId}/lectures/${lec.id}`}
                  >
                    مشاهدة المحاضرة
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد محاضرات مسجلة حتى الآن." />
          )}
        </SectionCard>
      ) : null}

      {tab === 'materials' ? (
        <SectionCard title="المواد التعليمية">
          {tabLoading && data.materials == null ? (
            <LoadingSpinner />
          ) : (data.materials || []).length ? (
            <ul className="simple-list">
              {data.materials.map((m) => (
                <li key={m.id} className="course-material-card">
                  <strong>{m.title}</strong>
                  {m.description ? <div className="auth-register__helper">{m.description}</div> : null}
                  {m.url ? (
                    <div>
                      <a className="link" href={m.url} target="_blank" rel="noreferrer">
                        فتح الرابط
                      </a>
                    </div>
                  ) : null}
                  {m.hasFile ? (
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const { getMaterialPlaybackUrl } = await import(
                              '../../features/training/training.service.js'
                            );
                            const dataUrl = await getMaterialPlaybackUrl(m.id);
                            if (dataUrl?.url) window.open(dataUrl.url, '_blank', 'noopener,noreferrer');
                          } catch (err) {
                            setError(getApiErrorMessage(err, 'تعذر فتح الملف.'));
                          }
                        }}
                      >
                        تحميل / عرض الملف
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لم تتم إضافة مواد تعليمية بعد." />
          )}
        </SectionCard>
      ) : null}

      {tab === 'tasks' ? (
        <SectionCard title="المهمات">
          {tabLoading && data.tasks == null ? (
            <LoadingSpinner />
          ) : (data.tasks || []).length ? (
            <ul className="simple-list">
              {data.tasks.map((task) => (
                <li key={task.id}>
                  <strong>{task.title}</strong>
                  {task.instructions ? (
                    <div className="auth-register__helper">{task.instructions}</div>
                  ) : null}
                  {task.hasAttachment || task.attachmentUrl ? (
                    <div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const file = await getTaskInstructionFile(task.id);
                            if (file?.url) window.open(file.url, '_blank', 'noopener,noreferrer');
                          } catch (err) {
                            setError(getApiErrorMessage(err, 'تعذر تحميل ملف التعليمات.'));
                          }
                        }}
                      >
                        تحميل التعليمات
                      </Button>
                    </div>
                  ) : null}
                  {task.submission ? (
                    <div>
                      الحالة: {trainingTaskStatusLabel(task.submission.status)}
                      {task.submission.score != null ? ` — الدرجة: ${task.submission.score}` : ''}
                      {task.submission.feedback ? ` — ${task.submission.feedback}` : ''}
                    </div>
                  ) : null}
                  {task.canSubmit ? (
                    <form
                      className="crud-form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setBusy(true);
                        setError('');
                        try {
                          await submitTask(task.id, {
                            content_text: taskDrafts[task.id] || '',
                            content_url: taskFiles[task.id]?.url || taskFiles[task.id]?.storageKey || null,
                          });
                          setMessage('تم تسليم المهمة.');
                          await refresh({ silent: true, sections: 'tasks' });
                        } catch (err) {
                          setError(getApiErrorMessage(err, 'تعذر تسليم المهمة.'));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <FormTextarea
                        id={`task-${task.id}`}
                        label="تسليمك النصي"
                        value={taskDrafts[task.id] || ''}
                        onChange={(e) =>
                          setTaskDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))
                        }
                      />
                      <FileUploader
                        folder="training"
                        visibility="private"
                        relatedEntityType="training_task"
                        relatedEntityId={task.id}
                        accept="application/pdf,.doc,.docx,.ppt,.pptx,image/*,.zip"
                        onUploaded={(file) => setTaskFiles((prev) => ({ ...prev, [task.id]: file }))}
                        onError={(err) => setError(getApiErrorMessage(err, 'تعذر رفع الملف.'))}
                      />
                      <Button type="submit" variant="primary" disabled={busy}>
                        تسليم المهمة
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="لا توجد مهمات" description="ستظهر المهمات المنشورة هنا." />
          )}
        </SectionCard>
      ) : null}

      {tab === 'assessments' ? (
        <>
          <TrainingAssessmentAttemptPanel
            programId={programId}
            courseTitle={data.program?.title}
            programType={data.program?.type || 'TRAINING_COURSE'}
            onChanged={refresh}
            evaluationLinkTo={`/trainee/courses/${programId}/evaluation`}
          />
          <div className="ta-assessment-panel" style={{ marginTop: '1rem' }}>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  const dataCmp = await getPrePostComparison(programId);
                  setComparison(dataCmp);
                } catch (err) {
                  setError(getApiErrorMessage(err, 'تعذر تحميل المقارنة.'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              مقارنة القبلي / البعدي
            </Button>
            {comparison?.items?.[0] ? (
              <dl className="detail-list" style={{ marginTop: '0.75rem' }}>
                <div className="detail-list__row">
                  <dt>درجة القبلي</dt>
                  <dd>{comparison.items[0].preScore ?? '—'}%</dd>
                </div>
                <div className="detail-list__row">
                  <dt>درجة البعدي</dt>
                  <dd>{comparison.items[0].postScore ?? '—'}%</dd>
                </div>
                <div className="detail-list__row">
                  <dt>الفرق</dt>
                  <dd>{comparison.items[0].difference ?? '—'}</dd>
                </div>
                <div className="detail-list__row">
                  <dt>نسبة التحسّن</dt>
                  <dd>
                    {comparison.items[0].improvementPct != null
                      ? `${comparison.items[0].improvementPct}%`
                      : '—'}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        </>
      ) : null}

      {tab === 'evaluation' ? (
        <SectionCard title="التقييم النهائي للدورة">
          {data.enrollmentId ? (
            <EvaluationWizard enrollmentId={data.enrollmentId} onSubmitted={refresh} />
          ) : (
            <EmptyState title="غير متاح" description="تعذر تحديد تسجيلك في هذه الدورة." />
          )}
        </SectionCard>
      ) : null}

      {tab === 'progress' ? (
        <SectionCard title="التقدم">
          <dl className="detail-list">
            <div className="detail-list__row">
              <dt>نسبة الإنجاز</dt>
              <dd>{data.progress?.completionPct ?? 0}%</dd>
            </div>
            <div className="detail-list__row">
              <dt>الحضور</dt>
              <dd>{data.progress?.attendancePct ?? 0}%</dd>
            </div>
            <div className="detail-list__row">
              <dt>الساعات</dt>
              <dd>{data.progress?.hoursCompleted ?? 0}</dd>
            </div>
            <div className="detail-list__row">
              <dt>الاختبار القبلي</dt>
              <dd>
                {data.progress?.requirements?.preTest?.required
                  ? data.progress.requirements.preTest.ok
                    ? 'مكتمل'
                    : data.progress.requirements.preTest.pendingManual
                      ? 'بانتظار مراجعة المدرب'
                      : 'غير مكتمل'
                  : 'غير مطلوب'}
                {data.progress?.requirements?.preTest?.passScore != null
                  ? ` — الدرجة المطلوبة: ${data.progress.requirements.preTest.passScore}%`
                  : ''}
              </dd>
            </div>
            <div className="detail-list__row">
              <dt>الاختبار البعدي</dt>
              <dd>
                {data.progress?.requirements?.postTest?.required
                  ? data.progress.requirements.postTest.ok
                    ? 'مكتمل'
                    : data.progress.requirements.postTest.pendingManual
                      ? 'بانتظار مراجعة المدرب'
                      : 'غير مكتمل'
                  : 'غير مطلوب'}
                {data.progress?.requirements?.postTest?.passScore != null
                  ? ` — الدرجة المطلوبة: ${data.progress.requirements.postTest.passScore}%`
                  : ''}
              </dd>
            </div>
            <div className="detail-list__row">
              <dt>التقييم النهائي</dt>
              <dd>
                {data.progress?.requirements?.evaluation?.required
                  ? data.progress.requirements.evaluation.submitted
                    ? 'تم الإرسال'
                    : data.progress.requirements.evaluation.status === 'LOCKED'
                      ? 'مقفل حتى اجتياز الاختبار البعدي'
                      : 'بانتظار التعبئة'
                  : 'غير مطلوب'}
              </dd>
            </div>
            <div className="detail-list__row">
              <dt>الحالة</dt>
              <dd>{data.progress?.status || data.status}</dd>
            </div>
          </dl>
          {data.progress?.requirements ? (
            <>
              <h3 className="ta-section-title" style={{ marginTop: '1.25rem' }}>
                ملخص متطلبات إنهاء الدورة
              </h3>
              <CompletionRequirementList requirements={data.progress.requirements} />
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {tab === 'report' ? (
        <SectionCard title="التقرير الفردي">
          {data.enrollmentId ? (
            <IndividualReportView enrollmentId={data.enrollmentId} />
          ) : (
            <EmptyState title="غير متاح" description="تعذر تحديد تسجيلك في هذه الدورة." />
          )}
        </SectionCard>
      ) : null}

      {tab === 'certificate' ? (
        <SectionCard title="الشهادة">
          {tabLoading && !Object.prototype.hasOwnProperty.call(data, 'certificate') ? (
            <LoadingSpinner />
          ) : data.certificate ? (
            <dl className="detail-list">
              <div className="detail-list__row">
                <dt>رقم الشهادة</dt>
                <dd>{data.certificate.certificateNumber}</dd>
              </div>
              <div className="detail-list__row">
                <dt>رمز التحقق</dt>
                <dd dir="ltr">{data.certificate.verificationCode}</dd>
              </div>
              <div className="detail-list__row">
                <dt>تاريخ الإصدار</dt>
                <dd>
                  {data.certificate.issuedAt
                    ? String(data.certificate.issuedAt).slice(0, 10)
                    : '—'}
                </dd>
              </div>
            </dl>
          ) : (
            <EmptyState
              title="لا توجد شهادة بعد"
              description="تصدر الشهادة بعد اعتماد الإكمال من مسؤول النظام."
            />
          )}
        </SectionCard>
      ) : null}
      </Suspense>
    </div>
  );
}
