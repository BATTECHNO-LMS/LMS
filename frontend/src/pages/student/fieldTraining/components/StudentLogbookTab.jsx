import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../../components/common/EmptyState.jsx';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';
import {
  createStudentLogbookEntry,
  fetchStudentLogbook,
  submitStudentLogbookEntry,
  updateStudentLogbookEntry,
  deleteStudentLogbookEntry,
  uploadStudentLogbookAttachment,
} from '../../../../features/fieldTraining/fieldTraining.service.js';
import { fieldTrainingKeys } from '../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';

const EMPTY_FORM = {
  entry_date: new Date().toISOString().slice(0, 10),
  activity: '',
  learning_outcome: '',
  skills: '',
  challenges: '',
  outcome: '',
  reported_hours: '',
};

export function StudentLogbookTab({ opportunityId, enabled = true }) {
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  const query = useQuery({
    queryKey: fieldTrainingKeys.studentLogbook(opportunityId, { status: filter === 'all' ? undefined : filter }),
    queryFn: () =>
      fetchStudentLogbook(opportunityId, {
        ...(filter !== 'all' ? { status: filter } : {}),
        page_size: 50,
      }),
    enabled: Boolean(opportunityId) && enabled,
    staleTime: 20_000,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.studentLogbook(opportunityId) });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        reported_hours: form.reported_hours === '' ? null : Number(form.reported_hours),
      };
      if (editingId) return updateStudentLogbookEntry(editingId, body);
      return createStudentLogbookEntry(opportunityId, body);
    },
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setEditingId(null);
      setError('');
      invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err, t('logbook.saveError'))),
  });

  const submitMutation = useMutation({
    mutationFn: (entryId) => submitStudentLogbookEntry(entryId),
    onSuccess: () => invalidate(),
    onError: (err) => setError(getApiErrorMessage(err, t('logbook.submitError'))),
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId) => deleteStudentLogbookEntry(entryId),
    onSuccess: () => invalidate(),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ entryId, file }) => uploadStudentLogbookAttachment(entryId, file),
    onSuccess: () => invalidate(),
    onError: (err) => setError(getApiErrorMessage(err, t('logbook.uploadError'))),
  });

  const summary = query.data?.summary || {};
  const entries = query.data?.entries || [];

  const grouped = useMemo(() => {
    const buckets = {
      DRAFT: [],
      REVISION_REQUESTED: [],
      SUBMITTED: [],
      APPROVED: [],
    };
    for (const e of entries) {
      (buckets[e.status] || buckets.DRAFT).push(e);
    }
    return buckets;
  }, [entries]);

  if (query.isLoading) return <LoadingSpinner />;
  if (query.isError) {
    return (
      <EmptyState
        title={t('logbook.loadError')}
        description={getApiErrorMessage(query.error, t('loadError'))}
      />
    );
  }

  return (
    <div className="ft-logbook">
      <header className="ft-logbook__hero">
        <div>
          <p className="ft-logbook__eyebrow">{t('logbook.eyebrow')}</p>
          <h2 className="ft-logbook__title">{t('logbook.title')}</h2>
        </div>
        <div className="ft-logbook__summary" role="status">
          <span>{t('logbook.summary.total', { n: summary.total || 0 })}</span>
          <span>{t('logbook.summary.approved', { n: summary.approved || 0 })}</span>
          <span>{t('logbook.summary.pending', { n: summary.submitted || 0 })}</span>
          <span>{t('logbook.summary.revision', { n: summary.revision_requested || 0 })}</span>
        </div>
      </header>

      <form
        className="ft-logbook__form"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <h3>{editingId ? t('logbook.editDraft') : t('logbook.newEntry')}</h3>
        <label>
          {t('logbook.fields.date')} *
          <input
            type="date"
            required
            value={form.entry_date}
            onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))}
          />
        </label>
        <label>
          {t('logbook.fields.activity')} *
          <textarea
            required
            rows={3}
            value={form.activity}
            onChange={(e) => setForm((f) => ({ ...f, activity: e.target.value }))}
          />
        </label>
        <label>
          {t('logbook.fields.learning')} *
          <textarea
            required
            rows={3}
            value={form.learning_outcome}
            onChange={(e) => setForm((f) => ({ ...f, learning_outcome: e.target.value }))}
          />
        </label>
        <label>
          {t('logbook.fields.skills')}
          <input
            value={form.skills}
            onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
            placeholder={t('logbook.fields.skillsHint')}
          />
        </label>
        <label>
          {t('logbook.fields.challenges')}
          <textarea
            rows={2}
            value={form.challenges}
            onChange={(e) => setForm((f) => ({ ...f, challenges: e.target.value }))}
          />
        </label>
        <label>
          {t('logbook.fields.outcome')}
          <textarea
            rows={2}
            value={form.outcome}
            onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
          />
        </label>
        <label>
          {t('logbook.fields.hours')}
          <input
            type="number"
            min="0"
            max="24"
            step="0.5"
            value={form.reported_hours}
            onChange={(e) => setForm((f) => ({ ...f, reported_hours: e.target.value }))}
          />
          <small>{t('logbook.fields.hoursHint')}</small>
        </label>
        {error ? <p className="ft-logbook__error" role="alert">{error}</p> : null}
        <div className="ft-logbook__form-actions">
          <button type="submit" className="btn btn--primary" disabled={saveMutation.isPending}>
            {t('logbook.saveDraft')}
          </button>
          {editingId ? (
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              {t('cancel')}
            </button>
          ) : null}
        </div>
      </form>

      <div className="ft-logbook__filters">
        {['all', 'DRAFT', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED'].map((key) => (
          <button
            key={key}
            type="button"
            className={`ft-logbook__chip${filter === key ? ' is-active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {t(`logbook.filters.${key}`)}
          </button>
        ))}
      </div>

      {!entries.length ? (
        <EmptyState title={t('logbook.emptyTitle')} description={t('logbook.emptyDesc')} />
      ) : (
        <div className="ft-logbook__lists">
          {['REVISION_REQUESTED', 'DRAFT', 'SUBMITTED', 'APPROVED'].map((status) =>
            grouped[status]?.length ? (
              <section key={status} className="ft-logbook__section">
                <h3>{t(`logbook.status.${status}`)}</h3>
                <ul className="ft-logbook__cards">
                  {grouped[status].map((entry) => (
                    <li key={entry.id} className={`ft-logbook__card status-${status.toLowerCase()}`}>
                      <div className="ft-logbook__card-head">
                        <strong>{String(entry.entry_date).slice(0, 10)}</strong>
                        <span>{t(`logbook.status.${entry.status}`)}</span>
                      </div>
                      <p>{entry.activity}</p>
                      <p className="ft-logbook__muted">{entry.learning_outcome}</p>
                      {entry.revision_comment ? (
                        <p className="ft-logbook__revision" role="status">
                          {t('logbook.revisionComment')}: {entry.revision_comment}
                        </p>
                      ) : null}
                      {entry.reported_hours != null ? (
                        <p className="ft-logbook__muted">
                          {t('logbook.reportedHours', { n: entry.reported_hours })}
                        </p>
                      ) : null}
                      {entry.attachments?.length ? (
                        <ul className="ft-logbook__files">
                          {entry.attachments.map((a) => (
                            <li key={a.id}>{a.original_name}</li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="ft-logbook__card-actions">
                        {['DRAFT', 'REVISION_REQUESTED'].includes(entry.status) ? (
                          <>
                            <button
                              type="button"
                              className="btn btn--sm btn--outline"
                              onClick={() => {
                                setEditingId(entry.id);
                                setForm({
                                  entry_date: String(entry.entry_date).slice(0, 10),
                                  activity: entry.activity || '',
                                  learning_outcome: entry.learning_outcome || '',
                                  skills: entry.skills || '',
                                  challenges: entry.challenges || '',
                                  outcome: entry.outcome || '',
                                  reported_hours:
                                    entry.reported_hours != null ? String(entry.reported_hours) : '',
                                });
                              }}
                            >
                              {t('edit')}
                            </button>
                            <button
                              type="button"
                              className="btn btn--sm btn--primary"
                              onClick={() => submitMutation.mutate(entry.id)}
                            >
                              {t('logbook.submit')}
                            </button>
                            <label className="btn btn--sm btn--outline">
                              {t('logbook.attach')}
                              <input
                                type="file"
                                hidden
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) uploadMutation.mutate({ entryId: entry.id, file });
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {entry.status === 'DRAFT' ? (
                              <button
                                type="button"
                                className="btn btn--sm btn--outline"
                                onClick={() => deleteMutation.mutate(entry.id)}
                              >
                                {t('logbook.deleteDraft')}
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
