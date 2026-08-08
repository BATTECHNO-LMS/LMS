import { cn } from '../../../../utils/helpers.js';

/**
 * Step indicator + progress bar for the evaluation wizard.
 * @param {{ steps: string[], currentIndex: number }} props
 */
export function EvaluationProgress({ steps, currentIndex }) {
  const total = steps.length;
  const pct = total > 1 ? Math.round((currentIndex / (total - 1)) * 100) : 100;

  return (
    <div className="eval-progress">
      <div className="eval-progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="eval-progress__fill" style={{ width: `${pct}%` }} />
      </div>
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
