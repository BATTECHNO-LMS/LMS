import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import {
  useAdminFieldTraining,
  useOpportunityApplications,
  useOpportunitySubmissions,
  useOpportunitySessions,
  issueCompletionLetter,
  getOpportunitySpecialtyLabel,
} from '../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { ManageTabNav } from './components/manage/ManageTabNav.jsx';
import { ManageOverviewTab } from './components/manage/ManageOverviewTab.jsx';
import { ManageSessionsTab } from './components/manage/ManageSessionsTab.jsx';
import { ManageAttendanceTab } from './components/manage/ManageAttendanceTab.jsx';
import { ManageAssessmentsTab } from './components/manage/ManageAssessmentsTab.jsx';
import { ManageCompletionTab, ManageLinkTab } from './components/manage/ManageLinkTab.jsx';

export function AdminFieldTrainingManagePage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation('fieldTraining');
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const activeTab = searchParams.get('tab') || 'overview';
  const attendanceSessionId = searchParams.get('session') || '';

  const { data: oppData, isLoading: oppLoading } = useAdminFieldTraining(id);
  const { data: appsData } = useOpportunityApplications(id);
  const { data: sessionsData } = useOpportunitySessions(id);
  const { data: subsData } = useOpportunitySubmissions(id);

  const opp = oppData?.opportunity;
  const applications = appsData?.applications ?? [];
  const sessions = sessionsData?.sessions ?? [];
  const submissions = subsData?.submissions ?? [];

  const issueMut = useMutation({
    mutationFn: (applicationId) => issueCompletionLetter(applicationId),
    onSuccess: () => qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(id) }),
  });

  function setTab(tab, extra = {}) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    if (extra.session) next.set('session', extra.session);
    else if (tab !== 'attendance') next.delete('session');
    setSearchParams(next, { replace: true });
  }

  const tabContent = useMemo(() => {
    switch (activeTab) {
      case 'overview':
        return (
          <ManageOverviewTab
            opportunityId={id}
            opp={opp}
            applications={applications}
            sessions={sessions}
            submissions={submissions}
          />
        );
      case 'applications':
        return (
          <ManageLinkTab
            opportunityId={id}
            tabKey="applications"
            title={t('applicationsTitle')}
            description={t('manageHub.applicationsDesc')}
            to={`/admin/field-training/${id}/applications`}
          />
        );
      case 'pre_assessment':
        return <ManageAssessmentsTab opportunityId={id} type="pre" />;
      case 'sessions':
        return (
          <ManageSessionsTab
            opportunityId={id}
            onOpenAttendance={(sessionId) => setTab('attendance', { session: sessionId })}
          />
        );
      case 'attendance':
        return (
          <ManageAttendanceTab
            opportunityId={id}
            preselectedSessionId={attendanceSessionId}
            onSessionChange={(sessionId) => setTab('attendance', { session: sessionId })}
          />
        );
      case 'tasks':
        return (
          <ManageLinkTab
            opportunityId={id}
            tabKey="tasks"
            title={t('tasks.adminTitle')}
            description={t('manageHub.tasksDesc')}
            to={`/admin/field-training/${id}/tasks`}
          />
        );
      case 'submissions':
        return (
          <ManageLinkTab
            opportunityId={id}
            tabKey="submissions"
            title={t('tasks.submissionsTitle')}
            description={t('manageHub.submissionsDesc')}
            to={`/admin/field-training/${id}/tasks`}
          />
        );
      case 'post_assessment':
        return <ManageAssessmentsTab opportunityId={id} type="post" />;
      case 'completion':
        return (
          <ManageCompletionTab
            applications={applications}
            onIssueLetter={(appId) => issueMut.mutate(appId)}
            issuePending={issueMut.isPending}
          />
        );
      default:
        return null;
    }
  }, [activeTab, id, opp, applications, sessions, submissions, attendanceSessionId, t, issueMut.isPending]);

  if (oppLoading) return <LoadingSpinner />;

  return (
    <div className="page page--admin ft-page ft-manage-hub">
      <header className="ft-manage-hub__header">
        <Link to="/admin/field-training" className="ft-detail-back">
          <ArrowLeft size={18} aria-hidden /> {t('backToList')}
        </Link>
        <h1 className="ft-manage-hub__title">{t('manageTraining.title')}</h1>
        <p className="ft-manage-hub__subtitle">
          {opp?.title} · {getOpportunitySpecialtyLabel(opp, i18n.language)}
        </p>
      </header>

      <ManageTabNav activeTab={activeTab} onTabChange={(tab) => setTab(tab)} />

      <div className="ft-manage-hub__content" role="tabpanel">
        {tabContent}
      </div>
    </div>
  );
}
