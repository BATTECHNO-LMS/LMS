import {
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Video,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileText,
  LayoutDashboard,
  ListChecks,
  Activity,
  ScrollText,
  Stamp,
  Users,
  HeartHandshake,
  Building2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export const MANAGE_TABS = [
  'overview',
  'command_center',
  'applications',
  'pre_assessment',
  'sessions',
  'recorded_lectures',
  'attendance',
  'interventions',
  'external_supervisors',
  'tasks',
  'submissions',
  'post_assessment',
  'eligibility',
  'evaluation_template',
  'completion',
  'reports',
];

const TAB_ICONS = {
  overview: LayoutDashboard,
  command_center: Activity,
  applications: Users,
  pre_assessment: ClipboardCheck,
  sessions: CalendarDays,
  recorded_lectures: Video,
  attendance: BookOpenCheck,
  interventions: HeartHandshake,
  external_supervisors: Building2,
  tasks: ListChecks,
  submissions: FileCheck2,
  post_assessment: ClipboardList,
  eligibility: FileText,
  evaluation_template: Stamp,
  completion: ScrollText,
  reports: BarChart3,
};

export function ManageTabNav({ activeTab, onTabChange, hiddenTabs = [] }) {
  const { t } = useTranslation('fieldTraining');
  const tabs = MANAGE_TABS.filter((tab) => !hiddenTabs.includes(tab));

  return (
    <nav className="ft-manage-tabs" role="tablist" aria-label={t('manageHub.tabsLabel')}>
      <div className="ft-manage-tabs__track">
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab] || LayoutDashboard;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`ft-manage-tabs__tab${isActive ? ' ft-manage-tabs__tab--active' : ''}`}
              onClick={() => onTabChange(tab)}
            >
              <Icon size={16} aria-hidden className="ft-manage-tabs__icon" />
              <span className="ft-manage-tabs__label">{t(`manageHub.tabs.${tab}`)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
