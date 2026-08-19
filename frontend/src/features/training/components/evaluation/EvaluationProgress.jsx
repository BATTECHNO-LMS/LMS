import { cn } from '../../../../utils/helpers.js';

/**
 * Step indicator + progress bar for the evaluation wizard.
 * @param {{ steps: string[], currentIndex: number, title?: string }} props
 */
export function EvaluationProgress({ steps, currentIndex, title = 'التقييم النهائي' }) {
  const total = steps.length;
  const stepNumber = Math.min(currentIndex + 1, total || 1);
  const pct = total ? Math.round((stepNumber / total) * 100) : 0;

  return (
    <div className="eval-progress">
      <div className="eval-progress__header">
        <h2 className="eval-progress__title">{title}</h2>
        <p className="eval-progress__meta">
          الخطوة {stepNumber} من {total || 0}
        </p>
      </div>
      <div className="eval-progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="eval-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="eval-progress__pct">{pct}%</p>
      <ol className="eval-progress__steps">
        {steps.map((label, i) => (
          <li
            key={label}
            className={cn(
              'eval-progress__step',
              i === currentIndex && 'eval-progress__step--active',
              i < currentIndex && 'eval-progress__step--done'
            )}
          >
            <span className="eval-progress__step-index">{i + 1}</span>
            <span className="eval-progress__step-label">{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
