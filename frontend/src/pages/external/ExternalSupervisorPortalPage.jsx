import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  fetchExternalSupervisorDashboard,
  fetchExternalSupervisorStudent,
  confirmExternalHours,
  submitExternalEvaluation,
} from '../../features/fieldTraining/fieldTraining.service.js';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function ExternalSupervisorPortalPage() {
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);

  const dash = useQuery({
    queryKey: ['ft-external-dashboard'],
    queryFn: fetchExternalSupervisorDashboard,
    refetchInterval: 45_000,
  });

  const detail = useQuery({
    queryKey: ['ft-external-student', selectedId],
    queryFn: () => fetchExternalSupervisorStudent(selectedId),
    enabled: Boolean(selectedId),
  });

  const hoursMut = useMutation({
    mutationFn: ({ applicationId, completed_hours, expected }) =>
      confirmExternalHours(applicationId, {
        completed_hours,
        expected_completed_hours: expected,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ft-external-dashboard'] });
      qc.invalidateQueries({ queryKey: ['ft-external-student', selectedId] });
    },
  });

  const evalMut = useMutation({
    mutationFn: ({ applicationId, body }) => submitExternalEvaluation(applicationId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ft-external-dashboard'] });
      qc.invalidateQueries({ queryKey: ['ft-external-student', selectedId] });
    },
  });

  if (dash.isLoading) return <LoadingSpinner />;
  if (dash.isError) {
    return (
      <EmptyState
        title={t('externalPortal.loadError')}
        description={getApiErrorMessage(dash.error, t('loadError'))}
      />
    );
  }

  const students = dash.data?.students || [];
  const summary = dash.data?.summary || {};

  return (
    <div className="ft-external-portal">
      <header className="ft-external-portal__hero">
        <p className="ft-external-portal__eyebrow">{t('externalPortal.eyebrow')}</p>
        <h1>{t('externalPortal.title')}</h1>
        <p>{t('externalPortal.lead')}</p>
      </header>

      <div className="ft-external-portal__summary">
        <div>
          <span>{t('externalPortal.assigned')}</span>
          <strong>{summary.assigned_students ?? 0}</strong>
        </div>
        <div>
          <span>{t('externalPortal.hoursPending')}</span>
          <strong>{summary.hours_pending_confirmation ?? 0}</strong>
        </div>
        <div>
          <span>{t('externalPortal.evalPending')}</span>
          <strong>{summary.evaluations_pending ?? 0}</strong>
        </div>
        <div>
          <span>{t('externalPortal.logbookPending')}</span>
          <strong>{summary.logbook_awaiting_review ?? 0}</strong>
        </div>
      </div>

      {students.length === 0 ? (
        <EmptyState title={t('externalPortal.empty')} />
      ) : (
        <div className="ft-external-portal__layout">
          <ul className="ft-external-portal__list">
            {students.map((s) => (
              <li key={s.application_id}>
                <button
                  type="button"
                  className={selectedId === s.application_id ? 'is-active' : ''}
                  onClick={() => setSelectedId(s.application_id)}
                >
                  <strong>{s.student_name}</strong>
                  <span>{s.opportunity_title}</span>
                  <span>
                    {s.approved_hours ?? 0}
                    {s.required_hours != null ? ` / ${s.required_hours}` : ''} {t('externalPortal.hours')}
                  </span>
                  <span>{s.evaluation_status}</span>
                </button>
              </li>
            ))}
          </ul>

          <section className="ft-external-portal__detail">
            {!selectedId ? (
              <p>{t('externalPortal.selectStudent')}</p>
            ) : detail.isLoading ? (
              <LoadingSpinner />
            ) : detail.isError ? (
              <p role="alert">{getApiErrorMessage(detail.error, t('loadError'))}</p>
            ) : (
              <>
                <h2>{detail.data?.student?.name}</h2>
                <p>{detail.data?.opportunity?.title}</p>
                <div className="ft-external-portal__hours">
                  <h3>{t('externalPortal.hours')}</h3>
                  <p>
                    {detail.data?.application?.completed_training_hours ?? 0}
                    {detail.data?.opportunity?.required_training_hours != null
                      ? ` / ${detail.data.opportunity.required_training_hours}`
                      : ''}
                  </p>
                  <button
                    type="button"
                    className="ft-btn ft-btn--primary"
                    disabled={hoursMut.isPending}
                    onClick={() => {
                      const required = Number(detail.data?.opportunity?.required_training_hours) || 0;
                      const current = Number(detail.data?.application?.completed_training_hours) || 0;
                      hoursMut.mutate({
                        applicationId: selectedId,
                        completed_hours: required || current,
                        expected: current,
                      });
                    }}
                  >
                    {t('externalPortal.confirmHours')}
                  </button>
                </div>
                <div className="ft-external-portal__eval">
                  <h3>{t('externalPortal.evaluation')}</h3>
                  <button
                    type="button"
                    className="ft-btn ft-btn--primary"
                    disabled={evalMut.isPending}
                    onClick={() =>
                      evalMut.mutate({
                        applicationId: selectedId,
                        body: {
                          teamwork: 4,
                          professional_conduct: 4,
                          supervisor_cooperation: 4,
                          thinking_and_initiative: 4,
                          problem_solving: 4,
                          rules_compliance: 4,
                        },
                      })
                    }
                  >
                    {t('externalPortal.submitEval')}
                  </button>
                </div>
                <div className="ft-external-portal__logbook">
                  <h3>{t('externalPortal.logbook')}</h3>
                  <ul>
                    {(detail.data?.logbook || []).map((e) => (
                      <li key={e.id}>
                        {e.entry_date} · {e.title || e.status} · {e.status}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
