import { cn } from '../../utils/helpers.js';

export function FormDate({ id, label, error, className, inputClassName, ...rest }) {
  return (
    <div className={cn('form-field', className)}>
      {label ? (
        <label className="form-field__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <input id={id} type="date" className={cn('form-field__control', inputClassName)} {...rest} />
      {error ? <p className="form-field__error">{error}</p> : null}
    </div>
  );
}
