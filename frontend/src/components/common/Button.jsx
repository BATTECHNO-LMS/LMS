import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function Button({
  children,
  type = 'button',
  /** @type {'primary' | 'secondary' | 'outline' | 'danger' | 'light' | 'ghost' | 'accent' | 'icon'} */
  variant = 'primary',
  /** @type {'sm' | 'md' | 'lg'} */
  size = 'md',
  loading = false,
  className,
  disabled,
  ...rest
}) {
  const { locale } = useLocale();
  const isDisabled = Boolean(disabled || loading);
  const renderedChildren =
    typeof children === 'string' ? translateText(children, locale) : children;

  return (
    <button
      type={type}
      className={cn(
        'btn',
        `btn--${variant}`,
        size && size !== 'md' && `btn--${size}`,
        loading && 'btn--loading',
        className
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <>
          <span className="btn__spinner" aria-hidden />
          <span>جاري...</span>
        </>
      ) : (
        renderedChildren
      )}
    </button>
  );
}
