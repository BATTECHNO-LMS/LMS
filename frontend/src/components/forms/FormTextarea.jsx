import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function FormTextarea({ id, label, error, className, inputClassName, rows = 4, ...rest }) {
  const { locale } = useLocale();
  return (
    <div className={cn('form-field', className)}>
      {label ? (
        <label className="form-field__label" htmlFor={id}>
          {typeof label === 'string' ? translateText(label, locale) : label}
        </label>
      ) : null}
      <textarea
        id={id}
        rows={rows}
        className={cn('form-field__control form-field__control--textarea', inputClassName)}
        {...rest}
      />
      {error ? <p className="form-field__error">{typeof error === 'string' ? translateText(error, locale) : error}</p> : null}
    </div>
  );
}
