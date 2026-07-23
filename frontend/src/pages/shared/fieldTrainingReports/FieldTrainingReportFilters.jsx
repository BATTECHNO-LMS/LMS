import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminFilterBar } from '../../../components/admin/AdminFilterBar.jsx';
import { SelectField } from '../../../components/admin/SelectField.jsx';
import { useTenant } from '../../../features/tenant/index.js';
import { useAuth, resolveAuthUniversityId } from '../../../features/auth/index.js';
import { ROLES } from '../../../constants/roles.js';

const STATUS_OPTIONS = ['pending', 'approved', 'rejected'];
const TRAINING_STATUS_OPTIONS = [
  'none',
  'ready_for_training',
  'pre_assessment_completed',
  'in_training',
  'task_pending',
  'task_submitted',
  'post_assessment_pending',
  'completed',
  'expelled',
];
const ELIGIBILITY_OPTIONS = ['pending', 'eligible', 'not_eligible'];

export function FieldTrainingReportFilters({ value, onChange, mode = 'admin', showUniversity = true }) {
  const { t } = useTranslation('fieldTrainingReports');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const lockUniversity = mode === 'academic' || !['super_admin'].includes(user?.role);
  const authUniversityId = resolveAuthUniversityId(user);

  const universityId = useMemo(() => {
    if (lockUniversity) return authUniversityId || scopeId || value.university_id;
    return !isAllTenantsSelected && scopeId ? scopeId : value.university_id;
  }, [lockUniversity, authUniversityId, scopeId, isAllTenantsSelected, value.university_id]);

  function patch(patchObj) {
    onChange({
      ...value,
      ...patchObj,
      university_id: lockUniversity ? universityId : patchObj.university_id ?? value.university_id,
    });
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
      <SelectField
        id="ft-report-training-status"
        label={t('filters.trainingStatus')}
        value={value.training_status ?? ''}
        onChange={(e) => patch({ training_status: e.target.value || undefined })}
      >
        <option value="">{t('filters.allTrainingStatuses')}</option>
        {TRAINING_STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="ft-report-eligibility"
        label={t('filters.eligibility')}
        value={value.eligibility_status ?? ''}
        onChange={(e) => patch({ eligibility_status: e.target.value || undefined })}
      >
        <option value="">{t('filters.allEligibility')}</option>
        {ELIGIBILITY_OPTIONS.map((status) => (
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
  const lockUniversity = mode === 'academic' || ![ROLES.SUPER_ADMIN].includes(user?.role);
  const authUniversityId = resolveAuthUniversityId(user);
  const university_id = lockUniversity
    ? authUniversityId || scopeId
    : value.university_id || (!isAllTenantsSelected && scopeId ? scopeId : undefined);
  return {
    ...value,
    // Academic mode always binds to auth university — ignore query university overrides.
    university_id: university_id || undefined,
  };
}
