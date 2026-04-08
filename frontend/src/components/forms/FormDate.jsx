import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export function FormDate({ id, label, error, className, inputClassName, ...rest }) {
  const { locale } = useLocale();
  return (
    <div className={cn('form-field', className)}>
      {label ? (
        <label className="form-field__label" htmlFor={id}>
          {typeof label === 'string' ? translateText(label, locale) : label}
        </label>
      ) : null}
      <input id={id} type="date" className={cn('form-field__control', inputClassName)} {...rest} />
      {error ? <p className="form-field__error">{typeof error === 'string' ? translateText(error, locale) : error}</p> : null}
    </div>
  );
}
