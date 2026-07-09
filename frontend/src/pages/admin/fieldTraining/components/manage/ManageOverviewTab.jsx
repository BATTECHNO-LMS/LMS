import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Users, ClipboardList, Award, Calendar, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import { StatCard } from '../../../../../components/common/StatCard.jsx';
import { AdminStatsGrid } from '../../../../../components/admin/AdminStatsGrid.jsx';
import {
  startFieldTraining,
  getOpportunitySpecialtyLabel,
  opportunityStatusVariant,
} from '../../../../../features/fieldTraining/index.js';
import { BeneficiaryUniversitiesSection } from '../BeneficiaryUniversitiesSection.jsx';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';

export function ManageOverviewTab({ opportunityId, opp, applications, sessions, submissions, apiScope = 'admin' }) {
  const isInstructor = apiScope === 'instructor';
  const basePath = isInstructor ? '/instructor/field-training' : '/admin/field-training';
  const { t, i18n } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');

  const approved = useMemo(
    () => (applications ?? []).filter((a) => a.status === 'approved'),
    [applications]
  );
  const readyCount = useMemo(
    () =>
      approved.filter((a) =>
        ['ready_for_training', 'pre_assessment_completed', 'in_training'].includes(a.training_status)
      ).length,
    [approved]
  );
  const avgAttendance = useMemo(() => {
    const withPct = approved.filter((a) => a.attendance_percentage != null);
    if (!withPct.length) return null;
    const sum = withPct.reduce((acc, a) => acc + Number(a.attendance_percentage), 0);
    return Math.round(sum / withPct.length);
  }, [approved]);
  const lettersIssued = useMemo(
    () => approved.filter((a) => a.completion_letter_issued_at || a.training_status === 'completed').length,
    [approved]
  );

  const startMut = useMutation({
    mutationFn: () => startFieldTraining(opportunityId, { asInstructor: isInstructor }),
    onSuccess: () => {
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminDetail(opportunityId) });
      qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(opportunityId) });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const canStart = opp?.status === 'published' || opp?.status === 'in_progress';

  return (
    <div className="ft-manage-panel">
      <header className="ft-manage-panel__head">
        <div>
          <h2 className="ft-manage-panel__title">{opp?.title}</h2>
          <p className="ft-manage-panel__meta">
            {getOpportunitySpecialtyLabel(opp, i18n.language)}
            {opp?.assigned_instructor?.full_name ? (
              <>
                {' · '}
                <User size={14} aria-hidden /> {opp.assigned_instructor.full_name}
              </>
            ) : null}
          </p>
        </div>
        {opp?.status ? (
          <StatusBadge variant={opportunityStatusVariant(opp.status)}>
            {t(`status.${opp.status}`)}
          </StatusBadge>
        ) : null}
      </header>

      <AdminStatsGrid>
        <StatCard
          label={t('manageHub.kpi.applications')}
          value={applications?.length ?? 0}
          hint={t('manageHub.kpi.applicationsHint')}
          icon={Users}
        />
        <StatCard
          label={t('manageHub.kpi.approved')}
          value={approved.length}
          hint={t('manageHub.kpi.approvedHint')}
          icon={Users}
        />
        <StatCard
          label={t('manageHub.kpi.sessions')}
          value={sessions?.length ?? 0}
          hint={t('manageHub.kpi.sessionsHint')}
          icon={Calendar}
        />
        <StatCard
          label={t('manageHub.kpi.submissions')}
          value={submissions?.length ?? 0}
          hint={t('manageHub.kpi.submissionsHint')}
          icon={ClipboardList}
        />
        <StatCard
          label={t('manageHub.kpi.avgAttendance')}
          value={avgAttendance != null ? `${avgAttendance}%` : '—'}
          hint={t('manageHub.kpi.avgAttendanceHint')}
          icon={Calendar}
        />
        <StatCard
          label={t('manageHub.kpi.letters')}
          value={lettersIssued}
          hint={t('manageHub.kpi.lettersHint')}
          icon={Award}
        />
      </AdminStatsGrid>

      <BeneficiaryUniversitiesSection grouped={opp?.eligibility_grouped} />

      <div className="ft-manage-actions">
        <Button
          type="button"
          variant="primary"
          disabled={!canStart || startMut.isPending || opp?.status === 'in_progress'}
          onClick={() => {
            setError('');
            setConfirmOpen(true);
          }}
        >
          <Play size={16} aria-hidden /> {t('manageTraining.startTraining')}
        </Button>
        {!isInstructor ? (
          <Button as={Link} to={`${basePath}/${opportunityId}/applications`} variant="outline">
            {t('viewApplications')}
          </Button>
        ) : null}
        <Button as={Link} to={`${basePath}/${opportunityId}/tasks`} variant="outline">
          {t('tasks.manageTasks')}
        </Button>
      </div>

      {error ? <p className="form-field__error">{error}</p> : null}

      {confirmOpen ? (
        <div className="ft-modal-backdrop" onClick={() => setConfirmOpen(false)} role="presentation">
          <div className="ft-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <header className="ft-modal__header">
              <h2 className="ft-modal__title">{t('manageHub.startConfirmTitle')}</h2>
              <p className="ft-modal__subtitle">
                {t('manageHub.startConfirmBody', { count: readyCount })}
              </p>
            </header>
            <footer className="ft-modal__footer">
              <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={startMut.isPending}
                onClick={() => startMut.mutate()}
              >
                {startMut.isPending ? t('saving') : t('manageTraining.startTraining')}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
