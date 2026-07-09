import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { FormInput } from '../../../../../components/forms/FormInput.jsx';
import { LoadingSpinner } from '../../../../../components/common/LoadingSpinner.jsx';
import {
  fetchSessionParticipants,
  saveSessionAttendance,
  useOpportunitySessions,
  useSessionAttendance,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';

const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused'];

export function ManageAttendanceTab({
  opportunityId,
  preselectedSessionId,
  onSessionChange,
  apiScope = 'admin',
}) {
  const isInstructor = apiScope === 'instructor';
  const { t, i18n } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const { data: sessionsData, isLoading: sessionsLoading } = useOpportunitySessions(opportunityId, {
    scope: apiScope,
  });
  const [sessionId, setSessionId] = useState(preselectedSessionId || '');
  const [records, setRecords] = useState({});
  const [noteByApp, setNoteByApp] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const sessions = sessionsData?.sessions ?? [];

  useEffect(() => {
    if (preselectedSessionId) setSessionId(preselectedSessionId);
  }, [preselectedSessionId]);

  const { data: attendanceData, isLoading: attLoading } = useSessionAttendance(sessionId, {
    enabled: Boolean(sessionId),
    scope: apiScope,
  });

  const { data: participantsData, isLoading: partLoading } = useQuery({
    queryKey: fieldTrainingKeys.sessionParticipants(sessionId),
    queryFn: () => fetchSessionParticipants(sessionId, { asInstructor: isInstructor }),
    enabled: Boolean(sessionId),
  });

  useEffect(() => {
    const existing = attendanceData?.records ?? [];
    const next = {};
    const notes = {};
    existing.forEach((r) => {
      next[r.application_id] = r.status;
      if (r.note) notes[r.application_id] = r.note;
    });
    (participantsData?.participants ?? []).forEach((p) => {
      if (!next[p.application_id]) next[p.application_id] = 'absent';
    });
    setRecords(next);
    setNoteByApp(notes);
  }, [attendanceData, participantsData]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveSessionAttendance(
        sessionId,
        Object.entries(records).map(([application_id, status]) => ({
          application_id,
          status,
          note: noteByApp[application_id] || null,
        })),
        { asInstructor: isInstructor }
      ),
    onSuccess: () => {
      setSuccess(t('manageHub.attendanceSaved'));
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.sessionAttendance(sessionId) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(opportunityId) });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  if (sessionsLoading) return <LoadingSpinner />;

  return (
    <div className="ft-manage-panel">
      <h2 className="ft-manage-panel__title">{t('manageHub.tabs.attendance')}</h2>

      <div className="ft-manage-attendance-picker">
        <label className="form-field__label" htmlFor="ft-att-session">
          {t('manageHub.selectSession')}
        </label>
        <select
          id="ft-att-session"
          className="ft-modal-select__control"
          value={sessionId}
          onChange={(e) => {
            setSessionId(e.target.value);
            onSessionChange?.(e.target.value);
          }}
        >
          <option value="">{t('manageHub.selectSessionPlaceholder')}</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} — {s.session_date}
            </option>
          ))}
        </select>
      </div>

      {!sessionId ? <p className="ft-manage-empty">{t('manageHub.pickSessionForAttendance')}</p> : null}

      {sessionId && (attLoading || partLoading) ? <LoadingSpinner /> : null}

      {sessionId && !attLoading && !partLoading ? (
        <>
          <div className="ft-attendance-table">
            {(participantsData?.participants ?? []).map((p) => (
              <article key={p.application_id} className="ft-attendance-row">
                <div className="ft-attendance-row__student">
                  <strong>{p.student_name}</strong>
                  <span>{p.student_university}</span>
                </div>
                <div className="ft-attendance-row__controls" role="radiogroup" aria-label={p.student_name}>
                  {ATTENDANCE_STATUSES.map((status) => (
                    <label key={status} className="ft-attendance-chip">
                      <input
                        type="radio"
                        name={`att-${p.application_id}`}
                        checked={records[p.application_id] === status}
                        onChange={() => setRecords((prev) => ({ ...prev, [p.application_id]: status }))}
                      />
                      <span>{t(`attendanceStatus.${status}`)}</span>
                    </label>
                  ))}
                </div>
                <FormInput
                  label={t('manageHub.attendanceNote')}
                  value={noteByApp[p.application_id] ?? ''}
                  onChange={(e) =>
                    setNoteByApp((prev) => ({ ...prev, [p.application_id]: e.target.value }))
                  }
                />
              </article>
            ))}
          </div>
          {!participantsData?.participants?.length ? (
            <p className="ft-manage-empty">{t('manageHub.noParticipantsForAttendance')}</p>
          ) : null}
          {error ? <p className="form-field__error">{error}</p> : null}
          {success ? <p className="auth-register__helper">{success}</p> : null}
          <Button
            type="button"
            variant="primary"
            disabled={saveMut.isPending || !participantsData?.participants?.length}
            onClick={() => {
              setError('');
              setSuccess('');
              saveMut.mutate();
            }}
          >
            {saveMut.isPending ? t('saving') : t('manageHub.saveAttendance')}
          </Button>
        </>
      ) : null}
    </div>
  );
}
