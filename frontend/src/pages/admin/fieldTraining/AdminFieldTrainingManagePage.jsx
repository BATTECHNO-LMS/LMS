import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ShieldOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import {
  useAdminFieldTraining,
  useOpportunityApplications,
  useOpportunityOverviewSummary,
  useOpportunitySubmissions,
  useOpportunitySessions,
  issueCompletionLetter,
  fetchInstructorFieldTraining,
} from '../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { ManageTabNav, MANAGE_TABS } from './components/manage/ManageTabNav.jsx';
import { ManageHeader } from './components/manage/ManageHeader.jsx';
import { ManageOverviewTab } from './components/manage/ManageOverviewTab.jsx';
import { ManageSessionsTab } from './components/manage/ManageSessionsTab.jsx';
import { ManageAttendanceTab } from './components/manage/ManageAttendanceTab.jsx';
import { ManageAssessmentsTab } from './components/manage/ManageAssessmentsTab.jsx';
import { ManageCompletionTab } from './components/manage/ManageLinkTab.jsx';
import { ManageEligibilityTab } from './components/manage/ManageEligibilityTab.jsx';
import { ManageApplicationsTab } from './components/manage/ManageApplicationsTab.jsx';
import { ManageTasksTab } from './components/manage/ManageTasksTab.jsx';
import { ManageSubmissionsTab } from './components/manage/ManageSubmissionsTab.jsx';
import { ManageReportsTab } from './components/manage/ManageReportsTab.jsx';
import { ManageEvaluationTemplateTab } from './components/manage/ManageEvaluationTemplateTab.jsx';

function isForbiddenError(error) {
  return error?.response?.status === 403 || error?.status === 403 || error?.code === 'FIELD_TRAINING_FORBIDDEN';
}

export function AdminFieldTrainingManagePage({ apiScope = 'admin', initialTab } = {}) {
  const { id } = useParams();
  const isInstructor = apiScope === 'instructor';
  const listBase = isInstructor ? '/instructor/field-training' : '/admin/field-training';
  const { t } = useTranslation('fieldTraining');
  const [searchParams, setSearchParams] = useSearchParams();
  const qc = useQueryClient();

  const requestedTab = searchParams.get('tab') || initialTab || 'overview';
  const hiddenTabs = isInstructor ? ['completion', 'reports'] : [];
  const visibleTabs = MANAGE_TABS.filter((tab) => !hiddenTabs.includes(tab));
  const activeTab = visibleTabs.includes(requestedTab) ? requestedTab : 'overview';
  const attendanceSessionId = searchParams.get('session') || '';

  const needsApplications = ['completion'].includes(activeTab);
  const needsSessions = false;
  const needsSubmissions = false;

  const overviewQuery = useOpportunityOverviewSummary(id, {
    enabled: Boolean(id) && activeTab === 'overview',
    scope: apiScope,
  });
  const overviewSummary = overviewQuery.data || null;

  const {
    data: oppData,
    isLoading: oppLoading,
    isError: oppError,
    error: oppErr,
  } = useAdminFieldTraining(id, {
    enabled: !isInstructor && Boolean(id),
  });
  const {
    data: instructorOppData,
    isLoading: instructorOppLoading,
    isError: instructorOppError,
    error: instructorOppErr,
  } = useQuery({
    queryKey: fieldTrainingKeys.instructorDetail(id),
    queryFn: () => fetchInstructorFieldTraining(id),
    enabled: isInstructor && Boolean(id),
    retry: (failureCount, error) => !isForbiddenError(error) && failureCount < 2,
  });

  const {
    data: appsData,
    isLoading: appsLoading,
    isError: appsError,
  } = useOpportunityApplications(
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
  const forbidden = isInstructor
    ? instructorOppError && isForbiddenError(instructorOppErr)
    : oppError && isForbiddenError(oppErr);
  const applications = appsData?.applications ?? [];
  const sessions = sessionsData?.sessions ?? [];
  const submissions = subsData?.submissions ?? [];

  const readyCount = useMemo(
    () =>
      applications.filter(
        (a) =>
          a.status === 'approved' &&
          ['ready_for_training', 'pre_assessment_completed', 'in_training'].includes(a.training_status)
      ).length,
    [applications]
  );

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
            summary={overviewSummary}
            summaryLoading={overviewQuery.isLoading}
            summaryError={overviewQuery.isError}
            apiScope={apiScope}
          />
        );
      case 'applications':
        return <ManageApplicationsTab opportunityId={id} apiScope={apiScope} />;
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
            opportunityTitle={opp?.title}
            apiScope={apiScope}
            preselectedSessionId={attendanceSessionId}
            onSessionChange={(sessionId) => setTab('attendance', { session: sessionId })}
          />
        );
      case 'tasks':
        return (
          <ManageTasksTab
            opportunityId={id}
            apiScope={apiScope}
            onOpenSubmissions={() => setTab('submissions')}
          />
        );
      case 'submissions':
        return <ManageSubmissionsTab opportunityId={id} apiScope={apiScope} />;
      case 'post_assessment':
        return <ManageAssessmentsTab opportunityId={id} type="post" apiScope={apiScope} />;
      case 'eligibility':
        return <ManageEligibilityTab opportunityId={id} apiScope={apiScope} />;
      case 'evaluation_template':
        return <ManageEvaluationTemplateTab opportunityId={id} apiScope={apiScope} />;
      case 'completion':
        return (
          <ManageCompletionTab
            applications={applications}
            onIssueLetter={(appId) => issueMut.mutate(appId)}
            issuePending={issueMut.isPending}
          />
        );
      case 'reports':
        return <ManageReportsTab opportunityId={id} />;
      default:
        return (
          <EmptyState
            title={t('manageHub.unknownTabTitle')}
            description={t('manageHub.unknownTabDesc')}
          />
        );
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
    appsLoading,
    appsError,
  ]);

  if (oppBusy) return <LoadingSpinner />;

  if (forbidden) {
    return (
      <div className="page page--admin ft-page ft-manage-hub">
        <EmptyState
          icon={ShieldOff}
          title={t('instructor.forbiddenTitle')}
          description={t('instructor.forbiddenDescription')}
        />
        <div className="ft-manage-actions">
          <Link to={listBase} className="btn btn--outline">
            <ArrowLeft size={18} aria-hidden /> {t('backToList')}
          </Link>
        </div>
      </div>
    );
  }

  if (!opp && (isInstructor ? instructorOppError : oppError)) {
    return (
      <div className="page page--admin ft-page ft-manage-hub">
        <EmptyState
          title={t('manageHub.loadErrorTitle')}
          description={getApiErrorMessage(isInstructor ? instructorOppErr : oppErr, t('loadError'))}
        />
        <div className="ft-manage-actions">
          <Link to={listBase} className="btn btn--outline">
            <ArrowLeft size={18} aria-hidden /> {t('backToList')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page page--admin ft-page ft-manage-hub">
      <ManageHeader
        opportunityId={id}
        opp={opp}
        apiScope={apiScope}
        listBase={listBase}
        readyCount={readyCount}
      />

      <ManageTabNav activeTab={activeTab} onTabChange={(tab) => setTab(tab)} hiddenTabs={hiddenTabs} />

      <div className="ft-manage-hub__content" role="tabpanel">
        {tabContent}
      </div>
    </div>
  );
}
