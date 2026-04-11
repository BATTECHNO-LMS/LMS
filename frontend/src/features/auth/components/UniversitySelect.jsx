import { useTranslation } from 'react-i18next';
import { MOCK_UNIVERSITIES } from '../../../constants/universities.js';
import { FormError } from './FormError.jsx';

export function UniversitySelect({ id, label, error, value, onChange, onBlur, name, disabled }) {
  const { t, i18n } = useTranslation('auth');
  const isAr = i18n.language.startsWith('ar');

  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        className="form-field__control"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <option value="">{t('register.universityPlaceholder')}</option>
        {MOCK_UNIVERSITIES.map((u) => (
          <option key={u.id} value={u.id}>
            {isAr ? u.nameAr : u.nameEn}
          </option>
        ))}
      </select>
      <FormError id={error ? `${id}-error` : undefined} message={error} />
    </div>
  );
}
