import { forwardRef } from 'react';
import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export const FormInput = forwardRef(function FormInput(
  { id, label, error, className, inputClassName, ...rest },
  ref
) {
  const { locale } = useLocale();
  const translatedRest = {
    ...rest,
    placeholder:
      typeof rest.placeholder === 'string' ? translateText(rest.placeholder, locale) : rest.placeholder,
  };
  return (
    <div className={cn('form-field', className)}>
      {label ? (
        <label className="form-field__label" htmlFor={id}>
          {typeof label === 'string' ? translateText(label, locale) : label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={id}
        className={cn('form-field__control', inputClassName)}
        {...translatedRest}
      />
      {error ? (
        <p className="form-field__error">{typeof error === 'string' ? translateText(error, locale) : error}</p>
      ) : null}
    </div>
  );
});
