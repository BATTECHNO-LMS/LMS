import { useState } from 'react';
import { Calendar, Pencil, Trash2, Video, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { FormInput } from '../../../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../../../components/forms/FormTextarea.jsx';
import { LoadingSpinner } from '../../../../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import {
  createOpportunitySession,
  updateOpportunitySession,
  deleteOpportunitySession,
  useOpportunitySessions,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';

const emptySession = {
  title: '',
  description: '',
  session_date: '',
  start_time: '09:00',
  end_time: '11:00',
  zoom_link: '',
  is_required: true,
};

export function ManageSessionsTab({ opportunityId, onOpenAttendance }) {
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const { data, isLoading } = useOpportunitySessions(opportunityId);
  const [form, setForm] = useState(emptySession);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const sessions = data?.sessions ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: fieldTrainingKeys.sessions(opportunityId) });

  const createMut = useMutation({
    mutationFn: (body) => createOpportunitySession(opportunityId, body),
    onSuccess: () => {
      invalidate();
      setForm(emptySession);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const updateMut = useMutation({
    mutationFn: ({ sessionId, body }) => updateOpportunitySession(sessionId, body),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setForm(emptySession);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (sessionId) => deleteOpportunitySession(sessionId),
    onSuccess: invalidate,
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function startEdit(session) {
    setEditingId(session.id);
    setForm({
      title: session.title ?? '',
      description: session.description ?? '',
      session_date: session.session_date ? String(session.session_date).slice(0, 10) : '',
      start_time: session.start_time ?? '09:00',
      end_time: session.end_time ?? '11:00',
      zoom_link: session.zoom_link ?? '',
      is_required: session.is_required !== false,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const body = {
      ...form,
      zoom_link: form.zoom_link || null,
      description: form.description || null,
    };
    if (editingId) {
      updateMut.mutate({ sessionId: editingId, body });
    } else {
      createMut.mutate(body);
    }
  }

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="ft-manage-panel">
      <h2 className="ft-manage-panel__title">{t('manageTraining.sessionsTitle')}</h2>

      <form className="ft-composer-section__grid ft-composer-section__grid--2" onSubmit={handleSubmit}>
        <FormInput
          label={t('manageTraining.sessionTitle')}
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          required
        />
        <FormInput
          label={t('manageTraining.sessionDate')}
          type="date"
          value={form.session_date}
          onChange={(e) => setForm((f) => ({ ...f, session_date: e.target.value }))}
          required
        />
        <FormInput
          label={t('manageTraining.startTime')}
          value={form.start_time}
          onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
          required
        />
        <FormInput
          label={t('manageTraining.endTime')}
          value={form.end_time}
          onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
          required
        />
        <FormInput
          label={t('manageTraining.zoomLink')}
          value={form.zoom_link}
          onChange={(e) => setForm((f) => ({ ...f, zoom_link: e.target.value }))}
        />
        <label className="form-field form-field--checkbox">
          <input
            type="checkbox"
            checked={form.is_required}
            onChange={(e) => setForm((f) => ({ ...f, is_required: e.target.checked }))}
          />
          <span>{t('manageHub.sessionRequired')}</span>
        </label>
        <div className="ft-composer-section__grid--full">
          <FormTextarea
            label={t('manageHub.sessionDescription')}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
          />
        </div>
        {error ? <p className="form-field__error">{error}</p> : null}
        <div className="ft-manage-form-actions">
          <Button type="submit" variant="primary" disabled={createMut.isPending || updateMut.isPending}>
            {editingId ? t('save') : t('manageTraining.addSession')}
          </Button>
          {editingId ? (
            <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptySession); }}>
              {t('cancel')}
            </Button>
          ) : null}
        </div>
      </form>

      <ul className="ft-session-list ft-session-list--cards">
        {sessions.map((s) => (
          <li key={s.id} className="ft-session-card">
            <div className="ft-session-card__main">
              <Calendar size={18} aria-hidden />
              <div>
                <strong>{s.title}</strong>
                <p>
                  {s.session_date} · {s.start_time}–{s.end_time}
                </p>
                {s.description ? <p className="ft-session-card__desc">{s.description}</p> : null}
              </div>
            </div>
            <div className="ft-session-card__badges">
              <StatusBadge variant={s.is_required ? 'warning' : 'muted'}>
                {s.is_required ? t('manageHub.requiredSession') : t('manageHub.optionalSession')}
              </StatusBadge>
              {s.attendance_summary ? (
                <span className="ft-session-card__summary">{s.attendance_summary}</span>
              ) : null}
            </div>
            <div className="ft-session-card__actions">
              {s.zoom_link ? (
                <a href={s.zoom_link} target="_blank" rel="noreferrer" className="btn btn--outline btn--sm">
                  <Video size={14} aria-hidden /> Zoom
                </a>
              ) : null}
              <Button type="button" variant="outline" className="btn--sm" onClick={() => onOpenAttendance(s.id)}>
                <Users size={14} aria-hidden /> {t('manageHub.recordAttendance')}
              </Button>
              <button type="button" className="btn btn--icon btn--sm" onClick={() => startEdit(s)} aria-label={t('tasks.edit')}>
                <Pencil size={16} />
              </button>
              <button
                type="button"
                className="btn btn--icon btn--sm"
                onClick={() => deleteMut.mutate(s.id)}
                disabled={deleteMut.isPending}
                aria-label={t('tasks.delete')}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!sessions.length ? <p className="ft-manage-empty">{t('manageHub.noSessions')}</p> : null}
    </div>
  );
}
