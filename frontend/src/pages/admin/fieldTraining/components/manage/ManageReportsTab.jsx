import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Eye,
  FileDown,
  FileSpreadsheet,
  Globe,
  GraduationCap,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../../../features/auth/index.js';
import { useTenant } from '../../../../../features/tenant/index.js';
import { ROLES } from '../../../../../constants/roles.js';
import { Button } from '../../../../../components/common/Button.jsx';
import {
  exportFieldTrainingGlobalReport,
  exportFieldTrainingUniversityReport,
} from '../../../../../features/fieldTrainingReports/index.js';
import {
  downloadOpportunityComprehensiveReportPdf,
  downloadOpportunityFinalReportPdf,
  downloadOpportunityOfficialExcel,
  fetchOpportunityFinalReport,
  fetchOpportunityReportValidation,
} from '../../../../../features/fieldTraining/fieldTraining.service.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';

function SummaryCard({ label, value }) {
  return (
    <article className="ft-report-summary-card">
      <span>{label}</span>
      <strong>{value ?? 'غير متوفر'}</strong>
    </article>
  );
}

export function ManageReportsTab({ opportunityId, opportunity }) {
  const { t } = useTranslation('fieldTraining');
  const { t: tReports } = useTranslation('fieldTrainingReports');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const base = '/admin/field-training/reports';
  const canGlobal = [ROLES.SUPER_ADMIN].includes(user?.role);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [validation, setValidation] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingValidation, setLoadingValidation] = useState(false);

  const universityId = !isAllTenantsSelected ? scopeId : null;
  const universityName =
    opportunity?.university_name ||
    opportunity?.universities?.name ||
    validation?.university ||
    t('manageHub.reports.tafilaDefaultUniversity');
  const opportunityTitle = opportunity?.title || validation?.opportunityTitle || 'غير متوفر';
  const trainingModeAr =
    opportunity?.training_mode === 'remote'
      ? t('trainingMode.remote', 'عن بعد')
      : opportunity?.training_mode === 'onsite'
        ? t('trainingMode.onsite', 'وجاهي')
        : validation?.trainingModeAr || 'غير متوفر';

  async function refreshValidation() {
    if (!opportunityId) return;
    setLoadingValidation(true);
    setError('');
    try {
      const data = await fetchOpportunityReportValidation(opportunityId);
      setValidation(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoadingValidation(false);
    }
  }

  useEffect(() => {
    refreshValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId]);

  async function handleOfficialAction(kind) {
    if (!opportunityId) return;
    setError('');
    setExporting(kind);
    try {
      if (kind === 'preview') {
        const data = await fetchOpportunityFinalReport(opportunityId);
        setPreview(data);
        setValidation(data.validation || validation);
      } else if (kind === 'final-pdf') {
        await downloadOpportunityFinalReportPdf(opportunityId);
      } else if (kind === 'comprehensive-pdf') {
        await downloadOpportunityComprehensiveReportPdf(opportunityId);
      } else if (kind === 'excel') {
        await downloadOpportunityOfficialExcel(opportunityId);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setExporting('');
    }
  }

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

  const ready = Boolean(validation?.ready);
  const summary = preview?.summary || validation?.summary || {};

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

      <section className="ft-official-report">
        <div className="ft-official-report__intro">
          <h3>{t('manageHub.reports.official.title')}</h3>
          <p>
            <strong>{universityName}</strong>
            <br />
            {opportunityTitle}
            <br />
            {t('manageHub.reports.official.trainingMode')}: {trainingModeAr}
          </p>
        </div>

        <div className="ft-report-summary-grid">
          <SummaryCard label={t('manageHub.reports.official.total')} value={summary.totalStudents} />
          <SummaryCard label={t('manageHub.reports.official.eligible')} value={summary.eligible} />
          <SummaryCard label={t('manageHub.reports.official.notEligible')} value={summary.notEligible} />
          <SummaryCard
            label={t('manageHub.reports.official.avgScore')}
            value={summary.averageApprovedFinalScore}
          />
          <SummaryCard
            label={t('manageHub.reports.official.avgAttendance')}
            value={
              summary.averageAttendance != null ? `${summary.averageAttendance}%` : 'غير متوفر'
            }
          />
        </div>

        <div
          className={`ft-official-report__validation ${ready ? 'is-ready' : 'is-blocked'}`}
          role="status"
        >
          {ready ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <div>
            <strong>
              {validation?.statusAr ||
                (loadingValidation
                  ? t('manageHub.reports.official.validating')
                  : t('manageHub.reports.official.notValidated'))}
            </strong>
            {!ready && validation?.issues?.length ? (
              <ul>
                {validation.issues.map((issue) => (
                  <li key={issue.name}>
                    {issue.name}
                    {issue.detail ? ` : ${JSON.stringify(issue.detail)}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            className="btn--sm"
            onClick={refreshValidation}
            disabled={loadingValidation}
          >
            <RefreshCw size={14} />
            {t('manageHub.reports.official.revalidate')}
          </Button>
        </div>

        <div className="ft-manage-inline-actions">
          <Button
            type="button"
            variant="outline"
            className="btn--sm"
            disabled={Boolean(exporting)}
            onClick={() => handleOfficialAction('preview')}
          >
            <Eye size={14} />
            {exporting === 'preview'
              ? t('saving')
              : t('manageHub.reports.official.preview')}
          </Button>
          <Button
            type="button"
            variant="primary"
            className="btn--sm"
            disabled={Boolean(exporting) || !ready}
            onClick={() => handleOfficialAction('final-pdf')}
          >
            <FileDown size={14} />
            {exporting === 'final-pdf'
              ? t('saving')
              : t('manageHub.reports.official.issueFinal')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="btn--sm"
            disabled={Boolean(exporting) || !ready}
            onClick={() => handleOfficialAction('excel')}
          >
            <FileSpreadsheet size={14} />
            {exporting === 'excel'
              ? t('saving')
              : t('manageHub.reports.official.downloadExcel')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="btn--sm"
            disabled={Boolean(exporting) || !ready}
            onClick={() => handleOfficialAction('comprehensive-pdf')}
          >
            <FileDown size={14} />
            {exporting === 'comprehensive-pdf'
              ? t('saving')
              : t('manageHub.reports.official.comprehensive')}
          </Button>
        </div>

        {preview ? (
          <div className="ft-official-report__preview">
            <h4>{t('manageHub.reports.official.previewTitle')}</h4>
            <p>
              {t('manageHub.reports.official.total')}: {preview.summary?.totalStudents} ·{' '}
              {t('manageHub.reports.official.eligible')}: {preview.summary?.eligible} ·{' '}
              {t('manageHub.reports.official.notEligible')}: {preview.summary?.notEligible} ·{' '}
              {t('manageHub.reports.official.avgScore')}:{' '}
              {preview.summary?.averageApprovedFinalScore ?? 'غير متوفر'}
            </p>
          </div>
        ) : null}
      </section>

      {error ? <p className="form-field__error">{error}</p> : null}

      <div className="ft-manage-report-grid">
        <article className="ft-manage-report-card">
          <div className="ft-manage-report-card__icon" aria-hidden>
            <GraduationCap size={22} />
          </div>
          <h3>{t('manageHub.reports.student.title')}</h3>
          <p>{t('manageHub.reports.student.desc')}</p>
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
                <FileDown size={14} />
                {exporting === 'global-pdf' ? t('saving') : tReports('export.pdf')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="btn--sm"
                disabled={Boolean(exporting)}
                onClick={() => handleGlobalExport('xlsx')}
              >
                <FileSpreadsheet size={14} />
                {exporting === 'global-xlsx' ? t('saving') : tReports('export.excel')}
              </Button>
            </div>
          </article>
        ) : null}
      </div>
    </div>
  );
}
