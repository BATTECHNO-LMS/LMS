import { forwardRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../utils/helpers.js';
import { useLocale } from '../../features/locale/index.js';
import { translateText } from '../../utils/i18n.js';

export const FormInput = forwardRef(function FormInput(
  { id, label, error, className, inputClassName, passwordToggle = false, type = 'text', ...rest },
  ref
) {
  const { locale } = useLocale();
  const { t } = useTranslation('common');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const showToggle = passwordToggle && type === 'password';
  const effectiveType = showToggle && passwordVisible ? 'text' : type;

  const translatedRest = {
    ...rest,
    placeholder:
      typeof rest.placeholder === 'string' ? translateText(rest.placeholder, locale) : rest.placeholder,
  };

  const inputEl = (
    <input
      ref={ref}
      id={id}
      type={effectiveType}
      className={cn('form-field__control', inputClassName, showToggle && 'form-field__control--with-password-toggle')}
      {...translatedRest}
    />
  );

  return (
    <div className={cn('form-field', className)}>
      {label ? (
        <label className="form-field__label" htmlFor={id}>
          {typeof label === 'string' ? translateText(label, locale) : label}
        </label>
      ) : null}
      {showToggle ? (
        <div className="form-field__password-wrap">
          {inputEl}
          <button
            type="button"
            className="form-field__password-toggle"
            onClick={() => setPasswordVisible((v) => !v)}
            aria-label={passwordVisible ? t('passwordVisibility.hide') : t('passwordVisibility.show')}
            aria-pressed={passwordVisible}
          >
            {passwordVisible ? <EyeOff size={18} strokeWidth={2} aria-hidden /> : <Eye size={18} strokeWidth={2} aria-hidden />}
          </button>
        </div>
      ) : (
        inputEl
      )}
      {error ? (
        <p className="form-field__error">{typeof error === 'string' ? translateText(error, locale) : error}</p>
      ) : null}
    </div>
  );
});
