import { cn } from '../../utils/helpers.js';

export function LoadingSpinner({ label = 'جاري التحميل', className }) {
  return (
    <div className={cn('loading-spinner', className)} role="status" aria-live="polite">
      <span className="loading-spinner__ring" aria-hidden />
      <span className="loading-spinner__label">{label}</span>
    </div>
  );
}
