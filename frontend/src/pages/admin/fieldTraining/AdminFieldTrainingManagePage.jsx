import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Play, Users, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/common/Button.jsx';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import {
  useAdminFieldTraining,
  useOpportunityApplications,
  fetchOpportunitySessions,
  createOpportunitySession,
  startFieldTraining,
  getOpportunitySpecialtyLabel,
} from '../../../features/fieldTraining/index.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fieldTrainingKeys } from '../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const emptySession = {
  title: '',
  session_date: '',
  start_time: '09:00',
  end_time: '11:00',
  zoom_link: '',
  is_required: true,
};

export function AdminFieldTrainingManagePage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const { data: oppData, isLoading: oppLoading } = useAdminFieldTraining(id);
  const { data: appsData } = useOpportunityApplications(id);
  const [sessionForm, setSessionForm] = useState(emptySession);
  const [error, setError] = useState('');

  const opp = oppData?.opportunity;
  const approvedCount = (appsData?.applications ?? []).filter((a) => a.status === 'approved').length;

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: fieldTrainingKeys.sessions(id),
    queryFn: () => fetchOpportunitySessions(id),
    enabled: Boolean(id),
  });

  const startMut = useMutation({
    mutationFn: () => startFieldTraining(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminDetail(id) }),
  });

  const createSessionMut = useMutation({
    mutationFn: (body) => createOpportunitySession(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.sessions(id) });
      setSessionForm(emptySession);
    },
  });

  if (oppLoading) return <LoadingSpinner />;

  return (
    <div className="page page--admin ft-page">
      <header className="ft-detail-hero ft-detail-hero--compact">
        <Link to={`/admin/field-training`} className="ft-detail-back">
          <ArrowLeft size={18} aria-hidden /> {t('backToList')}
        </Link>
        <h1 className="ft-detail-hero__title">{t('manageTraining.title')}</h1>
        <p className="ft-detail-hero__subtitle">
          {opp?.title} · {getOpportunitySpecialtyLabel(opp, i18n.language)}
        </p>
        <div className="ft-detail-hero__actions">
          <Button
            type="button"
            variant="primary"
            disabled={startMut.isPending || opp?.status === 'in_progress'}
            onClick={() => startMut.mutate()}
          >
            <Play size={16} aria-hidden /> {t('manageTraining.startTraining')}
          </Button>
          <Button as={Link} to={`/admin/field-training/${id}/applications`} variant="outline">
            <Users size={16} aria-hidden /> {t('viewApplications')}
          </Button>
          <Button as={Link} to={`/admin/field-training/${id}/tasks`} variant="outline">
            {t('tasks.adminTitle')}
          </Button>
        </div>
        <p className="ft-detail-hero__meta">
          {t('manageTraining.approvedCount', { count: approvedCount })} ·{' '}
          {t(`status.${opp?.status || 'draft'}`)}
        </p>
      </header>

      <section className="ft-composer-section">
        <h2 className="ft-composer-section__title">
          <Video size={18} aria-hidden /> {t('manageTraining.sessionsTitle')}
        </h2>
        <form
          className="ft-composer-section__grid ft-composer-section__grid--2"
          onSubmit={(e) => {
            e.preventDefault();
            setError('');
            createSessionMut.mutate(
              {
                ...sessionForm,
                zoom_link: sessionForm.zoom_link || null,
              },
              { onError: (err) => setError(getApiErrorMessage(err)) }
            );
          }}
        >
          <FormInput
            label={t('manageTraining.sessionTitle')}
            value={sessionForm.title}
            onChange={(e) => setSessionForm((f) => ({ ...f, title: e.target.value }))}
          />
          <FormInput
            label={t('manageTraining.sessionDate')}
            type="date"
            value={sessionForm.session_date}
            onChange={(e) => setSessionForm((f) => ({ ...f, session_date: e.target.value }))}
          />
          <FormInput
            label={t('manageTraining.startTime')}
            value={sessionForm.start_time}
            onChange={(e) => setSessionForm((f) => ({ ...f, start_time: e.target.value }))}
          />
          <FormInput
            label={t('manageTraining.endTime')}
            value={sessionForm.end_time}
            onChange={(e) => setSessionForm((f) => ({ ...f, end_time: e.target.value }))}
          />
          <FormInput
            label={t('manageTraining.zoomLink')}
            value={sessionForm.zoom_link}
            onChange={(e) => setSessionForm((f) => ({ ...f, zoom_link: e.target.value }))}
          />
          {error ? <p className="form-field__error">{error}</p> : null}
          <div>
            <Button type="submit" variant="primary" disabled={createSessionMut.isPending}>
              {t('manageTraining.addSession')}
            </Button>
          </div>
        </form>

        {sessionsLoading ? (
          <LoadingSpinner />
        ) : (
          <ul className="ft-session-list">
            {(sessionsData?.sessions ?? []).map((s) => (
              <li key={s.id} className="ft-session-list__item">
                <Calendar size={16} aria-hidden />
                <strong>{s.title}</strong>
                <span>
                  {s.session_date} {s.start_time}–{s.end_time}
                </span>
                {s.zoom_link ? (
                  <a href={s.zoom_link} target="_blank" rel="noreferrer" className="ft-session-list__zoom">
                    Zoom
                  </a>
                ) : null}
                {s.attendance?.status ? (
                  <span className="ft-session-list__att">{s.attendance.status}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
