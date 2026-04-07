import { cn } from '../../utils/helpers.js';

export function FormTextarea({ id, label, error, className, inputClassName, rows = 4, ...rest }) {
  return (
    <div className={cn('form-field', className)}>
      {label ? (
        <label className="form-field__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <textarea
        id={id}
        rows={rows}
        className={cn('form-field__control form-field__control--textarea', inputClassName)}
        {...rest}
      />
      {error ? <p className="form-field__error">{error}</p> : null}
    </div>
  );
}
