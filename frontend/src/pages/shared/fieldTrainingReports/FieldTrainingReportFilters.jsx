import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminFilterBar } from '../../../components/admin/AdminFilterBar.jsx';
import { SelectField } from '../../../components/admin/SelectField.jsx';
import { useTenant } from '../../../features/tenant/index.js';
import { useAuth } from '../../../features/auth/index.js';
import { ROLES } from '../../../constants/roles.js';

const STATUS_OPTIONS = ['pending', 'approved', 'rejected'];

export function FieldTrainingReportFilters({ value, onChange, mode = 'admin', showUniversity = true }) {
  const { t } = useTranslation('fieldTrainingReports');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const lockUniversity = mode === 'academic' || !['super_admin'].includes(user?.role);

  const universityId = useMemo(() => {
    if (lockUniversity) return user?.universityId || scopeId || value.university_id;
    return !isAllTenantsSelected && scopeId ? scopeId : value.university_id;
  }, [lockUniversity, user, scopeId, isAllTenantsSelected, value.university_id]);

  function patch(patchObj) {
    onChange({ ...value, ...patchObj, university_id: lockUniversity ? universityId : patchObj.university_id ?? value.university_id });
  }

  return (
    <AdminFilterBar>
      {showUniversity && !lockUniversity ? (
        <SelectField
          id="ft-report-university"
          label={t('filters.university')}
          value={value.university_id ?? universityId ?? ''}
          onChange={(e) => patch({ university_id: e.target.value || undefined })}
        >
          <option value="">{t('filters.allUniversities')}</option>
        </SelectField>
      ) : null}
      {lockUniversity && universityId ? (
        <p className="crud-muted">{t('filters.universityLocked')}</p>
      ) : null}
      <SelectField
        id="ft-report-status"
        label={t('filters.status')}
        value={value.status ?? ''}
        onChange={(e) => patch({ status: e.target.value || undefined })}
      >
        <option value="">{t('filters.allStatuses')}</option>
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </SelectField>
      <label className="admin-field">
        <span className="admin-field__label">{t('filters.from')}</span>
        <input
          type="date"
          className="admin-field__input"
          value={value.from ?? ''}
          onChange={(e) => patch({ from: e.target.value || undefined })}
        />
      </label>
      <label className="admin-field">
        <span className="admin-field__label">{t('filters.to')}</span>
        <input
          type="date"
          className="admin-field__input"
          value={value.to ?? ''}
          onChange={(e) => patch({ to: e.target.value || undefined })}
        />
      </label>
    </AdminFilterBar>
  );
}

export function resolveReportParams(value, { mode = 'admin', user, scopeId, isAllTenantsSelected }) {
  const lockUniversity =
    mode === 'academic' || ![ROLES.SUPER_ADMIN].includes(user?.role);
  const university_id = lockUniversity
    ? user?.universityId || scopeId
    : value.university_id || (!isAllTenantsSelected && scopeId ? scopeId : undefined);
  return {
    ...value,
    university_id: university_id || undefined,
  };
}
