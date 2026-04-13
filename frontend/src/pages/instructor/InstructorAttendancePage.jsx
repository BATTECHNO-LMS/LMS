import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { AdminActionBar } from '../../components/admin/AdminActionBar.jsx';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { SelectField } from '../../components/admin/SelectField.jsx';
import { FormSelect } from '../../components/forms/index.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../components/tables/DataTable.jsx';
import { useCohorts } from '../../features/cohorts/index.js';
import { useSessions } from '../../features/sessions/index.js';
import { useSessionAttendance, useSaveAttendance } from '../../features/attendance/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

const STATUSES = ['present', 'late', 'absent', 'excused'];

export function InstructorAttendancePage() {
  const { t } = useTranslation('attendance');
  const { t: tSess } = useTranslation('sessions');
  const { t: tCommon } = useTranslation('common');

  const [cohortId, setCohortId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [byStudent, setByStudent] = useState({});
  const [apiError, setApiError] = useState('');

  const { data: cohortsPayload, isLoading: cLoading } = useCohorts({}, { staleTime: 60_000 });
  const cohorts = cohortsPayload?.cohorts ?? [];

  const { data: sessPayload, isLoading: sLoading } = useSessions(cohortId || undefined, { enabled: Boolean(cohortId) });
  const sessions = sessPayload?.sessions ?? [];

  const { data: attData, isLoading: aLoading, isError } = useSessionAttendance(sessionId || undefined, { enabled: Boolean(sessionId) });
  const saveMut = useSaveAttendance();

  const students = attData?.students ?? [];

  useEffect(() => {
    if (!cohortId) setSessionId('');
  }, [cohortId]);

  useEffect(() => {
    const next = {};
    for (const s of students) {
      next[s.student_id] = s.record?.attendance_status ?? 'absent';
    }
    setByStudent(next);
  }, [students]);

  const rows = useMemo(
    () =>
      students.map((s) => ({
        ...s,
        statusVal: byStudent[s.student_id] ?? 'absent',
      })),
    [students, byStudent]
  );

  function setStatus(studentId, v) {
    setByStudent((prev) => ({ ...prev, [studentId]: v }));
  }

  async function onSave() {
    if (!sessionId) return;
    setApiError('');
    const records = students.map((s) => ({
      student_id: s.student_id,
      attendance_status: byStudent[s.student_id] ?? 'absent',
    }));
    try {
      await saveMut.mutateAsync({ sessionId, body: { records } });
    } catch (e) {
      setApiError(getApiErrorMessage(e, tCommon('errors.generic')));
    }
  }

  return (
    <div className="page page--dashboard page--instructor">
      <AdminPageHeader title={<>{t('markTitle')}</>} description="" />
      <AdminActionBar>
        <button type="button" className="btn btn--primary" onClick={onSave} disabled={!sessionId || saveMut.isPending}>
          <Save size={18} aria-hidden /> {t('saveMarks')}
        </button>
        <Link className="btn btn--outline" to="/instructor/dashboard">
          {tCommon('actions.back')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SelectField id="cohort-pick" label={t('selectCohort')} value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          <option value="">—</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </SelectField>
        <SelectField id="session-pick" label={tSess('title')} value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
          <option value="">—</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} — {s.session_date}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>
      <SectionCard title={<>{t('markTitle')}</>}>
        {apiError ? <p className="form-error">{apiError}</p> : null}
        {cLoading || (cohortId && sLoading) ? (
          <LoadingSpinner />
        ) : !sessionId ? (
          <p>{t('pickSession')}</p>
        ) : aLoading ? (
          <LoadingSpinner />
        ) : isError || !attData ? (
          <p>{tCommon('errors.generic')}</p>
        ) : (
          <DataTable
            emptyTitle={tCommon('errors.notFound')}
            emptyDescription=""
            columns={[
              { key: 'student', label: tCommon('user.fallbackName'), render: (r) => r.student?.full_name ?? '—' },
              {
                key: 'statusVal',
                label: t('statusCol'),
                render: (r) => (
                  <FormSelect id={`att-${r.student_id}`} value={r.statusVal} onChange={(e) => setStatus(r.student_id, e.target.value)}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </FormSelect>
                ),
              },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>
    </div>
  );
}
