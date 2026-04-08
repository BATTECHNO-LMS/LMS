import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function FormSwitch({ id, label, checked, onChange, error, className, disabled }) {
  const { locale } = useLocale();
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
        <span className="form-switch__label">{typeof label === 'string' ? translateText(label, locale) : label}</span>
      </label>
      {error ? <p className="form-field__error">{typeof error === 'string' ? translateText(error, locale) : error}</p> : null}
    </div>
  );
}
