import { AlertCircle } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { cn } from '../../utils/helpers.js';

const DEFAULT_MESSAGES = {
  generic: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
  network: 'تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت ثم أعد المحاولة.',
  forbidden: 'ليس لديك صلاحية للوصول إلى هذا المحتوى.',
  notFound: 'لم يتم العثور على الصفحة أو المورد المطلوب.',
  server: 'الخدمة غير متاحة حالياً. نعمل على إصلاح المشكلة.',
};

/**
 * Human-friendly Arabic error state.
 * @param {{
 *   title?: string,
 *   message?: string,
 *   code?: keyof typeof DEFAULT_MESSAGES,
 *   actionLabel?: string,
 *   onRetry?: () => void,
 *   className?: string,
 *   children?: React.ReactNode,
 * }} props
 */
export function ErrorState({
  title = 'تعذّر إكمال الطلب',
  message,
  code = 'generic',
  actionLabel = 'إعادة المحاولة',
  onRetry,
  className,
  children,
}) {
  const resolvedMessage = message || DEFAULT_MESSAGES[code] || DEFAULT_MESSAGES.generic;

  return (
    <div className={cn('ds-error-state', className)} role="alert">
      <span className="ds-error-state__icon" aria-hidden>
        <AlertCircle size={26} strokeWidth={1.75} />
      </span>
      <h2 className="ds-error-state__title">{title}</h2>
      <p className="ds-error-state__message">{resolvedMessage}</p>
      {children}
      {onRetry ? (
        <div className="ds-error-state__action">
          <Button type="button" variant="outline" onClick={onRetry}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
