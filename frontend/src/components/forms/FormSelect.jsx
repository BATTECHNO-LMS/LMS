import { cn } from '../../utils/helpers.js';

export function FormSelect({
  id,
  label,
  error,
  className,
  selectClassName,
  children,
  ...rest
}) {
  return (
    <div className={cn('form-field', className)}>
      {label ? (
        <label className="form-field__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <select id={id} className={cn('form-field__control', selectClassName)} {...rest}>
        {children}
      </select>
      {error ? <p className="form-field__error">{error}</p> : null}
    </div>
  );
}
