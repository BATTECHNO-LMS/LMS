import { useTranslation } from 'react-i18next';

export const STUDENT_TRAINING_TABS = [
  'overview',
  'logbook',
  'portfolio',
  'sessions',
  'recorded_lectures',
  'attendance',
  'tasks',
  'assessments',
  'eligibility',
  'completion',
];

export function StudentTrainingTabNav({ activeTab, onTabChange, disabledTabs = [] }) {
  const { t } = useTranslation('fieldTraining');

  const tourIdByTab = {
    overview: 'progress',
    logbook: 'progress',
    portfolio: 'progress',
    sessions: 'sessions',
    recorded_lectures: 'progress',
    attendance: 'sessions',
    tasks: 'tasks',
    assessments: 'application-pretest',
    eligibility: 'progress',
    completion: 'certificates',
  };

  return (
    <nav className="ft-student-tabs" role="tablist" aria-label={t('studentTraining.tabsLabel')}>
      {STUDENT_TRAINING_TABS.map((tab) => {
        const disabled = disabledTabs.includes(tab);
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            disabled={disabled}
            data-tour-id={tourIdByTab[tab]}
            className={`ft-student-tabs__tab${activeTab === tab ? ' ft-student-tabs__tab--active' : ''}`}
            onClick={() => !disabled && onTabChange(tab)}
          >
            {t(`studentTraining.tabs.${tab}`)}
          </button>
        );
      })}
    </nav>
  );
}
