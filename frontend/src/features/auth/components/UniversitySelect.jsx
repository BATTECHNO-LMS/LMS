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
 *   options: { id: string, name: string }[],
 *   loading?: boolean,
 * }} props
 */
export function UniversitySelect({ id, label, value, onChange, onBlur, name, error, disabled, options, loading }) {
  const { t } = useTranslation('auth');

  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        className={`form-field__control${error ? ' form-field__control--error' : ''}`}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        name={name}
        disabled={disabled || loading}
        aria-invalid={Boolean(error)}
        aria-busy={Boolean(loading)}
      >
        <option value="">{loading ? t('register.universitiesLoading') : t('register.universityPlaceholder')}</option>
        {options.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      {error ? <p className="form-field__error">{error}</p> : null}
    </div>
  );
}
