import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  ClipboardList,
  CheckCircle2,
  Activity,
  Users,
  UserX,
  Calendar,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../../components/common/Button.jsx';
import {
  formatFtDate,
  getOpportunitySpecialtyLabel,
} from '../../../../../features/fieldTraining/index.js';
import { BeneficiaryUniversitiesSection } from '../BeneficiaryUniversitiesSection.jsx';
import { ManageKpiCard } from './ManageTabStates.jsx';

function InfoItem({ label, value }) {
  return (
    <div className="ft-manage-info__item">
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  );
}

export function ManageOverviewTab({
  opportunityId,
  opp,
  applications,
  sessions,
  submissions,
  apiScope = 'admin',
  appsLoading = false,
  appsError = false,
}) {
  const isInstructor = apiScope === 'instructor';
  const basePath = isInstructor ? '/instructor/field-training' : '/admin/field-training';
  const { t, i18n } = useTranslation('fieldTraining');

  const approved = useMemo(
    () => (applications ?? []).filter((a) => a.status === 'approved'),
    [applications]
  );
  const inTrainingCount = useMemo(
    () =>
      approved.filter((a) =>
        [
          'in_training',
          'task_pending',
          'task_submitted',
          'post_assessment_pending',
          'post_assessment_completed',
        ].includes(a.training_status)
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
  const pendingReviews = useMemo(
    () => (submissions ?? []).filter((s) => (s.review_status || 'pending') === 'pending').length,
    [submissions]
  );
  const eligibleCount = useMemo(
    () => approved.filter((a) => a.completion_eligibility_status === 'eligible').length,
    [approved]
  );
  const expelledCount = useMemo(
    () => (applications ?? []).filter((a) => a.training_status === 'expelled').length,
    [applications]
  );

  const modeLabel = opp?.training_mode ? t(`modes.${opp.training_mode}`, opp.training_mode) : null;
  const specialtyLabel = getOpportunitySpecialtyLabel(opp, i18n.language);
  const universities =
    opp?.eligibility_grouped
      ?.map((g) => g.university?.name)
      .filter(Boolean)
      .join(' · ') || null;
  const specialties =
    opp?.eligibility_grouped
      ?.flatMap((g) => g.programs || [])
      .map((p) => getOpportunitySpecialtyLabel({ specialty: p.university_specialty }, i18n.language, ''))
      .filter(Boolean)
      .join(' · ') || specialtyLabel;

  const dataMissing = appsError || (!appsLoading && applications == null);

  return (
    <div className="ft-manage-panel">
      <div className="ft-manage-kpi-grid" role="list">
        <ManageKpiCard
          icon={Users}
          label={t('manageHub.kpi.applications')}
          value={dataMissing ? null : applications?.length ?? 0}
          hint={t('manageHub.kpi.applicationsHint')}
        />
        <ManageKpiCard
          icon={Users}
          label={t('manageHub.kpi.approved')}
          value={dataMissing ? null : approved.length}
          hint={t('manageHub.kpi.approvedHint')}
        />
        <ManageKpiCard
          icon={Activity}
          label={t('manageHub.kpi.inTraining')}
          value={dataMissing ? null : inTrainingCount}
          hint={t('manageHub.kpi.inTrainingHint')}
        />
        <ManageKpiCard
          icon={Calendar}
          label={t('manageHub.kpi.avgAttendance')}
          value={avgAttendance != null ? `${avgAttendance}%` : null}
          hint={t('manageHub.kpi.avgAttendanceHint')}
        />
        <ManageKpiCard
          icon={ClipboardList}
          label={t('manageHub.kpi.pendingReviews')}
          value={submissions == null ? null : pendingReviews}
          hint={t('manageHub.kpi.pendingReviewsHint')}
        />
        <ManageKpiCard
          icon={CheckCircle2}
          label={t('manageHub.kpi.eligible')}
          value={dataMissing ? null : eligibleCount}
          hint={t('manageHub.kpi.eligibleHint')}
        />
        <ManageKpiCard
          icon={Award}
          label={t('manageHub.kpi.letters')}
          value={dataMissing ? null : lettersIssued}
          hint={t('manageHub.kpi.lettersHint')}
        />
        <ManageKpiCard
          icon={UserX}
          label={t('manageHub.kpi.expelled')}
          value={dataMissing ? null : expelledCount}
          hint={t('manageHub.kpi.expelledHint')}
        />
      </div>

      <section className="ft-manage-info-card" aria-labelledby="ft-opp-info-title">
        <header className="ft-manage-info-card__head">
          <h2 id="ft-opp-info-title" className="ft-manage-panel__title">
            {t('manageHub.opportunityInfo')}
          </h2>
          {!isInstructor ? (
            <Button as={Link} to={`${basePath}?edit=${opportunityId}`} variant="outline" className="btn--sm">
              {t('edit')}
            </Button>
          ) : null}
        </header>

        <dl className="ft-manage-info__grid">
          <InfoItem label={t('form.specialty')} value={specialtyLabel} />
          <InfoItem label={t('manageHub.info.universities')} value={universities} />
          <InfoItem label={t('manageHub.info.eligibleSpecialties')} value={specialties} />
          <InfoItem
            label={t('manageHub.info.instructor')}
            value={opp?.assigned_instructor?.full_name}
          />
          <InfoItem label={t('form.mode')} value={modeLabel} />
          <InfoItem label={t('form.location')} value={opp?.location} />
          <InfoItem
            label={t('manageHub.info.dateRange')}
            value={
              opp?.start_date || opp?.end_date
                ? `${formatFtDate(opp?.start_date) || '—'} — ${formatFtDate(opp?.end_date) || '—'}`
                : null
            }
          />
          <InfoItem
            label={t('form.applicationDeadline')}
            value={opp?.application_deadline ? formatFtDate(opp.application_deadline) : null}
          />
          <InfoItem
            label={t('form.seatsLimit')}
            value={opp?.seats_limit != null ? String(opp.seats_limit) : null}
          />
          <InfoItem
            label={t('form.requiredTrainingHours')}
            value={opp?.required_training_hours != null ? String(opp.required_training_hours) : null}
          />
          <InfoItem
            label={t('manageHub.kpi.sessions')}
            value={sessions != null ? String(sessions.length) : null}
          />
        </dl>

        <div className="ft-manage-info__rules">
          <h3>{t('manageHub.workflowRules')}</h3>
          <ul>
            <li>
              {t('form.requiresPreAssessment')}:{' '}
              <strong>{opp?.requires_pre_assessment ? t('commonYes') : t('commonNo')}</strong>
            </li>
            <li>
              {t('form.requiresPostAssessment')}:{' '}
              <strong>{opp?.requires_post_assessment ? t('commonYes') : t('commonNo')}</strong>
            </li>
            <li>
              {t('form.requiresFinalTask')}:{' '}
              <strong>{opp?.requires_final_task ? t('commonYes') : t('commonNo')}</strong>
            </li>
            <li>
              {t('manageHub.eligibilityRules.attendance')}:{' '}
              <strong>
                {opp?.minimum_attendance_percentage != null
                  ? `${opp.minimum_attendance_percentage}%`
                  : t('manageHub.eligibilityRules.notSet')}
              </strong>
            </li>
            <li>
              {t('manageHub.eligibilityRules.postScore')}:{' '}
              <strong>
                {opp?.minimum_post_assessment_score != null
                  ? opp.minimum_post_assessment_score
                  : t('manageHub.eligibilityRules.notSet')}
              </strong>
            </li>
          </ul>
        </div>
      </section>

      <BeneficiaryUniversitiesSection grouped={opp?.eligibility_grouped} />

      <div className="ft-manage-actions">
        <Button
          as={Link}
          to={isInstructor ? `${basePath}/${opportunityId}/participants` : `${basePath}/${opportunityId}/applications`}
          variant="outline"
        >
          {t('manageHub.tabs.applications')}
        </Button>
        <Button as={Link} to={`${basePath}/${opportunityId}/tasks`} variant="outline">
          {t('tasks.manageTasks')}
        </Button>
        {!isInstructor ? (
          <Button as={Link} to="/admin/field-training/reports" variant="outline">
            {t('manageHub.tabs.reports')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
