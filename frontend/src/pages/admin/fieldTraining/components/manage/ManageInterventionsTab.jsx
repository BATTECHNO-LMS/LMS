import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  fetchInterventionCases,
  fetchInterventionKpis,
  openInterventionCase,
  resolveInterventionCase,
  addInterventionFollowUp,
} from '../../../../../features/fieldTraining/fieldTraining.service.js';
import { LoadingSpinner } from '../../../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../../../components/common/EmptyState.jsx';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';

export function ManageInterventionsTab({ opportunityId, asInstructor = false }) {
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [status, setStatus] = useState('OPEN,IN_PROGRESS,MONITORING');
  const [selected, setSelected] = useState(null);
  const [openForm, setOpenForm] = useState({
    application_id: '',
    case_type: 'LOW_ATTENDANCE',
    severity: 'HIGH',
    title: '',
    reason: '',
  });

  const kpis = useQuery({
    queryKey: ['ft-intervention-kpis', opportunityId, asInstructor],
    queryFn: () => fetchInterventionKpis(opportunityId, { asInstructor }),
    enabled: Boolean(opportunityId),
    refetchInterval: 45_000,
  });

  const list = useQuery({
    queryKey: ['ft-intervention-cases', opportunityId, status, asInstructor],
    queryFn: () =>
      fetchInterventionCases(opportunityId, { status, pageSize: 50 }, { asInstructor }),
    enabled: Boolean(opportunityId),
    refetchInterval: 45_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ft-intervention-kpis', opportunityId] });
    qc.invalidateQueries({ queryKey: ['ft-intervention-cases', opportunityId] });
  };

  const openMut = useMutation({
    mutationFn: () => openInterventionCase(opportunityId, openForm, { asInstructor }),
    onSuccess: () => {
      invalidate();
      setOpenForm((f) => ({ ...f, application_id: '', title: '', reason: '' }));
    },
  });

  const resolveMut = useMutation({
    mutationFn: ({ caseId, body }) => resolveInterventionCase(caseId, body, { asInstructor }),
    onSuccess: invalidate,
  });

  const followMut = useMutation({
    mutationFn: ({ caseId, body }) => addInterventionFollowUp(caseId, body, { asInstructor }),
    onSuccess: invalidate,
  });

  const k = kpis.data || {};
  const items = list.data?.items || [];

  if (list.isLoading) return <LoadingSpinner />;
  if (list.isError) {
    return (
      <EmptyState
        title={t('interventions.loadError')}
        description={getApiErrorMessage(list.error, t('loadError'))}
      />
    );
  }

  return (
    <div className="ft-interventions">
      <header className="ft-interventions__hero">
        <h2>{t('interventions.title')}</h2>
        <p>{t('interventions.lead')}</p>
      </header>

      <div className="ft-interventions__kpis">
        <div>
          <span>{t('interventions.kpiOpen')}</span>
          <strong>{k.open_cases ?? 0}</strong>
        </div>
        <div>
          <span>{t('interventions.kpiHigh')}</span>
          <strong>{k.high_critical_cases ?? 0}</strong>
        </div>
        <div>
          <span>{t('interventions.kpiOverdue')}</span>
          <strong>{k.overdue_follow_ups ?? 0}</strong>
        </div>
        <div>
          <span>{t('interventions.kpiResolved')}</span>
          <strong>{k.resolved_this_month ?? 0}</strong>
        </div>
        <div>
          <span>{t('interventions.kpiUnassigned')}</span>
          <strong>{k.unassigned_cases ?? 0}</strong>
        </div>
      </div>

      <div className="ft-interventions__filters">
        <label>
          {t('interventions.filterStatus')}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="OPEN,IN_PROGRESS,MONITORING">{t('interventions.active')}</option>
            <option value="RESOLVED,CLOSED">{t('interventions.resolved')}</option>
            <option value="">{t('interventions.all')}</option>
          </select>
        </label>
      </div>

      <form
        className="ft-interventions__open"
        onSubmit={(e) => {
          e.preventDefault();
          if (!openForm.application_id) return;
          openMut.mutate();
        }}
      >
        <h3>{t('interventions.openCase')}</h3>
        <input
          placeholder={t('interventions.applicationId')}
          value={openForm.application_id}
          onChange={(e) => setOpenForm((f) => ({ ...f, application_id: e.target.value }))}
          required
        />
        <select
          value={openForm.case_type}
          onChange={(e) => setOpenForm((f) => ({ ...f, case_type: e.target.value }))}
        >
          {[
            'LOW_ATTENDANCE',
            'TASKS_OVERDUE',
            'LOW_PERFORMANCE',
            'MISSING_POST',
            'HOURS_INCOMPLETE',
            'INACTIVITY',
            'BEHAVIOR_CONCERN',
            'SUPERVISOR_CONCERN',
            'STUDENT_SUPPORT',
            'OTHER',
          ].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={openForm.severity}
          onChange={(e) => setOpenForm((f) => ({ ...f, severity: e.target.value }))}
        >
          {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          placeholder={t('interventions.caseTitle')}
          value={openForm.title}
          onChange={(e) => setOpenForm((f) => ({ ...f, title: e.target.value }))}
        />
        <textarea
          placeholder={t('interventions.reason')}
          value={openForm.reason}
          onChange={(e) => setOpenForm((f) => ({ ...f, reason: e.target.value }))}
        />
        <button type="submit" className="ft-btn ft-btn--primary" disabled={openMut.isPending}>
          {t('interventions.openCase')}
        </button>
        {openMut.isError && (
          <p role="alert">{getApiErrorMessage(openMut.error, t('interventions.error'))}</p>
        )}
      </form>

      {items.length === 0 ? (
        <EmptyState title={t('interventions.empty')} />
      ) : (
        <ul className="ft-interventions__list">
          {items.map((c) => (
            <li key={c.id} className={`ft-interventions__card severity-${c.severity}`}>
              <button type="button" onClick={() => setSelected(selected === c.id ? null : c.id)}>
                <strong>{c.title}</strong>
                <span>
                  {c.case_type} · {c.severity} · {c.status}
                </span>
                <span>{c.student_name || c.student_id}</span>
                {c.follow_up_overdue ? <em>{t('interventions.overdue')}</em> : null}
              </button>
              {selected === c.id ? (
                <div className="ft-interventions__detail">
                  <p>{c.reason || c.description}</p>
                  <button
                    type="button"
                    className="ft-btn"
                    onClick={() =>
                      followMut.mutate({
                        caseId: c.id,
                        body: {
                          action: 'FOLLOW_UP_ADDED',
                          note: t('interventions.defaultFollowUp'),
                          status: 'MONITORING',
                        },
                      })
                    }
                  >
                    {t('interventions.addFollowUp')}
                  </button>
                  <button
                    type="button"
                    className="ft-btn ft-btn--primary"
                    onClick={() =>
                      resolveMut.mutate({
                        caseId: c.id,
                        body: {
                          resolution: 'IMPROVED',
                          resolution_note: t('interventions.defaultResolve'),
                        },
                      })
                    }
                  >
                    {t('interventions.resolve')}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
