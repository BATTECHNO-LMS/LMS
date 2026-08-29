import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Download,
  Eye,
  FileText,
  Minus,
  Plus,
  RotateCcw,
  University,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionCard } from '../../../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import { Button } from '../../../../../components/common/Button.jsx';
import { AlertBanner } from '../../../../../components/designSystem/AlertBanner.jsx';
import { ConfirmationModal } from '../../../../../components/designSystem/ConfirmationModal.jsx';
import { LoadingSkeleton } from '../../../../../components/designSystem/LoadingSkeleton.jsx';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { useOpportunityApplications } from '../../../../../features/fieldTraining/index.js';
import {
  selectTemplateValidation,
  templateValidationGroups,
} from '../../../../../features/fieldTrainingEvaluation/selectTemplateValidation.js';
import { translateEvaluationFieldLabel } from '../../../../../features/fieldTrainingEvaluation/evaluationFieldLabels.js';
import { DocxTemplateDropzone } from '../../../../../features/fieldTrainingEvaluation/components/DocxTemplateDropzone.jsx';
import {
  downloadEvaluationTemplate,
  fetchOpportunityEvaluationTemplate,
  generateOpportunityEvaluationReports,
  previewEvaluationApplicationPayload,
  previewEvaluationTemplate,
  saveSupervisorRating,
  uploadEvaluationTemplate,
  useUniversityDefaultEvaluationTemplate,
} from '../../../../../features/fieldTrainingEvaluation/fieldTrainingEvaluation.service.js';
import { ManageTabError, ManageTabSkeleton } from './ManageTabStates.jsx';

const PREVIEW_FIELDS = [
  ['student_name', 'studentName'],
  ['student_number', 'universityNumber'],
  ['student_specialty', 'studentSpecialty'],
  ['semester', 'semester'],
  ['academic_year', 'academicYear'],
  ['training_start_date', 'trainingStart'],
  ['training_end_date', 'trainingEnd'],
  ['training_days', 'trainingDays'],
  ['actual_training_hours', 'hours'],
  ['actual_daily_hours', 'dailyHours'],
  ['absence_days', 'absenceDays'],
  ['attendance_percentage', 'attendance'],
];

function formatUploadDate(value, locale) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(locale?.startsWith('ar') ? 'ar-JO' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function validationVariant(status) {
  if (status === 'valid') return 'success';
  if (status === 'invalid') return 'danger';
  return 'warning';
}

function headerStatus(resolved, missing) {
  if (missing || !resolved?.id) return 'none';
  if (resolved.validationStatus === 'valid') return 'valid';
  return 'review';
}

function universityLabel(opportunity) {
  return (
    opportunity?.university?.name ||
    opportunity?.university?.name_ar ||
    opportunity?.universities?.name ||
    ''
  );
}

export function ManageEvaluationTemplateTab({ opportunityId, opportunity = null, apiScope = 'admin' }) {
  const { t, i18n } = useTranslation('fieldTrainingEvaluation');
  const { t: tCommon } = useTranslation('common');
  const qc = useQueryClient();
  const canManage = apiScope === 'admin' || apiScope === 'instructor';
  const locale = i18n.language || 'ar';

  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lastValidation, setLastValidation] = useState(null);
  const [alert, setAlert] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewPages, setPreviewPages] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewZoom, setPreviewZoom] = useState(1);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [confirmUseDefault, setConfirmUseDefault] = useState(false);
  const [incomplete, setIncomplete] = useState({ count: 0, fields: [] });
  const [ratingApp, setRatingApp] = useState('');
  const [ratings, setRatings] = useState({
    thinking_and_initiative: 3,
    problem_solving: 3,
    teamwork: 3,
    professional_conduct: 3,
    supervisor_cooperation: 3,
    rules_compliance: 3,
  });

  const appsQuery = useOpportunityApplications(opportunityId, {}, { enabled: Boolean(opportunityId), scope: apiScope });
  const approvedApps = (appsQuery.data?.applications || []).filter((app) => app.status === 'approved');

  const query = useQuery({
    queryKey: ['ft-eval-opp-template', apiScope, opportunityId],
    queryFn: () => fetchOpportunityEvaluationTemplate(opportunityId, apiScope),
    enabled: Boolean(opportunityId),
  });

  const payloadQuery = useQuery({
    queryKey: ['ft-eval-preview-payload', apiScope, ratingApp],
    queryFn: () => previewEvaluationApplicationPayload(ratingApp, apiScope),
    enabled: Boolean(ratingApp),
  });

  const data = query.data || {};
  const resolved = data.resolvedTemplate || data.universityDefault || data.opportunityTemplate;
  const validation = selectTemplateValidation({ lastValidation, resolvedTemplate: resolved });
  const validationGroups = templateValidationGroups(validation);
  const status = headerStatus(resolved, data.missing);
  const currentTemplate = data.opportunityTemplate || (data.resolvedSource === 'opportunity' ? resolved : null);
  const usingUniversityDefault = Boolean(data.universityDefault) && !data.opportunityTemplate;
  const missingTemplateGroups = validationGroups.filter((group) => group.found === false);

  const uploadMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', file.name);
      setUploadProgress(8);
      return uploadEvaluationTemplate(fd, apiScope, opportunityId, {
        onUploadProgress: (evt) => {
          if (!evt.total) return;
          setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
    },
    onSuccess: (uploaded) => {
      const nextValidation = uploaded?.validation || uploaded?.template?.validation || null;
      setLastValidation(nextValidation);
      setFile(null);
      setUploadProgress(100);
      setAlert(
        nextValidation && nextValidation.valid === false
          ? { variant: 'warning', title: t('page.invalidTemplate') }
          : { variant: 'success', title: t('manage.uploadSuccess') }
      );
      qc.invalidateQueries({ queryKey: ['ft-eval-opp-template', apiScope, opportunityId] });
    },
    onError: (err) => {
      const details = err?.response?.data?.details || err?.details;
      setLastValidation(Array.isArray(details?.groups) ? details : null);
      setAlert({ variant: 'danger', title: getApiErrorMessage(err, tCommon('errors.generic')) });
    },
    onSettled: () => setUploadProgress(0),
  });

  const previewMut = useMutation({
    mutationFn: () => previewEvaluationTemplate(resolved.id, apiScope),
    onSuccess: (preview) => {
      setPreviewError('');
      setPreviewHtml(preview.html || '');
      setPreviewPages(preview.pageCount || preview.pages || preview.template?.pageCount || null);
    },
    onError: (err) => {
      setPreviewHtml('');
      setPreviewPages(null);
      setPreviewError(getApiErrorMessage(err, tCommon('errors.generic')));
    },
  });

  const useDefaultMut = useMutation({
    mutationFn: () => useUniversityDefaultEvaluationTemplate(opportunityId, apiScope),
    onSuccess: () => {
      setLastValidation(null);
      setAlert({ variant: 'success', title: t('page.useDefault') });
      qc.invalidateQueries({ queryKey: ['ft-eval-opp-template', apiScope, opportunityId] });
    },
    onError: (err) => setAlert({ variant: 'danger', title: getApiErrorMessage(err, tCommon('errors.generic')) }),
  });

  const generateMut = useMutation({
    mutationFn: () => generateOpportunityEvaluationReports(opportunityId, apiScope),
    onSuccess: (result) => {
      const generated = (result?.results || []).filter((row) => row.generated).length;
      const incompleteRows = (result?.results || []).filter(
        (row) => row.code === 'FIELD_TRAINING_EVALUATION_DATA_INCOMPLETE'
      );
      const failed = (result?.results || []).filter(
        (row) => row.generated === false && !row.reused && row.code !== 'FIELD_TRAINING_EVALUATION_DATA_INCOMPLETE'
      ).length;
      if (result?.skipped === 'NO_APPROVED_APPLICATIONS') {
        setIncomplete({ count: 0, fields: [] });
        setAlert({ variant: 'warning', title: t('page.noApprovedStudents') });
        return;
      }
      if (result?.skipped === 'ALL_GENERATED') {
        setIncomplete({ count: 0, fields: [] });
        setAlert({ variant: 'success', title: t('page.allGenerated') });
        return;
      }
      if (incompleteRows.length) {
        const fields = [...new Set(incompleteRows.flatMap((row) => row.missingFields || []))];
        setIncomplete({ count: incompleteRows.length, fields });
        setAlert({
          variant: 'warning',
          title: t('manage.incompleteAlertTitle'),
          message: t('page.dataIncompleteSummary', {
            count: incompleteRows.length,
            fields: fields.map((field) => translateEvaluationFieldLabel(field, locale)).join('، '),
          }),
        });
        return;
      }
      setIncomplete({ count: 0, fields: [] });
      setAlert({
        variant: generated ? 'success' : failed ? 'danger' : 'info',
        title: t('page.generateSummary', { generated, failed, selected: (result?.results || []).length }),
      });
      qc.invalidateQueries({ queryKey: ['ft-eval-opp-template', apiScope, opportunityId] });
    },
    onError: (err) => setAlert({ variant: 'danger', title: getApiErrorMessage(err, tCommon('errors.generic')) }),
  });

  const generateBlockedReason = useMemo(() => {
    if (!canManage) return t('page.readOnly');
    if (data.missing || !resolved?.id) return t('page.templateMissing');
    if (!approvedApps.length) return t('page.noApprovedStudents');
    return '';
  }, [canManage, data.missing, resolved?.id, approvedApps.length, t]);

  function onSelectFile(next, errorMessage) {
    setFile(next);
    setFileError(errorMessage || '');
  }

  if (query.isLoading) return <ManageTabSkeleton rows={3} />;
  if (query.isError) {
    return (
      <ManageTabError
        message={getApiErrorMessage(query.error, tCommon('errors.generic'))}
        onRetry={() => query.refetch()}
      />
    );
  }

  return (
    <div className="ft-eval-manage" dir={locale.startsWith('ar') ? 'rtl' : 'ltr'}>
      <header className="ft-eval-manage__header">
        <div className="ft-eval-manage__header-text">
          <h2 className="ft-eval-manage__title">{t('manage.pageTitle')}</h2>
          <p className="ft-eval-manage__subtitle">{t('manage.pageSubtitle')}</p>
        </div>
        <StatusBadge variant={status === 'valid' ? 'success' : status === 'none' ? 'muted' : 'warning'}>
          {status === 'valid' ? t('manage.statusValid') : status === 'none' ? t('manage.statusNone') : t('manage.statusReview')}
        </StatusBadge>
      </header>

      {incomplete.count ? (
        <AlertBanner variant="warning" title={t('manage.incompleteAlertTitle')}>
          {t('manage.incompleteCount', { count: incomplete.count })}
        </AlertBanner>
      ) : null}
      {alert ? (
        <AlertBanner variant={alert.variant || 'warning'} title={alert.title}>
          {alert.message || null}
        </AlertBanner>
      ) : null}

      <SectionCard title={t('manage.approvedCard')}>
        <div className="ft-eval-overview">
          <article className="ft-eval-overview__col">
            <p className="ft-eval-overview__kicker">{t('page.currentOpportunity')}</p>
            {currentTemplate ? (
              <>
                <h3 className="ft-eval-overview__name" dir="auto">
                  {currentTemplate.name}
                </h3>
                <div className="ft-eval-overview__badges">
                  <StatusBadge variant="info">DOCX</StatusBadge>
                  <StatusBadge variant="muted">
                    {t('manage.versionLabel', { version: currentTemplate.version })}
                  </StatusBadge>
                  <StatusBadge variant={validationVariant(currentTemplate.validationStatus)}>
                    {currentTemplate.validationStatus === 'valid' ? t('manage.validBadge') : t('manage.statusReview')}
                  </StatusBadge>
                </div>
                {currentTemplate.createdAt ? (
                  <p className="ft-eval-overview__meta">
                    {t('page.uploadedAt')}: {formatUploadDate(currentTemplate.createdAt, locale)}
                  </p>
                ) : null}
              </>
            ) : usingUniversityDefault ? (
              <p className="ft-eval-overview__empty">{t('manage.usingUniversityDefault')}</p>
            ) : (
              <p className="ft-eval-overview__empty">{t('manage.noOpportunityTemplate')}</p>
            )}
          </article>

          <article className="ft-eval-overview__col">
            <p className="ft-eval-overview__kicker">{t('page.universityDefault')}</p>
            {data.universityDefault ? (
              <>
                {universityLabel(opportunity) ? (
                  <p className="ft-eval-overview__uni">{universityLabel(opportunity)}</p>
                ) : null}
                <h3 className="ft-eval-overview__name" dir="auto">
                  {data.universityDefault.name}
                </h3>
                <div className="ft-eval-overview__badges">
                  <StatusBadge variant="success">{t('manage.assignedBadge')}</StatusBadge>
                  <StatusBadge variant="muted">{t('page.isDefault')}</StatusBadge>
                  <StatusBadge variant="muted">
                    {t('manage.versionLabel', { version: data.universityDefault.version })}
                  </StatusBadge>
                </div>
              </>
            ) : (
              <div className="ft-eval-overview__missing">
                <AlertTriangle size={18} aria-hidden />
                <div>
                  <p>{t('manage.noUniversityDefault')}</p>
                  {canManage && apiScope === 'admin' ? (
                    <Link className="btn btn--outline btn--sm" to="/admin/field-training/evaluation-templates">
                      {t('manage.openTemplates')}
                    </Link>
                  ) : null}
                </div>
              </div>
            )}
          </article>
        </div>

        {missingTemplateGroups.length ? (
          <div className="ft-eval-template-gaps">
            <p className="ft-eval-overview__kicker">{t('manage.templateGaps')}</p>
            <ul className="ft-eval-chips">
              {missingTemplateGroups.map((group) => (
                <li key={group.id || group.label}>
                  <StatusBadge variant="warning">
                    {translateEvaluationFieldLabel(group.label || group.id, locale)}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {canManage ? (
          <div className="ft-eval-upload">
            <DocxTemplateDropzone
              file={file}
              onFile={onSelectFile}
              uploading={uploadMut.isPending}
              progress={uploadProgress}
              error={fileError}
            />
            <div className="ft-eval-actions ft-eval-actions--primary">
              <Button
                type="button"
                disabled={!file || uploadMut.isPending}
                loading={uploadMut.isPending}
                className="ft-eval-upload-primary"
                onClick={() => {
                  if (!file || uploadMut.isPending) return;
                  uploadMut.mutate();
                }}
              >
                {t('manage.uploadPrimary')}
              </Button>
            </div>
            <div className="ft-eval-actions ft-eval-actions--secondary">
              <Button
                type="button"
                variant="outline"
                disabled={!resolved?.id || previewMut.isPending}
                loading={previewMut.isPending}
                onClick={() => previewMut.mutate()}
              >
                <Eye size={16} aria-hidden />
                {t('manage.previewTemplate')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!resolved?.id}
                onClick={() => downloadEvaluationTemplate(resolved.id, apiScope)}
              >
                <Download size={16} aria-hidden />
                {t('page.downloadTemplate')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!data.universityDefault || uploadMut.isPending || useDefaultMut.isPending}
                loading={useDefaultMut.isPending}
                onClick={() => setConfirmUseDefault(true)}
              >
                <University size={16} aria-hidden />
                {t('page.useDefault')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="ft-eval-actions ft-eval-actions--secondary">
            {resolved?.id ? (
              <>
                <Button type="button" variant="outline" onClick={() => previewMut.mutate()}>
                  <Eye size={16} aria-hidden />
                  {t('manage.previewTemplate')}
                </Button>
                <Button type="button" variant="outline" onClick={() => downloadEvaluationTemplate(resolved.id, apiScope)}>
                  <Download size={16} aria-hidden />
                  {t('page.downloadTemplate')}
                </Button>
              </>
            ) : null}
          </div>
        )}
      </SectionCard>

      <SectionCard title={t('manage.incompleteCard')} className="ft-eval-incomplete">
        <p className="ft-eval-incomplete__count">
          {incomplete.count
            ? t('manage.incompleteCount', { count: incomplete.count })
            : t('manage.incompleteEmpty')}
        </p>
        {incomplete.fields.length ? (
          <ul className="ft-eval-chips">
            {incomplete.fields.map((field) => (
              <li key={field}>
                <StatusBadge variant="warning">{translateEvaluationFieldLabel(field, locale)}</StatusBadge>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="ft-eval-incomplete__hint">{t('manage.incompleteHint')}</p>
        {generateBlockedReason ? (
          <p className="ft-eval-incomplete__reason">{generateBlockedReason}</p>
        ) : null}
        {canManage ? (
          <Button
            type="button"
            variant="outline"
            className="ft-eval-generate"
            disabled={Boolean(generateBlockedReason) || generateMut.isPending}
            loading={generateMut.isPending}
            onClick={() => setConfirmGenerate(true)}
          >
            {generateMut.isPending ? t('page.generating') : t('page.generateMissing')}
          </Button>
        ) : null}
      </SectionCard>

      <SectionCard
        title={t('page.preview')}
        actions={
          <div className="ft-eval-preview__toolbar">
            {resolved?.name ? (
              <span className="ft-eval-preview__template" dir="auto">
                {resolved.name}
              </span>
            ) : null}
            {previewPages ? (
              <span className="ft-eval-preview__pages">{t('manage.pageCount', { count: previewPages })}</span>
            ) : null}
            {previewHtml ? (
              <div className="ft-eval-zoom">
                <button type="button" onClick={() => setPreviewZoom((z) => Math.max(0.7, z - 0.1))} aria-label={t('manage.zoomOut')}>
                  <Minus size={14} />
                </button>
                <span>{Math.round(previewZoom * 100)}%</span>
                <button type="button" onClick={() => setPreviewZoom((z) => Math.min(1.4, z + 0.1))} aria-label={t('manage.zoomIn')}>
                  <Plus size={14} />
                </button>
              </div>
            ) : null}
            {resolved?.id ? (
              <Button type="button" variant="outline" size="sm" onClick={() => downloadEvaluationTemplate(resolved.id, apiScope)}>
                <Download size={14} aria-hidden />
                {t('page.downloadTemplate')}
              </Button>
            ) : null}
          </div>
        }
      >
        {previewMut.isPending ? <LoadingSkeleton variant="card" count={2} /> : null}
        {previewError ? (
          <div className="ft-eval-preview__error">
            <p>{previewError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => previewMut.mutate()}>
              <RotateCcw size={14} aria-hidden />
              {t('manage.retryPreview')}
            </Button>
          </div>
        ) : null}
        {!previewMut.isPending && !previewError && previewHtml ? (
          <div className="ft-eval-preview__viewport">
            <div
              className="ft-eval-preview__doc"
              style={{ '--ft-eval-zoom': String(previewZoom) }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        ) : null}
        {!previewMut.isPending && !previewError && !previewHtml ? (
          <div className="ft-eval-preview__empty">
            <FileText size={28} aria-hidden />
            <p>{t('manage.previewEmpty')}</p>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title={t('page.studentDataPreview')}>
        <div className="admin-filter-bar">
          <select value={ratingApp} onChange={(e) => setRatingApp(e.target.value)}>
            <option value="">{t('page.studentName')}</option>
            {approvedApps.map((app) => (
              <option key={app.id} value={app.id}>
                {app.student?.full_name || app.student_name || app.id}
              </option>
            ))}
          </select>
        </div>
        {payloadQuery.isFetching ? <LoadingSkeleton variant="row" count={3} /> : null}
        {payloadQuery.data?.payload ? (
          <dl className="ft-eval-payload-preview">
            {PREVIEW_FIELDS.map(([key, labelKey]) => (
              <div key={key}>
                <dt>{t(`page.${labelKey}`)}</dt>
                <dd>
                  {payloadQuery.data.payload[key] === '' || payloadQuery.data.payload[key] == null
                    ? t('manage.valueUnavailable')
                    : String(payloadQuery.data.payload[key])}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {payloadQuery.data?.missingFields?.length ? (
          <ul className="ft-eval-chips">
            {payloadQuery.data.missingFields.map((field) => (
              <li key={field}>
                <StatusBadge variant="warning">{translateEvaluationFieldLabel(field, locale)}</StatusBadge>
              </li>
            ))}
          </ul>
        ) : null}
      </SectionCard>

      {canManage ? (
        <SectionCard title={t('page.supervisorRatings')}>
          <div className="admin-filter-bar">
            {Object.keys(ratings).map((key) => (
              <label key={key}>
                {t(`ratings.${key}`, { defaultValue: key })}
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={ratings[key]}
                  onChange={(e) => setRatings((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                />
              </label>
            ))}
            <Button
              type="button"
              disabled={!ratingApp}
              onClick={() =>
                saveSupervisorRating(ratingApp, ratings, apiScope).catch((err) =>
                  setAlert({ variant: 'danger', title: getApiErrorMessage(err, tCommon('errors.generic')) })
                )
              }
            >
              {t('page.saveRating')}
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <ConfirmationModal
        open={confirmGenerate}
        onClose={() => setConfirmGenerate(false)}
        onConfirm={() => {
          if (generateMut.isPending) return;
          setConfirmGenerate(false);
          generateMut.mutate();
        }}
        title={t('page.generateMissing')}
        message={t('manage.generateConfirm')}
        confirmLabel={t('page.generateMissing')}
        cancelLabel={tCommon('actions.cancel')}
        confirmVariant="primary"
        busy={generateMut.isPending}
      />
      <ConfirmationModal
        open={confirmUseDefault}
        onClose={() => setConfirmUseDefault(false)}
        onConfirm={() => {
          if (useDefaultMut.isPending) return;
          setConfirmUseDefault(false);
          useDefaultMut.mutate();
        }}
        title={t('page.useDefault')}
        message={t('manage.useDefaultConfirm')}
        confirmLabel={t('page.useDefault')}
        cancelLabel={tCommon('actions.cancel')}
        confirmVariant="primary"
        busy={useDefaultMut.isPending}
      />
    </div>
  );
}
