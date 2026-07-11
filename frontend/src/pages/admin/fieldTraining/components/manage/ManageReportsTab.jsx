import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, FileDown, FileSpreadsheet, Globe, GraduationCap, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../../../features/auth/index.js';
import { useTenant } from '../../../../../features/tenant/index.js';
import { ROLES } from '../../../../../constants/roles.js';
import { Button } from '../../../../../components/common/Button.jsx';
import {
  exportFieldTrainingGlobalReport,
  exportFieldTrainingUniversityReport,
} from '../../../../../features/fieldTrainingReports/index.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';

export function ManageReportsTab({ opportunityId }) {
  const { t } = useTranslation('fieldTraining');
  const { t: tReports } = useTranslation('fieldTrainingReports');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const base = '/admin/field-training/reports';
  const canGlobal = [ROLES.SUPER_ADMIN, ROLES.PROGRAM_ADMIN].includes(user?.role);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');

  const universityId = !isAllTenantsSelected ? scopeId : null;

  async function handleUniversityExport(format) {
    if (!universityId) {
      setError(t('manageHub.reports.selectUniversityFirst'));
      return;
    }
    setError('');
    setExporting(`university-${format}`);
    try {
      await exportFieldTrainingUniversityReport(
        format,
        { university_id: universityId, opportunity_id: opportunityId },
        'admin'
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setExporting('');
    }
  }

  async function handleGlobalExport(format) {
    setError('');
    setExporting(`global-${format}`);
    try {
      await exportFieldTrainingGlobalReport(format, { opportunity_id: opportunityId });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setExporting('');
    }
  }

  return (
    <div className="ft-manage-panel">
      <header className="ft-manage-panel__head">
        <div>
          <h2 className="ft-manage-panel__title">{t('manageHub.tabs.reports')}</h2>
          <p className="ft-manage-panel__desc">{t('manageHub.reportsDesc')}</p>
        </div>
        <Button as={Link} to={base} variant="outline" className="btn--sm">
          <BarChart3 size={14} aria-hidden />
          {t('manageHub.openTab.reports')}
        </Button>
      </header>

      {error ? <p className="form-field__error">{error}</p> : null}

      <div className="ft-manage-report-grid">
        <article className="ft-manage-report-card">
          <div className="ft-manage-report-card__icon" aria-hidden>
            <GraduationCap size={22} />
          </div>
          <h3>{t('manageHub.reports.student.title')}</h3>
          <p>{t('manageHub.reports.student.desc')}</p>
          <p className="ft-manage-panel__desc">{t('manageHub.reports.studentHint')}</p>
          <Button
            as={Link}
            to={`${base}/students?opportunity_id=${opportunityId}`}
            variant="primary"
            className="btn--sm"
          >
            {t('manageHub.reports.open')}
          </Button>
        </article>

        <article className="ft-manage-report-card">
          <div className="ft-manage-report-card__icon" aria-hidden>
            <Users size={22} />
          </div>
          <h3>{t('manageHub.reports.university.title')}</h3>
          <p>{t('manageHub.reports.university.desc')}</p>
          <div className="ft-manage-inline-actions">
            <Button
              type="button"
              variant="outline"
              className="btn--sm"
              disabled={Boolean(exporting)}
              onClick={() => handleUniversityExport('pdf')}
            >
              <FileDown size={14} aria-hidden />
              {exporting === 'university-pdf' ? t('saving') : tReports('export.pdf')}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="btn--sm"
              disabled={Boolean(exporting)}
              onClick={() => handleUniversityExport('xlsx')}
            >
              <FileSpreadsheet size={14} aria-hidden />
              {exporting === 'university-xlsx' ? t('saving') : tReports('export.excel')}
            </Button>
            <Button as={Link} to={`${base}/university`} variant="primary" className="btn--sm">
              {t('manageHub.reports.open')}
            </Button>
          </div>
        </article>

        {canGlobal ? (
          <article className="ft-manage-report-card">
            <div className="ft-manage-report-card__icon" aria-hidden>
              <Globe size={22} />
            </div>
            <h3>{t('manageHub.reports.global.title')}</h3>
            <p>{t('manageHub.reports.global.desc')}</p>
            <div className="ft-manage-inline-actions">
              <Button
                type="button"
                variant="outline"
                className="btn--sm"
                disabled={Boolean(exporting)}
                onClick={() => handleGlobalExport('pdf')}
              >
                <FileDown size={14} aria-hidden />
                {exporting === 'global-pdf' ? t('saving') : tReports('export.pdf')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="btn--sm"
                disabled={Boolean(exporting)}
                onClick={() => handleGlobalExport('xlsx')}
              >
                <FileSpreadsheet size={14} aria-hidden />
                {exporting === 'global-xlsx' ? t('saving') : tReports('export.excel')}
              </Button>
              <Button as={Link} to={`${base}/global`} variant="primary" className="btn--sm">
                {t('manageHub.reports.open')}
              </Button>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
