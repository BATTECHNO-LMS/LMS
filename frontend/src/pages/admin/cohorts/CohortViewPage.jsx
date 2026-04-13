import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';
import { Pencil, Calendar, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { FormSelect } from '../../../components/forms/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { useCohort, useCohortAttendanceSummary, useUpdateCohortStatus } from '../../../features/cohorts/index.js';
import { useEnrollments, useCreateEnrollment, useUpdateEnrollmentStatus } from '../../../features/enrollments/index.js';
import { useUsers } from '../../../features/users/index.js';
import { enrollmentCreateSchema } from '../../../schemas/adminCrudSchemas.js';
import { safeParse } from '../../../utils/zodErrors.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { ADMIN_ROLE_SET, ROLES } from '../../../constants/roles.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { useAuth } from '../../../features/auth/index.js';

const ENROLLMENT_STATUSES = ['pending', 'enrolled', 'withdrawn', 'cancelled', 'completed'];

export function CohortViewPage() {
  const base = usePortalPathPrefix();
  const { user } = useAuth();
  const { t } = useTranslation('cohorts');
  const { t: tEn } = useTranslation('enrollments');
  const { t: tCommon } = useTranslation('common');
  const { t: tAtt } = useTranslation('attendance');
  const { locale } = useLocale();
  const { id } = useParams();

  const isDeliveryAdmin = useMemo(() => {
    const roles = (user?.roles ?? []).map((r) => String(r).toLowerCase());
    return ADMIN_ROLE_SET.some((r) => roles.includes(String(r).toLowerCase()));
  }, [user]);

  const { data, isLoading, isError } = useCohort(id);
  const { data: enData, isLoading: enLoading } = useEnrollments(id);
  const { data: sumData, isLoading: sumLoading } = useCohortAttendanceSummary(id);

  const statusMut = useUpdateCohortStatus();
  const createEnMut = useCreateEnrollment();
  const patchEnMut = useUpdateEnrollmentStatus();

  const [nextStatus, setNextStatus] = useState('');
  const [statusErr, setStatusErr] = useState('');
  const [studentId, setStudentId] = useState('');
  const [enrollErr, setEnrollErr] = useState('');
  const [enFieldErr, setEnFieldErr] = useState({});

  const { data: usersPayload } = useUsers({ page: 1, page_size: 200 }, { staleTime: 30_000 });
  const enrollments = enData?.enrollments ?? [];

  const studentCandidates = useMemo(() => {
    const items = usersPayload?.items ?? [];
    const enrolled = new Set(enrollments.map((e) => e.student_id));
    return items.filter(
      (u) =>
        Array.isArray(u.roles) &&
        u.roles.map((r) => String(r).toLowerCase()).includes(ROLES.STUDENT) &&
        !enrolled.has(u.id)
    );
  }, [usersPayload, enrollments]);

  async function applyStatus() {
    if (!id || !nextStatus) return;
    setStatusErr('');
    try {
      await statusMut.mutateAsync({ id, body: { status: nextStatus } });
      setNextStatus('');
    } catch (e) {
      setStatusErr(getApiErrorMessage(e, tCommon('errors.generic')));
    }
  }

  async function addEnrollment(e) {
    e.preventDefault();
    setEnrollErr('');
    setEnFieldErr({});
    const parsed = safeParse(enrollmentCreateSchema, { student_id: studentId });
    if (!parsed.ok) {
      setEnFieldErr(parsed.errors);
      return;
    }
    try {
      await createEnMut.mutateAsync({ cohortId: id, body: parsed.data });
      setStudentId('');
    } catch (err) {
      setEnrollErr(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  async function onEnrollmentStatusChange(enrollmentId, enrollment_status) {
    try {
      await patchEnMut.mutateAsync({ id: enrollmentId, body: { enrollment_status } });
    } catch {
      /* surfaced via query refetch */
    }
  }

  if (isLoading) {
    return (
      <div className="page page--admin crud-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title={tCommon('errors.notFound')} description="" />
        <Link className="btn btn--primary" to={`${base}/cohorts`}>
          {tCommon('actions.backToList')}
        </Link>
      </div>
    );
  }

  const summaryRows = (sumData?.students ?? []).map((s) => ({
    ...s,
    studentName: s.student?.full_name ?? '—',
    locale,
  }));

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('view.title')}</>} description={<>{t('description')}</>} />
      <SectionCard
        title={tCommon('actions.details')}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link className="btn btn--outline" to={`${base}/cohorts/${id}/sessions`}>
              <Calendar size={18} aria-hidden /> {t('form.sessionsLink')}
            </Link>
            {isDeliveryAdmin ? (
              <Link className="btn btn--primary" to={`${base}/cohorts/${id}/edit`}>
                <Pencil size={18} aria-hidden /> {tCommon('actions.edit')}
              </Link>
            ) : null}
          </div>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>{t('table.title')}</dt>
            <dd>{data.title}</dd>
          </div>
          <div>
            <dt>{t('table.certificate')}</dt>
            <dd>{data.micro_credential?.title ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('form.university')}</dt>
            <dd>{data.university?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('table.trainer')}</dt>
            <dd>{data.instructor?.full_name ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('table.capacity')}</dt>
            <dd>{data.capacity}</dd>
          </div>
          <div>
            <dt>{t('table.startDate')}</dt>
            <dd>{data.start_date}</dd>
          </div>
          <div>
            <dt>{t('table.endDate')}</dt>
            <dd>{data.end_date}</dd>
          </div>
          <div>
            <dt>{tCommon('status.label')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(data.status)}>{statusLabelAr(data.status, locale)}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{tCommon('actions.details')}</dt>
            <dd>
              {t('view.enrollments')}: {data.enrollments_count ?? '—'} · {t('form.sessionsLink')}: {data.sessions_count ?? '—'}
            </dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to={`${base}/cohorts`}>
            {tCommon('actions.backToList')}
          </Link>
        </div>
      </SectionCard>

      {isDeliveryAdmin ? (
        <SectionCard title={t('view.setStatus')}>
          {statusErr ? <p className="form-error">{statusErr}</p> : null}
          <div className="crud-form-grid" style={{ maxWidth: 480 }}>
            <FormSelect id="cohort-next-status" label={tCommon('status.label')} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
              <option value="">{tCommon('status.allStatuses')}</option>
              <option value="planned">{t('status.planned')}</option>
              <option value="open_for_enrollment">{t('status.open_for_enrollment')}</option>
              <option value="active">{t('status.active')}</option>
              <option value="completed">{t('status.completed')}</option>
              <option value="closed">{t('status.closed')}</option>
              <option value="cancelled">{t('status.cancelled')}</option>
            </FormSelect>
            <div style={{ alignSelf: 'end' }}>
              <button type="button" className="btn btn--primary" disabled={!nextStatus || statusMut.isPending} onClick={applyStatus}>
                {tCommon('actions.update')}
              </button>
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title={t('view.enrollments')}>
        {isDeliveryAdmin ? (
          <form className="crud-form-grid" style={{ marginBottom: '1rem', maxWidth: 560 }} onSubmit={addEnrollment}>
            {enrollErr ? <p className="form-error">{enrollErr}</p> : null}
            <FormSelect
              id="new-student"
              label={tEn('selectStudent')}
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              error={enFieldErr.student_id}
            >
              <option value="">—</option>
              {studentCandidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.email})
                </option>
              ))}
            </FormSelect>
            <div style={{ alignSelf: 'end' }}>
              <button type="submit" className="btn btn--primary" disabled={!studentId || createEnMut.isPending}>
                {tEn('save')}
              </button>
            </div>
          </form>
        ) : null}
        {enLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={tEn('empty')}
            emptyDescription=""
            columns={[
              { key: 'student', label: tEn('student'), render: (r) => r.student?.full_name ?? '—' },
              {
                key: 'view',
                label: tEn('viewEnrollment'),
                render: (r) => (
                  <Link className="btn btn--outline" to={`${base}/enrollments/${r.id}`}>
                    {tEn('viewEnrollment')}
                  </Link>
                ),
              },
              {
                key: 'enrollment_status',
                label: tEn('enrollmentStatus'),
                render: (r) => (
                  <FormSelect
                    id={`en-${r.id}`}
                    value={r.enrollment_status}
                    onChange={(e) => onEnrollmentStatusChange(r.id, e.target.value)}
                  >
                    {ENROLLMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabelAr(s, locale)}
                      </option>
                    ))}
                  </FormSelect>
                ),
              },
              { key: 'final_status', label: tEn('finalStatus'), render: (r) => statusLabelAr(r.final_status, locale) },
              {
                key: 'attendance_percentage',
                label: tEn('attendancePct'),
                render: (r) => (r.attendance_percentage != null ? `${r.attendance_percentage}%` : '—'),
              },
            ]}
            rows={enrollments}
          />
        )}
      </SectionCard>

      <SectionCard title={<><ClipboardList size={18} style={{ marginInlineEnd: 6 }} aria-hidden />{t('view.attendanceSummary')}</>}>
        {sumLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={tAtt('summaryTitle')}
            emptyDescription={tCommon('errors.generic')}
            columns={[
              { key: 'studentName', label: tEn('student') },
              { key: 'total_sessions', label: tAtt('totalSessions') },
              { key: 'total_present', label: tAtt('present') },
              { key: 'total_late', label: tAtt('late') },
              { key: 'total_absent', label: tAtt('absent') },
              { key: 'total_excused', label: tAtt('excused') },
              {
                key: 'attendance_percentage',
                label: tAtt('pct'),
                render: (r) => `${r.attendance_percentage ?? 0}%`,
              },
            ]}
            rows={summaryRows}
          />
        )}
      </SectionCard>
    </div>
  );
}
