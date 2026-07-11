import { useState } from 'react';
import { Calendar, Pencil, Trash2, Video, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { FormInput } from '../../../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../../../components/forms/FormTextarea.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import {
  createOpportunitySession,
  updateOpportunitySession,
  deleteOpportunitySession,
  useOpportunitySessions,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { ManageTabEmpty, ManageTabSkeleton } from './ManageTabStates.jsx';

function normalizeTimeValue(value) {
  if (!value) return '';
  const str = String(value).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return str;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function normalizeZoomLink(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

const emptySession = {
  title: '',
  description: '',
  session_date: '',
  start_time: '09:00',
  end_time: '11:00',
  zoom_link: '',
  is_required: true,
};

export function ManageSessionsTab({ opportunityId, onOpenAttendance, apiScope = 'admin' }) {
  const isInstructor = apiScope === 'instructor';
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const { data, isLoading } = useOpportunitySessions(opportunityId, { scope: apiScope });
  const [form, setForm] = useState(emptySession);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const sessions = data?.sessions ?? [];

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.sessions(opportunityId, apiScope) });

  const createMut = useMutation({
    mutationFn: (body) => createOpportunitySession(opportunityId, body, { asInstructor: isInstructor }),
    onSuccess: () => {
      invalidate();
      setForm(emptySession);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const updateMut = useMutation({
    mutationFn: ({ sessionId, body }) =>
      updateOpportunitySession(sessionId, body, { asInstructor: isInstructor }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setForm(emptySession);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (sessionId) => deleteOpportunitySession(sessionId, { asInstructor: isInstructor }),
    onSuccess: invalidate,
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function startEdit(session) {
    setEditingId(session.id);
    setForm({
      title: session.title ?? '',
      description: session.description ?? '',
      session_date: session.session_date ? String(session.session_date).slice(0, 10) : '',
      start_time: normalizeTimeValue(session.start_time ?? '09:00'),
      end_time: normalizeTimeValue(session.end_time ?? '11:00'),
      zoom_link: session.zoom_link ?? '',
      is_required: session.is_required !== false,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const session_date = form.session_date?.trim();
    if (!session_date) {
      setError(t('manageTraining.sessionDateRequired', { defaultValue: 'Session date is required' }));
      return;
    }

    const start_time = normalizeTimeValue(form.start_time);
    const end_time = normalizeTimeValue(form.end_time);
    if (!/^\d{2}:\d{2}$/.test(start_time) || !/^\d{2}:\d{2}$/.test(end_time)) {
      setError(t('manageTraining.timeInvalid', { defaultValue: 'Enter valid start and end times (HH:MM)' }));
      return;
    }

    const body = {
      title: form.title.trim(),
      description: form.description?.trim() || null,
      session_date,
      start_time,
      end_time,
      zoom_link: normalizeZoomLink(form.zoom_link),
      is_required: form.is_required,
    };
    if (editingId) {
      updateMut.mutate({ sessionId: editingId, body });
    } else {
      createMut.mutate(body);
    }
  }

  if (isLoading) return <ManageTabSkeleton rows={3} />;

  return (
    <div className="ft-manage-panel">
      <header className="ft-manage-panel__head">
        <div>
          <h2 className="ft-manage-panel__title">{t('manageTraining.sessionsTitle')}</h2>
          <p className="ft-manage-panel__desc">{t('manageHub.sessionsDesc')}</p>
        </div>
      </header>

      {error ? <p className="form-field__error">{error}</p> : null}

      <form className="ft-manage-form ft-manage-form--session" onSubmit={handleSubmit}>
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
          type="time"
          value={form.start_time}
          onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
          required
        />
        <FormInput
          label={t('manageTraining.endTime')}
          type="time"
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

      {!sessions.length ? (
        <ManageTabEmpty icon={Calendar} title={t('manageHub.noSessions')} />
      ) : (
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
                <button type="button" className="btn btn--icon btn--sm" onClick={() => startEdit(s)} aria-label={t('edit')}>
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
      )}
    </div>
  );
}
