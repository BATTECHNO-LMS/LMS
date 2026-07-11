import { CheckCircle2, Circle, Lock, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const STEP_KEYS = [
  'application_submitted',
  'application_reviewed',
  'pre_assessment',
  'training_started',
  'sessions',
  'tasks',
  'post_assessment',
  'eligibility',
  'completion_letter',
];

export function StudentWorkflowTimeline({ steps, expelled, rejected }) {
  const { t } = useTranslation('fieldTraining');
  const stepMap = Object.fromEntries((steps ?? []).map((s) => [s.key, s.status]));

  return (
    <section className="ft-workflow-timeline" aria-labelledby="ft-workflow-title">
      <h2 id="ft-workflow-title" className="ft-workflow-timeline__title">
        {t('studentTraining.workflowTitle')}
      </h2>
      <ol className="ft-workflow-timeline__track">
        {STEP_KEYS.map((key) => {
          const status = stepMap[key] ?? 'pending';
          let visual = 'pending';
          if (expelled && key !== 'application_submitted' && key !== 'application_reviewed') {
            visual = 'locked';
          } else if (rejected && key === 'application_reviewed') {
            visual = 'failed';
          } else if (status === 'completed') {
            visual = 'completed';
          } else if (status === 'current') {
            visual = 'current';
          }

          const Icon =
            visual === 'completed'
              ? CheckCircle2
              : visual === 'failed'
                ? XCircle
                : visual === 'locked'
                  ? Lock
                  : Circle;

          return (
            <li
              key={key}
              className={`ft-workflow-timeline__step ft-workflow-timeline__step--${visual}`}
              aria-current={visual === 'current' ? 'step' : undefined}
            >
              <div className="ft-workflow-timeline__icon">
                <Icon size={18} aria-hidden />
              </div>
              <span className="ft-workflow-timeline__label">
                {t(`studentTraining.workflowSteps.${key}`)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
