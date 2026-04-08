import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function Button({
  children,
  type = 'button',
  variant = 'primary',
  className,
  disabled,
  ...rest
}) {
  const { locale } = useLocale();
  const renderedChildren = typeof children === 'string' ? translateText(children, locale) : children;
  return (
    <button
      type={type}
      className={cn('btn', `btn--${variant}`, className)}
      disabled={disabled}
      {...rest}
    >
      {renderedChildren}
    </button>
  );
}
