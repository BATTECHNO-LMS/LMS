import { useTranslation } from 'react-i18next';

/**
 * @param {{
 *   id?: string,
 *   label: string,
 *   value: string,
 *   onChange: (e: import('react').ChangeEvent<HTMLSelectElement>) => void,
 *   onBlur?: () => void,
 *   name?: string,
 *   error?: string,
 *   disabled?: boolean,
 *   options: { id: string, label: string }[],
 *   loading?: boolean,
 *   placeholder?: string,
 *   loadingLabel?: string,
 *   emptyLabel?: string,
 *   controlClassName?: string,
 * }} props
 */
export function SpecialtySelect({
  id,
  label,
  value,
  onChange,
  onBlur,
  name,
  error,
  disabled,
  options,
  loading,
  placeholder,
  loadingLabel,
  emptyLabel,
  controlClassName = '',
}) {
  const { t } = useTranslation('auth');

  const placeholderText =
    placeholder ?? t('register.specialtyPlaceholder', { defaultValue: 'اختر التخصص' });
  const loadingText =
    loadingLabel ?? t('register.specialtiesLoading', { defaultValue: 'جاري تحميل التخصصات…' });
  const emptyText =
    emptyLabel ?? t('register.specialtiesEmpty', { defaultValue: 'لا توجد تخصصات متاحة لهذه الجامعة' });

  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={`form-field__control${controlClassName ? ` ${controlClassName}` : ''}${error ? ' form-field__control--error' : ''}`}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        name={name}
        disabled={disabled || loading}
        aria-invalid={Boolean(error)}
        aria-busy={Boolean(loading)}
      >
        <option value="">{loading ? loadingText : placeholderText}</option>
        {!loading
          ? options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))
          : null}
      </select>
      {!loading && !options.length ? (
        <p className="auth-register__helper" role="status">
          {emptyText}
        </p>
      ) : null}
      {error ? <p className="form-field__error">{error}</p> : null}
    </div>
  );
}
