import { cn } from '../../utils/helpers.js';

/**
 * Shared student progress bar (courses, profile, training).
 * @param {{ value: number, className?: string, showLabel?: boolean, label?: string }} props
 */
export function StudentProgressBar({ value = 0, className, showLabel = false, label }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div className={cn('student-progress', className)}>
      {showLabel || label ? (
        <div className="student-progress__labels">
          <span>{label}</span>
          <strong>{Math.round(pct)}%</strong>
        </div>
      ) : null}
      <div
        className="student-progress__track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="student-progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
