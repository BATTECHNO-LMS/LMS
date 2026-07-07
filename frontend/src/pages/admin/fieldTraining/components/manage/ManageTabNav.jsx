import { useTranslation } from 'react-i18next';

export const MANAGE_TABS = [
  'overview',
  'applications',
  'pre_assessment',
  'sessions',
  'attendance',
  'tasks',
  'submissions',
  'post_assessment',
  'completion',
];

export function ManageTabNav({ activeTab, onTabChange }) {
  const { t } = useTranslation('fieldTraining');

  return (
    <nav className="ft-manage-tabs" role="tablist" aria-label={t('manageHub.tabsLabel')}>
      {MANAGE_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          className={`ft-manage-tabs__tab${activeTab === tab ? ' ft-manage-tabs__tab--active' : ''}`}
          onClick={() => onTabChange(tab)}
        >
          {t(`manageHub.tabs.${tab}`)}
        </button>
      ))}
    </nav>
  );
}
