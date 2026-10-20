import { useTranslation } from 'react-i18next';

function formatPoints(component) {
  if (!component) return '—';
  const points = component.points;
  const max = component.max;
  if (points == null && max == null) return '—';
  return `${points ?? '—'} / ${max ?? '—'}`;
}

/**
 * Canonical readiness meter — score vs completion requirements stay visually separate.
 */
export function StudentReadinessMeter({ readiness, onNavigate }) {
  const { t } = useTranslation('fieldTraining');
  if (!readiness) return null;

  const score = readiness.score || {};
  const components = score.components || {};
  const completion = readiness.completion_requirements || {};
  const hours = completion.hours || {};
  const stateClass = String(readiness.state || 'NOT_READY').toLowerCase().replace(/_/g, '-');

  return (
    <section className={`ft-readiness ft-readiness--${stateClass}`} aria-labelledby="ft-readiness-title">
      <header className="ft-readiness__header">
        <div>
          <p className="ft-readiness__eyebrow">{t('studentTraining.readiness.eyebrow')}</p>
          <h2 id="ft-readiness-title" className="ft-readiness__title">
            {t('studentTraining.readiness.title')}
          </h2>
        </div>
        <span className="ft-readiness__state">{readiness.state_label_ar}</span>
      </header>

      {readiness.explanation_ar ? (
        <p className="ft-readiness__explanation">{readiness.explanation_ar}</p>
      ) : null}

      <div className="ft-readiness__panels">
        <div className="ft-readiness__panel">
          <h3 className="ft-readiness__panel-title">{t('studentTraining.readiness.scoredTitle')}</h3>
          <ul className="ft-readiness__score-list">
            <li>
              <span>{t('studentTraining.readiness.attendance')}</span>
              <strong>{formatPoints(components.attendance)}</strong>
            </li>
            <li>
              <span>{t('studentTraining.readiness.post')}</span>
              <strong>{formatPoints(components.postAssessment)}</strong>
            </li>
            <li>
              <span>{t('studentTraining.readiness.tasks')}</span>
              <strong>{formatPoints(components.tasks)}</strong>
            </li>
            <li>
              <span>{t('studentTraining.readiness.behavior')}</span>
              <strong>{formatPoints(components.behavior)}</strong>
            </li>
          </ul>
          <div className="ft-readiness__total">
            <span>{t('studentTraining.readiness.scoreTotal')}</span>
            <strong>
              {score.final != null ? score.final : '—'} / 100
              {score.passing != null ? (
                <em>
                  {' '}
                  ({t('studentTraining.readiness.threshold', { n: score.passing })})
                </em>
              ) : null}
            </strong>
          </div>
        </div>

        <div className="ft-readiness__panel ft-readiness__panel--completion">
          <h3 className="ft-readiness__panel-title">{t('studentTraining.readiness.completionTitle')}</h3>
          <ul className="ft-readiness__req-list">
            {hours.required != null && hours.required > 0 ? (
              <li>
                <span>{t('studentTraining.readiness.hours')}</span>
                <strong>
                  {hours.completed ?? 0} / {hours.required} {t('studentTraining.readiness.hoursUnit')}
                </strong>
              </li>
            ) : null}
            {completion.pre?.required ? (
              <li>
                <span>PRE Assessment</span>
                <strong>
                  {completion.pre.completed
                    ? t('studentTraining.readiness.completed')
                    : t('studentTraining.readiness.incomplete')}
                </strong>
              </li>
            ) : null}
            {completion.post?.required ? (
              <li>
                <span>POST Assessment</span>
                <strong>
                  {completion.post.completed
                    ? t('studentTraining.readiness.completed')
                    : t('studentTraining.readiness.incomplete')}
                </strong>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      {Array.isArray(readiness.reason_labels_ar) && readiness.reason_labels_ar.length ? (
        <ul className="ft-readiness__blockers">
          {readiness.reason_labels_ar.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      ) : null}

      {typeof onNavigate === 'function' && readiness.primary_reason ? (
        <button
          type="button"
          className="btn btn--sm btn--outline ft-readiness__cta"
          onClick={() => onNavigate(readiness)}
        >
          {t('studentTraining.readiness.viewDetails')}
        </button>
      ) : null}
    </section>
  );
}
