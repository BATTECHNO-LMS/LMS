import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormInput } from '../../../../../components/forms/FormInput.jsx';
import { updateApplicationHours } from '../../../../../features/fieldTraining/fieldTraining.service.js';

/**
 * Instructor/admin control to replace total completed training hours (Model A).
 */
export function ApplicationHoursPanel({
  applicationId,
  hours,
  asInstructor = false,
  onUpdated,
  canEdit = true,
}) {
  const { t } = useTranslation('fieldTraining');
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    hours?.completed_training_hours != null ? String(hours.completed_training_hours) : ''
  );
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const required = hours?.required_training_hours;
  const completed = hours?.completed_training_hours;
  const remaining = hours?.remaining_training_hours;
  const pct = hours?.hours_progress_percentage;

  async function save(e) {
    e.preventDefault();
    setError('');
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) {
      setError(t('form.requiredHoursPositive'));
      return;
    }
    if (required != null && n > required) {
      setError(t('form.hoursExceedRequired'));
      return;
    }
    setSaving(true);
    try {
      const result = await updateApplicationHours(
        applicationId,
        {
          completed_hours: n,
          note: note.trim() || null,
          expected_completed_hours: completed ?? null,
        },
        { asInstructor }
      );
      setOpen(false);
      setNote('');
      onUpdated?.(result);
    } catch (err) {
      const code = err?.response?.data?.code || err?.code;
      if (err?.response?.status === 409 || code === 'HOURS_CONFLICT') {
        setError(t('form.hoursConflict'));
      } else {
        setError(err?.response?.data?.message || err?.message || t('form.hoursExceedRequired'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ft-hours-panel" aria-label={t('form.completedTrainingHours')}>
      <dl className="ft-hours-panel__stats">
        <div>
          <dt>{t('form.requiredTrainingHours')}</dt>
          <dd>{required != null ? required : t('form.hoursNotConfigured')}</dd>
        </div>
        <div>
          <dt>{t('form.completedTrainingHours')}</dt>
          <dd>
            {completed != null
              ? t('hours.completedDone', { count: completed })
              : t('form.hoursNotRecorded')}
          </dd>
        </div>
        <div>
          <dt>{t('form.remainingTrainingHours')}</dt>
          <dd>{remaining != null ? remaining : '—'}</dd>
        </div>
        <div>
          <dt>{t('form.hoursProgress')}</dt>
          <dd>{pct != null ? `${pct}%` : '—'}</dd>
        </div>
      </dl>

      {canEdit ? (
        open ? (
          <form className="ft-hours-panel__form" onSubmit={save}>
            <FormInput
              id={`ft-hours-${applicationId}`}
              type="number"
              min={0}
              max={required ?? 10000}
              label={t('form.updateHours')}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
            <FormInput
              id={`ft-hours-note-${applicationId}`}
              label={t('form.hoursNote')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {error ? <p className="form-field__error" role="alert">{error}</p> : null}
            <div className="ft-hours-panel__actions">
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {t('form.updateHours')}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                {t('common.cancel', { defaultValue: 'إلغاء' })}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="btn btn--secondary" onClick={() => setOpen(true)}>
            {completed != null ? t('form.updateHours') : t('form.recordHours')}
          </button>
        )
      ) : null}
    </section>
  );
}
