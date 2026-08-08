import { Button } from '../../../components/common/Button.jsx';
import { Play, RotateCcw } from 'lucide-react';

/**
 * Primary CTA or status panel based on assessment availability / attempts.
 * Does not render a disabled empty button for exhausted/closed states.
 */
export function AssessmentPrimaryAction({ action, onStart, busy = false }) {
  if (!action || action.type === 'none') return null;

  if (action.type === 'start' || action.type === 'resume' || action.type === 'retry') {
    const Icon = action.type === 'retry' ? RotateCcw : Play;
    return (
      <div className="ta-primary-action">
        <Button
          type="button"
          variant="primary"
          className="ta-primary-action__btn"
          disabled={busy}
          onClick={onStart}
        >
          <Icon size={18} strokeWidth={2} aria-hidden />
          <span>{action.label}</span>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`ta-primary-action ta-primary-action--panel ta-primary-action--${action.type}`}
      role="status"
    >
      <p className="ta-primary-action__message">{action.message}</p>
      {action.type === 'not_open' && action.opensAtLabel ? (
        <p className="ta-primary-action__detail">
          يفتح في: <strong>{action.opensAtLabel}</strong>
        </p>
      ) : null}
    </div>
  );
}
