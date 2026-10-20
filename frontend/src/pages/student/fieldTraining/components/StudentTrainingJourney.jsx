import { useTranslation } from 'react-i18next';

const STATE_CLASS = {
  COMPLETED: 'completed',
  CURRENT: 'current',
  UPCOMING: 'upcoming',
  ACTION_REQUIRED: 'action',
  BLOCKED: 'blocked',
  OPTIONAL: 'optional',
};

/**
 * Premium dynamic journey timeline from backend milestones.
 */
export function StudentTrainingJourney({ journey, onMilestoneClick }) {
  const { t } = useTranslation('fieldTraining');
  if (!journey?.milestones?.length) return null;

  return (
    <section className="ft-journey" aria-labelledby="ft-journey-title">
      <header className="ft-journey__header">
        <div>
          <p className="ft-journey__eyebrow">{t('studentTraining.journey.eyebrow')}</p>
          <h2 id="ft-journey-title" className="ft-journey__title">
            {journey.title_ar || t('studentTraining.journey.title')}
          </h2>
        </div>
        <p className="ft-journey__summary" role="status">
          {journey.summary_ar ||
            t('studentTraining.journey.summary', {
              completed: journey.completed_count,
              total: journey.total_count,
            })}
        </p>
      </header>

      <ol className="ft-journey__rail">
        {journey.milestones.map((m) => {
          const stateKey = STATE_CLASS[m.state] || 'upcoming';
          const clickable = Boolean(m.href) && typeof onMilestoneClick === 'function';
          const Tag = clickable ? 'button' : 'div';
          return (
            <li key={m.key} className={`ft-journey__item ft-journey__item--${stateKey}`}>
              <span className="ft-journey__marker" aria-hidden />
              <Tag
                type={clickable ? 'button' : undefined}
                className="ft-journey__card"
                onClick={clickable ? () => onMilestoneClick(m) : undefined}
              >
                <div className="ft-journey__card-top">
                  <strong className="ft-journey__card-title">{m.title_ar}</strong>
                  <span className="ft-journey__badge">{m.state_label_ar}</span>
                </div>
                {m.detail_ar ? <p className="ft-journey__detail">{m.detail_ar}</p> : null}
              </Tag>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
