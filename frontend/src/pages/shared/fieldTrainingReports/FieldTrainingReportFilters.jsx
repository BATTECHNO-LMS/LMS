import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminFilterBar } from '../../../components/admin/AdminFilterBar.jsx';
import { SelectField } from '../../../components/admin/SelectField.jsx';
import { useTenant } from '../../../features/tenant/index.js';
import { useAuth, resolveAuthUniversityId } from '../../../features/auth/index.js';
import { useUniversities } from '../../../features/universities/index.js';
import { ROLES } from '../../../constants/roles.js';
import { usesAcademicReportApi } from './reportCapabilities.js';

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
const COMPLETION_OPTIONS = ['completed', 'in_progress', 'not_completed'];
const CERTIFICATE_OPTIONS = ['issued', 'not_issued'];
const ELIGIBILITY_OPTIONS = ['pending', 'eligible', 'ineligible', 'needs_review'];

export function FieldTrainingReportFilters({ value, onChange, mode = 'admin', showUniversity = true }) {
  const { t } = useTranslation('fieldTrainingReports');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const lockUniversity = usesAcademicReportApi(mode) || !['super_admin'].includes(user?.role);
  const authUniversityId = resolveAuthUniversityId(user);
  const { data: universitiesData } = useUniversities({ enabled: !lockUniversity });
  const universities = universitiesData?.universities || [];

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
          <option value="">{t('filters.selectUniversity')}</option>
          {universities.map((uni) => (
            <option key={uni.id} value={uni.id}>
              {uni.name || uni.name_ar || uni.name_en || uni.code}
            </option>
          ))}
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
      <SelectField
        id="ft-report-completion"
        label={t('filters.completionStatus')}
        value={value.completion_status ?? ''}
        onChange={(e) => patch({ completion_status: e.target.value || undefined })}
      >
        <option value="">{t('filters.allCompletion')}</option>
        {COMPLETION_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {t(`completionStatus.${status}`, status)}
          </option>
        ))}
      </SelectField>
      <SelectField
        id="ft-report-certificate"
        label={t('filters.certificateStatus')}
        value={value.certificate_status ?? ''}
        onChange={(e) => patch({ certificate_status: e.target.value || undefined })}
      >
        <option value="">{t('filters.allCertificates')}</option>
        {CERTIFICATE_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {t(`certificateStatus.${status}`, status)}
          </option>
        ))}
      </SelectField>
      <label className="admin-field">
        <span className="admin-field__label">{t('filters.organization')}</span>
        <input
          type="search"
          className="admin-field__input"
          value={value.organization_name ?? ''}
          placeholder={t('filters.organizationPlaceholder')}
          onChange={(e) => patch({ organization_name: e.target.value || undefined })}
        />
      </label>
      <label className="admin-field">
        <span className="admin-field__label">{t('filters.search')}</span>
        <input
          type="search"
          className="admin-field__input"
          value={value.search ?? ''}
          placeholder={t('filters.searchPlaceholder')}
          onChange={(e) => patch({ search: e.target.value || undefined })}
        />
      </label>
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
  const lockUniversity = usesAcademicReportApi(mode) || ![ROLES.SUPER_ADMIN].includes(user?.role);
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
