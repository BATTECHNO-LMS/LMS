import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { FormInput } from '../../../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../../../components/forms/FormTextarea.jsx';
import { LoadingSpinner } from '../../../../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import {
  fetchSessionParticipants,
  saveSessionAttendance,
  useOpportunitySessions,
  useSessionAttendance,
  openAttendanceWindow,
  fetchAttendanceWindow,
  closeAttendanceWindow,
  finalizeAttendanceAbsences,
  patchStudentAttendance,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';

const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused', 'unconfirmed'];
const DURATION_OPTIONS = [
  { value: 60, labelKey: '1' },
  { value: 120, labelKey: '2' },
  { value: 180, labelKey: '3' },
  { value: 300, labelKey: '5' },
];

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function ManageAttendanceTab({
  opportunityId,
  preselectedSessionId,
  onSessionChange,
  apiScope = 'admin',
}) {
  const isInstructor = apiScope === 'instructor';
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const { data: sessionsData, isLoading: sessionsLoading } = useOpportunitySessions(opportunityId, {
    scope: apiScope,
  });
  const [sessionId, setSessionId] = useState(preselectedSessionId || '');
  const [records, setRecords] = useState({});
  const [noteByApp, setNoteByApp] = useState({});
  const [reasonByApp, setReasonByApp] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openForm, setOpenForm] = useState({
    code: randomCode(),
    duration_seconds: 120,
    mode: 'normal',
    notes: '',
  });
  const [announcedCode, setAnnouncedCode] = useState('');

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

  const { data: windowData, refetch: refetchWindow } = useQuery({
    queryKey: [...fieldTrainingKeys.all, 'attendance-window', sessionId],
    queryFn: () => fetchAttendanceWindow(sessionId, { asInstructor: isInstructor }),
    enabled: Boolean(sessionId),
    refetchInterval: (query) =>
      query.state.data?.window?.status === 'open' ? 5000 : false,
  });

  useEffect(() => {
    const next = {};
    const notes = {};
    const reasons = {};
    const participants = participantsData?.participants ?? [];
    participants.forEach((p) => {
      const appId = p.id || p.application_id;
      const att = p.attendance;
      if (att?.status) next[appId] = att.status;
      if (att?.note) notes[appId] = att.note;
      if (att?.manual_reason) reasons[appId] = att.manual_reason;
    });
    (attendanceData?.records ?? []).forEach((r) => {
      const appId = r.application_id;
      if (appId) {
        next[appId] = r.status;
        if (r.note) notes[appId] = r.note;
        if (r.manual_reason) reasons[appId] = r.manual_reason;
      }
    });
    setRecords(next);
    setNoteByApp(notes);
    setReasonByApp(reasons);
  }, [attendanceData, participantsData]);

  const participants = useMemo(() => {
    return (participantsData?.participants ?? []).map((p) => ({
      ...p,
      application_id: p.id || p.application_id,
      student_id: p.student_id,
    }));
  }, [participantsData]);

  const activeWindow = windowData?.window;
  const windowOpen = activeWindow?.status === 'open';

  function invalidateAttendance() {
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.sessionAttendance(sessionId) });
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.sessionParticipants(sessionId) });
    qc.invalidateQueries({ queryKey: [...fieldTrainingKeys.all, 'attendance-window', sessionId] });
    qc.invalidateQueries({ queryKey: [...fieldTrainingKeys.all, 'student', 'progress'] });
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentSessions(opportunityId) });
  }

  const saveMut = useMutation({
    mutationFn: () =>
      saveSessionAttendance(
        sessionId,
        participants.map((p) => ({
          applicationId: p.application_id,
          studentId: p.student_id,
          status: records[p.application_id] || 'unconfirmed',
          note: noteByApp[p.application_id] || null,
          manual_reason: reasonByApp[p.application_id] || t('attendance.manualReasonDefault'),
        })),
        { asInstructor: isInstructor }
      ),
    onSuccess: () => {
      setSuccess(t('manageHub.attendanceSaved'));
      setError('');
      invalidateAttendance();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const openMut = useMutation({
    mutationFn: () =>
      openAttendanceWindow(
        sessionId,
        {
          code: openForm.code,
          duration_seconds: openForm.duration_seconds,
          mode: openForm.mode,
          notes: openForm.notes || null,
        },
        { asInstructor: isInstructor }
      ),
    onSuccess: (data) => {
      setAnnouncedCode(data.code || data.window?.code || openForm.code);
      setShowOpenModal(false);
      setSuccess(t('attendance.windowOpened'));
      invalidateAttendance();
      refetchWindow();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const closeMut = useMutation({
    mutationFn: () => closeAttendanceWindow(sessionId, { asInstructor: isInstructor }),
    onSuccess: () => {
      setAnnouncedCode('');
      setSuccess(t('attendance.windowClosed'));
      invalidateAttendance();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const finalizeMut = useMutation({
    mutationFn: () => finalizeAttendanceAbsences(sessionId, { asInstructor: isInstructor }),
    onSuccess: (data) => {
      setSuccess(t('attendance.finalizeDone', { count: data.updated ?? 0 }));
      invalidateAttendance();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const patchMut = useMutation({
    mutationFn: ({ studentId, status, reason }) =>
      patchStudentAttendance(
        sessionId,
        studentId,
        { status, manual_reason: reason },
        { asInstructor: isInstructor }
      ),
    onSuccess: () => invalidateAttendance(),
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
            setAnnouncedCode('');
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

      {sessionId ? (
        <div className="ft-manage-inline-actions" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <Button
            type="button"
            variant="primary"
            className="btn--sm"
            disabled={windowOpen || openMut.isPending}
            onClick={() => {
              setOpenForm({ code: randomCode(), duration_seconds: 120, mode: 'normal', notes: '' });
              setShowOpenModal(true);
              setError('');
            }}
          >
            {t('attendance.startElectronic')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="btn--sm"
            disabled={windowOpen || openMut.isPending}
            onClick={() => {
              setOpenForm({ code: randomCode(), duration_seconds: 120, mode: 'late', notes: '' });
              setShowOpenModal(true);
            }}
          >
            {t('attendance.openLateWindow')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="btn--sm"
            disabled={!windowOpen || closeMut.isPending}
            onClick={() => closeMut.mutate()}
          >
            {t('attendance.closeWindow')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="btn--sm"
            disabled={windowOpen || finalizeMut.isPending}
            onClick={() => {
              if (window.confirm(t('attendance.finalizeConfirm'))) finalizeMut.mutate();
            }}
          >
            {t('attendance.finalizeAbsences')}
          </Button>
        </div>
      ) : null}

      {activeWindow ? (
        <div className="ft-manage-review-block" role="status">
          <div className="ft-manage-inline-actions" style={{ gap: 8, flexWrap: 'wrap' }}>
            <StatusBadge variant={windowOpen ? 'warning' : 'muted'}>
              {t(`attendance.windowStatuses.${activeWindow.status}`)}
            </StatusBadge>
            <StatusBadge variant="info">
              {t(`attendance.modes.${activeWindow.mode || 'normal'}`)}
            </StatusBadge>
            {windowOpen && activeWindow.remaining_seconds != null ? (
              <span>
                {t('attendance.remaining', { seconds: activeWindow.remaining_seconds })}
              </span>
            ) : null}
          </div>
          {announcedCode ? (
            <p>
              <strong>{t('attendance.codeLabel')}:</strong> {announcedCode}
            </p>
          ) : (
            <p className="ft-manage-panel__desc">{t('attendance.codeHiddenHint')}</p>
          )}
          <p>
            {t('attendance.stats', {
              eligible: activeWindow.eligible_count ?? 0,
              confirmed: activeWindow.confirmed_count ?? 0,
              unconfirmed: activeWindow.unconfirmed_count ?? 0,
            })}
          </p>
        </div>
      ) : null}

      {error ? <p className="form-field__error">{error}</p> : null}
      {success ? <p className="ft-student-task-list__success">{success}</p> : null}

      {sessionId && (attLoading || partLoading) ? <LoadingSpinner /> : null}

      {sessionId && !attLoading && !partLoading ? (
        <>
          <div className="ft-manage-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('table.student')}</th>
                  <th>{t('attendance.status')}</th>
                  <th>{t('attendance.method')}</th>
                  <th>{t('attendance.manualReason')}</th>
                  <th>{t('tasks.review')}</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => {
                  const appId = p.application_id;
                  const att = p.attendance;
                  return (
                    <tr key={appId}>
                      <td>{p.student_name || p.student_id}</td>
                      <td>
                        <select
                          className="ft-modal-select__control"
                          value={records[appId] || att?.status || 'unconfirmed'}
                          onChange={(e) =>
                            setRecords((r) => ({ ...r, [appId]: e.target.value }))
                          }
                        >
                          {ATTENDANCE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {t(`attendance.statuses.${s}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {att?.method
                          ? t(`attendance.methods.${att.method}`, att.method)
                          : '—'}
                      </td>
                      <td>
                        <FormInput
                          value={reasonByApp[appId] || ''}
                          onChange={(e) =>
                            setReasonByApp((r) => ({ ...r, [appId]: e.target.value }))
                          }
                          placeholder={t('attendance.manualReason')}
                        />
                      </td>
                      <td>
                        <Button
                          type="button"
                          variant="outline"
                          className="btn--sm"
                          disabled={patchMut.isPending || !(reasonByApp[appId] || '').trim()}
                          onClick={() =>
                            patchMut.mutate({
                              studentId: p.student_id,
                              status: records[appId] || 'present',
                              reason: reasonByApp[appId],
                            })
                          }
                        >
                          {t('attendance.saveOne')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button
            type="button"
            variant="primary"
            disabled={saveMut.isPending || !participants.length}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? t('saving') : t('manageHub.saveAttendance')}
          </Button>
        </>
      ) : null}

      {showOpenModal ? (
        <div className="ft-modal-backdrop" onClick={() => setShowOpenModal(false)} role="presentation">
          <div className="ft-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <header className="ft-modal__header">
              <h2 className="ft-modal__title">
                {openForm.mode === 'late'
                  ? t('attendance.openLateWindow')
                  : t('attendance.startElectronic')}
              </h2>
            </header>
            <div className="ft-modal__body">
              <FormInput
                label={t('attendance.codeLabel')}
                value={openForm.code}
                onChange={(e) => setOpenForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              />
              <Button
                type="button"
                variant="outline"
                className="btn--sm"
                onClick={() => setOpenForm((f) => ({ ...f, code: randomCode() }))}
              >
                {t('attendance.generateCode')}
              </Button>
              <label className="form-field__label">{t('attendance.duration')}</label>
              <select
                className="ft-modal-select__control"
                value={openForm.duration_seconds}
                onChange={(e) =>
                  setOpenForm((f) => ({ ...f, duration_seconds: Number(e.target.value) }))
                }
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {t(`attendance.durationMinutes.${d.labelKey}`)}
                  </option>
                ))}
              </select>
              <FormTextarea
                label={t('attendance.notes')}
                value={openForm.notes}
                onChange={(e) => setOpenForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>
            <footer className="ft-modal__footer">
              <Button type="button" variant="outline" onClick={() => setShowOpenModal(false)}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={openMut.isPending || !openForm.code.trim()}
                onClick={() => openMut.mutate()}
              >
                {openMut.isPending ? t('saving') : t('attendance.startNow')}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
