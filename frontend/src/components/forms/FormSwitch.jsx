import { cn } from '../../utils/helpers.js';

export function FormSwitch({ id, label, checked, onChange, error, className, disabled }) {
  return (
    <div className={cn('form-field form-field--switch', className)}>
      <label className="form-switch" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          className="form-switch__input"
          checked={Boolean(checked)}
          onChange={onChange}
          disabled={disabled}
        />
        <span className="form-switch__slider" aria-hidden />
        <span className="form-switch__label">{label}</span>
      </label>
      {error ? <p className="form-field__error">{error}</p> : null}
    </div>
  );
}
