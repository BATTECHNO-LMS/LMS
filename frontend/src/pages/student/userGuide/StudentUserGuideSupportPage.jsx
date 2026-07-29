import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/common/Button.jsx';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useAuth } from '../../../features/auth/index.js';
import {
  createSupportTicket,
  fetchMySupportTickets,
  searchHelp,
} from '../../../features/help/index.js';
import { getUserGuideBasePath } from '../../../components/help/userGuidePaths.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const CATEGORIES = [
  'ACCOUNT',
  'EMAIL_VERIFICATION',
  'PROFILE',
  'OPPORTUNITY',
  'APPLICATION',
  'SESSION',
  'ATTENDANCE',
  'ZOOM_LINK',
  'PRE_TEST',
  'POST_TEST',
  'TASK',
  'SUBMISSION',
  'AI_EVALUATION',
  'PROGRESS',
  'TRAINING_HOURS',
  'CERTIFICATE',
  'TECHNICAL',
  'OTHER',
];

export function StudentUserGuideSupportPage() {
  const { t } = useTranslation('userGuide');
  const { user } = useAuth();
  const location = useLocation();
  const guideBase = getUserGuideBasePath(user, location.pathname);
  const qc = useQueryClient();
  const isStudent = String(user?.role || '').toLowerCase() === 'student';
  const [form, setForm] = useState({
    category: 'OTHER',
    title: '',
    description: '',
  });
  const [successRef, setSuccessRef] = useState('');
  const [error, setError] = useState('');

  const ticketsQuery = useQuery({
    queryKey: ['support-tickets'],
    queryFn: fetchMySupportTickets,
    enabled: isStudent,
  });

  const relatedQuery = useQuery({
    queryKey: ['help', 'support-related', form.category],
    queryFn: () => searchHelp(form.category.replaceAll('_', ' ')),
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createSupportTicket({
        ...form,
        browser_info: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
        device_info:
          typeof window !== 'undefined'
            ? `${window.innerWidth}x${window.innerHeight}`
            : null,
      }),
    onSuccess: (data) => {
      setSuccessRef(data.ticket?.reference_code || '');
      setError('');
      setForm({ category: 'OTHER', title: '', description: '' });
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  return (
    <div className="page page--student ug-page">
      <nav className="ug-breadcrumbs" aria-label="breadcrumb">
        <Link to={guideBase}>{t('title')}</Link>
        <span aria-hidden>/</span>
        <span>{t('supportTitle')}</span>
      </nav>
      <h1 className="ug-page__title">{t('supportTitle')}</h1>
      <p className="ug-page__desc">{t('supportHint')}</p>

      <section className="ug-section">
        <h2>{t('relatedHelp')}</h2>
        <ul className="ug-article-list">
          {(relatedQuery.data?.results ?? []).slice(0, 5).map((a) => (
            <li key={a.id}>
              <Link to={`${guideBase}/articles/${a.slug}`}>{a.title_ar}</Link>
            </li>
          ))}
        </ul>
      </section>

      {isStudent ? (
        <section className="ug-section ug-support-form">
          <h2>{t('createTicket')}</h2>
          {successRef ? (
            <p className="ft-student-task-list__success">
              {t('ticketCreated', { ref: successRef })}
            </p>
          ) : null}
          {error ? <p className="form-field__error">{error}</p> : null}
          <label className="form-field__label" htmlFor="ug-ticket-cat">
            {t('ticketCategory')}
          </label>
          <select
            id="ug-ticket-cat"
            className="ft-modal-select__control"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`ticketCategories.${c}`, c)}
              </option>
            ))}
          </select>
          <FormInput
            label={t('ticketTitle')}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <FormTextarea
            label={t('ticketDescription')}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={5}
          />
          <Button
            type="button"
            variant="primary"
            disabled={createMut.isPending || form.title.trim().length < 3}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? t('sending') : t('submitTicket')}
          </Button>
        </section>
      ) : null}

      {isStudent ? (
        <section className="ug-section">
          <h2>{t('myTickets')}</h2>
          {ticketsQuery.isLoading ? <LoadingSpinner /> : null}
          <ul className="ug-article-list">
            {(ticketsQuery.data?.tickets ?? []).map((ticket) => (
              <li key={ticket.id}>
                <strong>{ticket.reference_code}</strong> — {ticket.title}
                <p>
                  {ticket.category} · {ticket.status}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
