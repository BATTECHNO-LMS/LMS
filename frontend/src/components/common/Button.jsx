import { cn } from '../../utils/helpers.js';

export function Button({
  children,
  type = 'button',
  variant = 'primary',
  className,
  disabled,
  ...rest
}) {
  return (
    <button
      type={type}
      className={cn('btn', `btn--${variant}`, className)}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
