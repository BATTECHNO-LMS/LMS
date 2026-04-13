import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { FormSelect } from '../../../components/forms/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { useSessionAttendance, useSaveAttendance, useUpdateAttendanceRecord } from '../../../features/attendance/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

const STATUSES = ['present', 'late', 'absent', 'excused'];

export function SessionAttendancePage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('attendance');
  const { t: tCommon } = useTranslation('common');
  const { sessionId } = useParams();
  const { data, isLoading, isError } = useSessionAttendance(sessionId);
  const saveMut = useSaveAttendance();
  const updateRowMut = useUpdateAttendanceRecord();

  const [byStudent, setByStudent] = useState({});
  const [apiError, setApiError] = useState('');

  const students = data?.students ?? [];

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

  async function onSaveRow(r) {
    if (!r.record?.id) return;
    setApiError('');
    try {
      await updateRowMut.mutateAsync({
        id: r.record.id,
        body: { attendance_status: byStudent[r.student_id] ?? 'absent' },
      });
    } catch (e) {
      setApiError(getApiErrorMessage(e, tCommon('errors.generic')));
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
          {tCommon('actions.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('markTitle')}</>} description={data.cohort_title ?? ''} />
      <SectionCard
        title={t('markTitle')}
        actions={
          <>
            <Link className="btn btn--outline" to={`${base}/sessions/${sessionId}`}>
              {tCommon('actions.back')}
            </Link>
            <button type="button" className="btn btn--primary" onClick={onSave} disabled={saveMut.isPending}>
              <Save size={18} aria-hidden /> {t('saveMarks')}
            </button>
          </>
        }
      >
        {apiError ? <p className="form-error">{apiError}</p> : null}
        <DataTable
          emptyTitle={t('emptyRoster')}
          emptyDescription=""
          columns={[
            {
              key: 'student',
              label: tCommon('user.fallbackName'),
              render: (r) => r.student?.full_name ?? '—',
            },
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
            {
              key: 'row',
              label: t('saveRow'),
              render: (r) =>
                r.record?.id ? (
                  <button type="button" className="btn btn--outline" disabled={updateRowMut.isPending} onClick={() => onSaveRow(r)}>
                    {t('saveRow')}
                  </button>
                ) : (
                  <span>—</span>
                ),
            },
          ]}
          rows={rows}
        />
      </SectionCard>
    </div>
  );
}
