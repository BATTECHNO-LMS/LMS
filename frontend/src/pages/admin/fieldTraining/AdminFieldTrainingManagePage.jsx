import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import {
  useAdminFieldTraining,
  useOpportunityApplications,
  useOpportunitySubmissions,
  useOpportunitySessions,
  issueCompletionLetter,
  getOpportunitySpecialtyLabel,
  fetchInstructorFieldTraining,
} from '../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { ManageTabNav } from './components/manage/ManageTabNav.jsx';
import { ManageOverviewTab } from './components/manage/ManageOverviewTab.jsx';
import { ManageSessionsTab } from './components/manage/ManageSessionsTab.jsx';
import { ManageAttendanceTab } from './components/manage/ManageAttendanceTab.jsx';
import { ManageAssessmentsTab } from './components/manage/ManageAssessmentsTab.jsx';
import { ManageCompletionTab, ManageLinkTab } from './components/manage/ManageLinkTab.jsx';

export function AdminFieldTrainingManagePage({ apiScope = 'admin' } = {}) {
  const { id } = useParams();
  const isInstructor = apiScope === 'instructor';
  const listBase = isInstructor ? '/instructor/field-training' : '/admin/field-training';
  const { t, i18n } = useTranslation('fieldTraining');
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const activeTab = searchParams.get('tab') || 'overview';
  const attendanceSessionId = searchParams.get('session') || '';
  const hiddenTabs = isInstructor ? ['applications', 'completion'] : [];

  const needsApplications = ['overview', 'completion', 'attendance'].includes(activeTab);
  const needsSessions = ['sessions', 'attendance'].includes(activeTab);
  const needsSubmissions = ['completion', 'assessments'].includes(activeTab);

  const { data: oppData, isLoading: oppLoading } = useAdminFieldTraining(id, {
    enabled: !isInstructor && Boolean(id),
  });
  const { data: instructorOppData, isLoading: instructorOppLoading } = useQuery({
    queryKey: fieldTrainingKeys.instructorDetail(id),
    queryFn: () => fetchInstructorFieldTraining(id),
    enabled: isInstructor && Boolean(id),
  });
  const { data: appsData } = useOpportunityApplications(
    id,
    {},
    { enabled: Boolean(id) && needsApplications, scope: apiScope }
  );
  const { data: sessionsData } = useOpportunitySessions(id, {
    enabled: Boolean(id) && needsSessions,
    scope: apiScope,
  });
  const { data: subsData } = useOpportunitySubmissions(id, {
    enabled: Boolean(id) && needsSubmissions,
    scope: apiScope,
  });

  const opp = isInstructor ? instructorOppData?.opportunity : oppData?.opportunity;
  const oppBusy = isInstructor ? instructorOppLoading : oppLoading;
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
            apiScope={apiScope}
          />
        );
      case 'applications':
        return (
          <ManageLinkTab
            opportunityId={id}
            tabKey="applications"
            title={t('applicationsTitle')}
            description={t('manageHub.applicationsDesc')}
            to={`${listBase}/${id}/applications`}
          />
        );
      case 'pre_assessment':
        return <ManageAssessmentsTab opportunityId={id} type="pre" apiScope={apiScope} />;
      case 'sessions':
        return (
          <ManageSessionsTab
            opportunityId={id}
            apiScope={apiScope}
            onOpenAttendance={(sessionId) => setTab('attendance', { session: sessionId })}
          />
        );
      case 'attendance':
        return (
          <ManageAttendanceTab
            opportunityId={id}
            apiScope={apiScope}
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
            to={`${listBase}/${id}/tasks`}
          />
        );
      case 'submissions':
        return (
          <ManageLinkTab
            opportunityId={id}
            tabKey="submissions"
            title={t('tasks.submissionsTitle')}
            description={t('manageHub.submissionsDesc')}
            to={`${listBase}/${id}/tasks`}
          />
        );
      case 'post_assessment':
        return <ManageAssessmentsTab opportunityId={id} type="post" apiScope={apiScope} />;
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
  }, [
    activeTab,
    id,
    opp,
    applications,
    sessions,
    submissions,
    attendanceSessionId,
    t,
    issueMut.isPending,
    apiScope,
    listBase,
  ]);

  if (oppBusy) return <LoadingSpinner />;

  return (
    <div className="page page--admin ft-page ft-manage-hub">
      <header className="ft-manage-hub__header">
        <Link to={listBase} className="ft-detail-back">
          <ArrowLeft size={18} aria-hidden /> {t('backToList')}
        </Link>
        <h1 className="ft-manage-hub__title">{t('manageTraining.title')}</h1>
        <p className="ft-manage-hub__subtitle">
          {opp?.title} · {getOpportunitySpecialtyLabel(opp, i18n.language)}
        </p>
      </header>

      <ManageTabNav activeTab={activeTab} onTabChange={(tab) => setTab(tab)} hiddenTabs={hiddenTabs} />

      <div className="ft-manage-hub__content" role="tabpanel">
        {tabContent}
      </div>
    </div>
  );
}