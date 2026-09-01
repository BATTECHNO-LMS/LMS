import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Download,
  Eye,
  FileText,
  RotateCcw,
  University,
  ClipboardCheck,
  FileArchive,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { SectionCard } from '../../../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import { Button } from '../../../../../components/common/Button.jsx';
import { AlertBanner } from '../../../../../components/designSystem/AlertBanner.jsx';
import { ConfirmationModal } from '../../../../../components/designSystem/ConfirmationModal.jsx';
import { AppModal } from '../../../../../components/designSystem/AppModal.jsx';
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
  fetchOpportunityEvaluationReadiness,
  generateOpportunityEvaluationReports,
  previewEvaluationApplicationPayload,
  previewEvaluationTemplate,
  saveSupervisorRating,
  applyBulkEligibleProfessionalRatings,
  saveOpportunityReportDefaults,
  downloadOpportunityEvaluationZip,
  uploadEvaluationTemplate,
  useUniversityDefaultEvaluationTemplate,
} from '../../../../../features/fieldTrainingEvaluation/fieldTrainingEvaluation.service.js';
import { ManageTabError, ManageTabSkeleton } from './ManageTabStates.jsx';
import { SupervisorAssignmentSection } from './SupervisorAssignmentSection.jsx';

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
  ['organization_name', 'organizationName'],
  ['field_supervisor_name', 'fieldSupervisor'],
  ['responsible_person_name', 'academicSupervisor'],
  ['academic_supervisor_name', 'academicSupervisor'],
  ['professional_evaluation_total', 'professional'],
  ['eligibility_status', 'finalStatus'],
  ['general_comments', 'studentDataPreview'],
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

function formatTemplateVersion(version, t) {
  if (version == null || version === '') return t('manage.versionUnknown');
  return t('manage.versionLabel', { version });
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
  const [previewPdfUrl, setPreviewPdfUrl] = useState('');
  const [previewPages, setPreviewPages] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [confirmBulkRating, setConfirmBulkRating] = useState(false);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [confirmUseDefault, setConfirmUseDefault] = useState(false);
  const [incomplete, setIncomplete] = useState({ count: 0, fields: [], students: [] });
  const [showMissing, setShowMissing] = useState(false);
  const [ratingApp, setRatingApp] = useState('');
  const [studentPdfUrl, setStudentPdfUrl] = useState('');
  const [ratings, setRatings] = useState({
    thinking_and_initiative: 3,
    problem_solving: 3,
    teamwork: 3,
    professional_conduct: 3,
    supervisor_cooperation: 3,
    rules_compliance: 3,
  });
  const hostOrg =
    opportunity?.host_organization && typeof opportunity.host_organization === 'object'
      ? opportunity.host_organization
      : {};
  const [defaults, setDefaults] = useState({
    organization_name: opportunity?.organization_name || '',
    department: hostOrg.department || '',
    email: hostOrg.email || '',
    phone: hostOrg.phone || '',
    fax: hostOrg.fax || '',
    address: hostOrg.address || '',
    field_supervisor_name: hostOrg.field_supervisor_name || hostOrg.contact_person || '',
  });

  const appsQuery = useOpportunityApplications(opportunityId, {}, { enabled: Boolean(opportunityId), scope: apiScope });
  const approvedApps = (appsQuery.data?.applications || []).filter((app) => app.status === 'approved');

  const query = useQuery({
    queryKey: ['ft-eval-opp-template', apiScope, opportunityId],
    queryFn: () => fetchOpportunityEvaluationTemplate(opportunityId, apiScope),
    enabled: Boolean(opportunityId),
  });

  const readinessQuery = useQuery({
    queryKey: ['ft-eval-readiness', apiScope, opportunityId],
    queryFn: () => fetchOpportunityEvaluationReadiness(opportunityId, apiScope),
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
  const bulkEligibleRating = readinessQuery.data?.bulkEligibleRating;
  const bulkEligibleStudents = bulkEligibleRating?.students || [];
  const bulkSummary = bulkEligibleRating?.summary || {};
  const canApplyBulk = readinessQuery.data?.capabilities?.canApplyBulkEligibleRatings;

  const bulkApplyMut = useMutation({
    mutationFn: () =>
      applyBulkEligibleProfessionalRatings(
        opportunityId,
        { confirmed: true, reason: 'اعتماد إداري لاستكمال التقييم المهني للطالب المؤهل' },
        apiScope
      ),
    onSuccess: (result) => {
      setConfirmBulkRating(false);
      qc.invalidateQueries({ queryKey: ['ft-eval-readiness', apiScope, opportunityId] });
      qc.invalidateQueries({ queryKey: ['ft-eval-preview-payload'] });
      setAlert({
        variant: 'success',
        title: t('manage.bulkRatingApplied'),
        message: t('manage.bulkRatingAppliedSummary', {
          students: result?.studentsAffected ?? 0,
          ratings: result?.ratingsApplied ?? 0,
        }),
      });
    },
    onError: (err) =>
      setAlert({ variant: 'danger', title: getApiErrorMessage(err, tCommon('errors.generic')) }),
  });

  const manualRatingStudents = readinessQuery.data?.manualRatingStudents || [];
  const [manualRatingApp, setManualRatingApp] = useState('');
  const [partialRatings, setPartialRatings] = useState({});
  const selectedManualStudent = manualRatingStudents.find((row) => row.applicationId === manualRatingApp);
  const manualCriteriaFields = useMemo(() => {
    const map = {
      PROFESSIONAL_RATING_THINKING_MISSING: 'thinking_and_initiative',
      PROFESSIONAL_RATING_PROBLEM_SOLVING_MISSING: 'problem_solving',
      PROFESSIONAL_RATING_TEAMWORK_MISSING: 'teamwork',
      PROFESSIONAL_RATING_APPEARANCE_MISSING: 'professional_conduct',
      PROFESSIONAL_RATING_SUPERVISOR_COOPERATION_MISSING: 'supervisor_cooperation',
      PROFESSIONAL_RATING_RULES_MISSING: 'rules_compliance',
    };
    const codes = (selectedManualStudent?.missingFieldDetails || selectedManualStudent?.missingProfessionalCriteria || []).map(
      (item) => item.code || item
    );
    return [...new Set(codes.map((code) => map[code]).filter(Boolean))];
  }, [selectedManualStudent]);

  const missingStudents = incomplete.students?.length
    ? incomplete.students
    : readinessQuery.data?.missingStudents || [];
  const missingCount = incomplete.count || missingStudents.length;
  const templatePreflight = readinessQuery.data?.templatePreflight;
  const templateReadiness = readinessQuery.data?.templateReadiness;
  const documentRenderer =
    readinessQuery.data?.documentRenderer || templateReadiness?.documentRenderer || null;
  const templateFidelityPass = Boolean(
    templateReadiness?.templateGenerationReady ?? readinessQuery.data?.templateFidelityStatus === 'PASS'
  );

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
      setPreviewPages(preview.pageCount || preview.pages || preview.template?.pageCount || null);
      if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
      if (preview.pdfBase64) {
        const binary = Uint8Array.from(atob(preview.pdfBase64), (c) => c.charCodeAt(0));
        setPreviewPdfUrl(URL.createObjectURL(new Blob([binary], { type: 'application/pdf' })));
      } else {
        setPreviewPdfUrl('');
        if (preview.previewMode === 'blocked') {
          setPreviewError(t('manage.previewBlocked'));
        }
      }
    },
    onError: (err) => {
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
      const generated = result?.summary?.generated ?? (result?.results || []).filter((row) => row.generated).length;
      const incompleteRows = result?.missingStudents || (result?.results || []).filter(
        (row) => row.code === 'FIELD_TRAINING_EVALUATION_DATA_INCOMPLETE' || row.readiness === 'MISSING_REQUIRED_DATA'
      );
      const failed = result?.summary?.failed ?? (result?.results || []).filter(
        (row) => row.generated === false && !row.reused && row.code !== 'FIELD_TRAINING_EVALUATION_DATA_INCOMPLETE'
      ).length;
      qc.invalidateQueries({ queryKey: ['ft-eval-readiness', apiScope, opportunityId] });
      qc.invalidateQueries({ queryKey: ['ft-eval-opp-template', apiScope, opportunityId] });
      if (result?.skipped === 'NO_APPROVED_APPLICATIONS') {
        setIncomplete({ count: 0, fields: [], students: [] });
        setAlert({ variant: 'warning', title: t('page.noApprovedStudents') });
        return;
      }
      if (incompleteRows.length) {
        const fields = [...new Set(incompleteRows.flatMap((row) => (row.missingFields || row.missingFieldDetails || []).map((item) => item.code || item)))];
        setIncomplete({ count: incompleteRows.length, fields, students: incompleteRows });
        setShowMissing(true);
        setAlert({
          variant: 'warning',
          title: t('manage.incompleteAlertTitle'),
          message: t('page.dataIncompleteSummary', {
            count: incompleteRows.length,
            fields: fields.map((field) => translateEvaluationFieldLabel(field, locale)).join('، '),
          }),
        });
      } else {
        setIncomplete({ count: 0, fields: [], students: [] });
      }
      setAlert({
        variant: generated || result?.summary?.alreadyGenerated ? 'success' : failed ? 'danger' : 'info',
        title: t('manage.generatedSuccess'),
        message: t('page.generateSummary', {
          generated,
          failed,
          selected: result?.summary?.total || (result?.results || []).length,
        }),
      });
    },
    onError: (err) => setAlert({ variant: 'danger', title: getApiErrorMessage(err, tCommon('errors.generic')) }),
  });

  const zipMut = useMutation({
    mutationFn: () => downloadOpportunityEvaluationZip(opportunityId, apiScope),
    onSuccess: (meta) => {
      const missingReports = Number(meta?.missing || 0);
      setAlert({
        variant: missingReports ? 'warning' : 'success',
        title: t('manage.downloadAll'),
        message: missingReports
          ? t('manage.missingReportsAfterGenerate', { count: missingReports })
          : t('page.zipSummary', {
              selected: meta?.selected || '',
              included: meta?.included || '',
              missing: meta?.missing || '0',
              failed: meta?.failed || '0',
            }),
      });
    },
    onError: (err) => setAlert({ variant: 'danger', title: getApiErrorMessage(err, t('manage.noReportsToDownload')) }),
  });

  const defaultsMut = useMutation({
    mutationFn: () => saveOpportunityReportDefaults(opportunityId, defaults, apiScope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ft-eval-readiness', apiScope, opportunityId] });
      setAlert({ variant: 'success', title: t('manage.saveDefaults') });
    },
    onError: (err) => setAlert({ variant: 'danger', title: getApiErrorMessage(err, tCommon('errors.generic')) }),
  });

  const studentPreviewMut = useMutation({
    mutationFn: () => previewEvaluationApplicationPayload(ratingApp, apiScope, { pdf: true }),
    onSuccess: (preview) => {
      if (studentPdfUrl) URL.revokeObjectURL(studentPdfUrl);
      if (preview?.pdfBase64) {
        const binary = Uint8Array.from(atob(preview.pdfBase64), (c) => c.charCodeAt(0));
        setStudentPdfUrl(URL.createObjectURL(new Blob([binary], { type: 'application/pdf' })));
        setAlert({ variant: 'success', title: t('manage.previewWithStudent') });
      } else {
        setStudentPdfUrl('');
        if (preview?.previewMode === 'blocked') {
          setAlert({ variant: 'warning', title: t('manage.previewBlocked') });
        } else if (preview?.previewMode === 'not_generated') {
          setAlert({
            variant: 'warning',
            title: preview.messageAr || t('manage.previewRequiresGeneration'),
          });
        } else if (preview?.missingFields?.length) {
          setShowMissing(true);
          setIncomplete({
            count: 1,
            fields: preview.missingFields,
            students: [
              {
                applicationId: ratingApp,
                studentName: preview.payload?.student_name,
                universityNumber: preview.payload?.student_number,
                missingFields: preview.missingFieldDetails || preview.missingFields,
              },
            ],
          });
        }
      }
    },
    onError: (err) => setAlert({ variant: 'danger', title: getApiErrorMessage(err, tCommon('errors.generic')) }),
  });

  const generateBlockedReason = useMemo(() => {
    if (!canManage) return t('page.readOnly');
    if (data.missing || !resolved?.id) return t('page.templateMissing');
    if (!templateFidelityPass) return t('manage.fidelityBlocked');
    if (!(readinessQuery.data?.counts?.finalReady ?? readinessQuery.data?.counts?.ready)) {
      return t('manage.noFinalReadyStudents');
    }
    if (!approvedApps.length) return t('page.noApprovedStudents');
    return '';
  }, [
    canManage,
    data.missing,
    resolved?.id,
    templateFidelityPass,
    readinessQuery.data?.counts?.finalReady,
    readinessQuery.data?.counts?.ready,
    approvedApps.length,
    t,
  ]);

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

      <AlertBanner
        variant={
          readinessQuery.isFetching
            ? 'info'
            : templateFidelityPass
              ? 'success'
              : 'danger'
        }
        title={t('manage.fidelityStatus')}
      >
        <p>
          {readinessQuery.isFetching
            ? t('manage.checkingFidelity')
            : templateFidelityPass
              ? t('manage.fidelityPass')
              : t('manage.fidelityBlocked')}
        </p>
        {resolved?.id ? (
          <p dir="ltr">
            {t('manage.templateIdentity', {
              id: resolved.id,
              version: resolved.versionLabel ?? resolved.version ?? t('manage.versionUnknown'),
              fileId: resolved.originalFileId || '—',
            })}
          </p>
        ) : null}
        {templateReadiness?.failureCode ? (
          <p dir="ltr" className="ft-eval-readiness__diag">
            {t('manage.templateFailureCode', { code: templateReadiness.failureCode })}
          </p>
        ) : null}
      </AlertBanner>

      {missingCount ? (
        <AlertBanner variant="warning" title={t('manage.incompleteAlertTitle')}>
          {t('manage.incompleteCount', { count: missingCount })}
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
                    {formatTemplateVersion(currentTemplate.versionLabel ?? currentTemplate.version, t)}
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
                    {formatTemplateVersion(data.universityDefault.versionLabel ?? data.universityDefault.version, t)}
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

      <SupervisorAssignmentSection opportunityId={opportunityId} apiScope={apiScope} />

      <SectionCard title={t('manage.readinessTitle')} className="ft-eval-readiness">
        {readinessQuery.isFetching ? <p>{t('manage.checkingReadiness')}</p> : null}
        {readinessQuery.data?.templatePreflight && !templateFidelityPass ? (
          <AlertBanner variant="danger" title={t('manage.templateNeedsSetup')}>
            {(readinessQuery.data.templatePreflight.issues || []).map((issue) => (
              <p key={issue.code}>{issue.messageAr || issue.code}</p>
            ))}
            {templateReadiness?.failureCode ? (
              <p dir="ltr">{t('manage.templateFailureCode', { code: templateReadiness.failureCode })}</p>
            ) : null}
          </AlertBanner>
        ) : templateFidelityPass ? (
          <p className="ft-eval-readiness__status">{t('manage.templateReady')}</p>
        ) : (
          <p className="ft-eval-readiness__status">{t('manage.templateNeedsSetup')}</p>
        )}
        {templateReadiness ? (
          <div className="ft-eval-readiness__stats ft-eval-readiness__stats--template">
            {[
              ['templateUploadValid', templateReadiness.uploadValid ? t('manage.yes') : t('manage.no')],
              ['templateStructureValid', templateReadiness.structureValid ? t('manage.yes') : t('manage.no')],
              ['templateRendererReady', templateReadiness.rendererReady ? t('manage.yes') : t('manage.no')],
              ['templateGenerationReadyLabel', templateReadiness.templateGenerationReady ? t('manage.yes') : t('manage.no')],
            ].map(([key, value]) => (
              <article key={key}>
                <p>{t(`manage.${key}`)}</p>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        ) : null}
        {documentRenderer ? (
          <AlertBanner
            variant={documentRenderer.available && templateFidelityPass ? 'success' : 'warning'}
            title={t('manage.pdfEngineTitle')}
          >
            <p>
              {documentRenderer.available
                ? `${t('manage.pdfEngineReady')} · ${t('manage.libreOfficeAvailable')}`
                : t('manage.pdfEngineUnavailable')}
            </p>
            {documentRenderer.available && documentRenderer.version ? (
              <p dir="ltr">{t('manage.libreOfficeVersion', { version: documentRenderer.version })}</p>
            ) : null}
            <p>
              {templateFidelityPass
                ? t('manage.officialTemplateReady')
                : t('manage.officialTemplateBlocked')}
            </p>
          </AlertBanner>
        ) : null}
        <div className="ft-eval-readiness__stats">
          {[
            ['totalStudents', readinessQuery.data?.counts?.totalStudents],
            ['dataReadyCount', readinessQuery.data?.counts?.dataReady],
            ['finalReadyCount', readinessQuery.data?.counts?.finalReady ?? readinessQuery.data?.counts?.ready],
            ['readyAutomaticCount', readinessQuery.data?.counts?.readyAutomatic],
            ['readyWithManualCount', readinessQuery.data?.counts?.readyWithManualRating],
            ['needsAuthorizedRatingCount', readinessQuery.data?.counts?.needsAuthorizedRating],
            ['missingStaticCount', readinessQuery.data?.counts?.missingStaticData],
            ['missingCount', readinessQuery.data?.counts?.missingData],
            ['eligibleCount', readinessQuery.data?.counts?.eligible],
            ['notEligibleCount', readinessQuery.data?.counts?.notEligible],
            ['eligibilityPendingCount', readinessQuery.data?.counts?.eligibilityPending],
            ['generatedCount', readinessQuery.data?.counts?.generated],
            ['notGeneratedCount', readinessQuery.data?.counts?.notGenerated],
            ['failedCount', readinessQuery.data?.counts?.generationFailed],
            ['outdatedArtifactsCount', readinessQuery.data?.counts?.outdatedArtifacts],
          ].map(([key, value]) => (
            <article key={key}>
              <p>{t(`manage.${key}`)}</p>
              <strong>{value ?? '—'}</strong>
            </article>
          ))}
        </div>
        {readinessQuery.data?.counts?.missingData ? (
          <p className="ft-eval-readiness__warn">{t('manage.someMissingData')}</p>
        ) : readinessQuery.data?.counts?.totalStudents ? (
          <p>{t('manage.allDataComplete')}</p>
        ) : null}
        {readinessQuery.data?.counts?.outdatedArtifacts ? (
          <AlertBanner variant="warning" title={t('manage.outdatedArtifactsTitle')}>
            {t('manage.outdatedArtifactsMessage', {
              count: readinessQuery.data.counts.outdatedArtifacts,
            })}
          </AlertBanner>
        ) : null}
        <div className="ft-eval-actions ft-eval-actions--secondary">
          <Button type="button" variant="outline" onClick={() => readinessQuery.refetch()} loading={readinessQuery.isFetching}>
            <ClipboardCheck size={16} aria-hidden />
            {t('manage.checkReadiness')}
          </Button>
          {canManage ? (
            <Button
              type="button"
              disabled={Boolean(generateBlockedReason) || generateMut.isPending}
              loading={generateMut.isPending}
              onClick={() => setConfirmGenerate(true)}
            >
              {generateMut.isPending ? t('manage.generatingEvaluations') : t('manage.generateReady')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={!readinessQuery.data?.counts?.generated || zipMut.isPending}
            loading={zipMut.isPending}
            onClick={() => zipMut.mutate()}
          >
            <FileArchive size={16} aria-hidden />
            {t('manage.downloadAll')}
          </Button>
        </div>
      </SectionCard>

      {canManage ? (
        <SectionCard title={t('manage.reportDefaults')}>
          <div className="admin-filter-bar ft-eval-defaults">
            {[
              ['organization_name', 'organization_name'],
              ['department', 'organization_department'],
              ['email', 'organization_email'],
              ['phone', 'organization_phone'],
              ['fax', 'organization_fax'],
              ['address', 'organization_address'],
              ['field_supervisor_name', 'field_supervisor_name'],
            ].map(([key, labelKey]) => (
              <label key={key}>
                {translateEvaluationFieldLabel(labelKey, locale)}
                <input
                  value={defaults[key] || ''}
                  onChange={(e) => setDefaults((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </label>
            ))}
            <Button type="button" onClick={() => defaultsMut.mutate()} loading={defaultsMut.isPending}>
              {t('manage.saveDefaults')}
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title={t('manage.incompleteCard')} className="ft-eval-incomplete">
        <p className="ft-eval-incomplete__count">
          {missingCount
            ? t('manage.incompleteCount', { count: missingCount })
            : t('manage.incompleteEmpty')}
        </p>
        {(incomplete.fields.length ? incomplete.fields : [...new Set(missingStudents.flatMap((row) => (row.missingFields || []).map((item) => item.code || item)))]).length ? (
          <ul className="ft-eval-chips">
            {(incomplete.fields.length
              ? incomplete.fields
              : [...new Set(missingStudents.flatMap((row) => (row.missingFields || []).map((item) => item.code || item)))]
            ).map((field) => (
              <li key={field}>
                <StatusBadge variant="warning">{translateEvaluationFieldLabel(field, locale)}</StatusBadge>
              </li>
            ))}
          </ul>
        ) : null}
        {missingStudents.length ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowMissing(true)}>
            {t('manage.missingModalTitle')}
          </Button>
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
            {generateMut.isPending ? t('manage.generatingEvaluations') : t('manage.generateReady')}
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
        {!previewMut.isPending && !previewError && previewPdfUrl ? (
          <div className="ft-eval-preview__viewport">
            <iframe className="ft-eval-preview__pdf" title={t('manage.previewOfficial')} src={previewPdfUrl} />
          </div>
        ) : null}
        {!previewMut.isPending && !previewError && !previewPdfUrl ? (
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
          <Button
            type="button"
            variant="outline"
            disabled={!ratingApp || studentPreviewMut.isPending}
            loading={studentPreviewMut.isPending}
            onClick={() => studentPreviewMut.mutate()}
          >
            <Eye size={16} aria-hidden />
            {t('manage.previewWithStudent')}
          </Button>
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
            {Array.from({ length: 10 }, (_, i) => i + 1).map((index) => (
              <div key={`criterion_${index}_score`}>
                <dt>{translateEvaluationFieldLabel(`criterion_${index}_score`, locale)}</dt>
                <dd>
                  {payloadQuery.data.payload[`criterion_${index}_score`] == null ||
                  payloadQuery.data.payload[`criterion_${index}_score`] === ''
                    ? t('manage.valueUnavailable')
                    : String(payloadQuery.data.payload[`criterion_${index}_score`])}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
        {studentPdfUrl ? (
          <div className="ft-eval-preview__viewport">
            <iframe className="ft-eval-preview__pdf" title={t('manage.previewOfficial')} src={studentPdfUrl} />
          </div>
        ) : null}
        {payloadQuery.data?.criterionEvidence ? (
          <div className="ft-eval-score-evidence">
            <h4>{t('manage.scoreEvidenceTitle')}</h4>
            <dl className="ft-eval-payload-preview">
              {Object.entries(payloadQuery.data.criterionEvidence).map(([key, row]) =>
                row ? (
                  <div key={key}>
                    <dt>{translateEvaluationFieldLabel(key.replace(/^criterion(\d+)$/, 'criterion_$1_score'), locale)}</dt>
                    <dd>
                      {row.score == null
                        ? t('manage.valueUnavailable')
                        : `${row.score}/5 — ${
                            row.source === 'DERIVED_FROM_PERFORMANCE'
                              ? t('manage.scoreSourceDerived')
                              : row.source === 'MANUAL_AUTHORIZED_BULK_RATING'
                                ? t('manage.scoreSourceBulk')
                                : t('manage.scoreSourceManual')
                          }`}
                      {row.calculatedMetric != null ? ` (${row.calculatedMetric}%)` : ''}
                    </dd>
                  </div>
                ) : null
              )}
            </dl>
          </div>
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
        <SectionCard title={t('manage.completeEvaluationsTitle')} className="ft-eval-bulk-completion">
          <div className="ft-eval-readiness__stats">
            {[
              ['bulkEligibleStudentsCount', bulkSummary.eligibleStudents],
              ['bulkNeedingApprovalCount', bulkSummary.studentsNeedingBulk],
              ['bulkRatingsToApplyCount', bulkSummary.ratingsToApply],
              ['bulkAutoDerivedCount', bulkSummary.automaticallyDerivedCount],
              ['bulkNotEligibleSkippedCount', bulkSummary.notEligibleSkipped],
            ].map(([key, value]) => (
              <article key={key}>
                <p>{t(`manage.${key}`)}</p>
                <strong>{value ?? '—'}</strong>
              </article>
            ))}
          </div>
          {bulkEligibleStudents.length ? (
            <ul className="ft-eval-bulk-impact">
              {bulkEligibleStudents.slice(0, 12).map((row) => (
                <li key={row.applicationId} className="ft-eval-missing-student">
                  <strong>
                    {row.studentName} — {row.universityNumber || '—'}
                  </strong>
                  <ul>
                    {(row.missingCriteria || []).map((item) => (
                      <li key={item.criterionKey || item.labelAr}>{item.labelAr}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('manage.noBulkEligibleStudents')}</p>
          )}
          <div className="ft-eval-actions ft-eval-actions--secondary">
            <Button type="button" variant="outline" onClick={() => readinessQuery.refetch()} loading={readinessQuery.isFetching}>
              {t('manage.recalculateDerivable')}
            </Button>
            {canApplyBulk ? (
              <Button
                type="button"
                disabled={!bulkEligibleStudents.length || bulkApplyMut.isPending}
                loading={bulkApplyMut.isPending}
                onClick={() => setConfirmBulkRating(true)}
              >
                {t('manage.applyBulkEligibleRatings')}
              </Button>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {canManage ? (
        <SectionCard title={t('manage.completeMissingRatings')}>
          <p className="ft-eval-incomplete__hint">{t('manage.completeMissingRatingsHint')}</p>
          {!manualRatingStudents.length ? (
            <p>{t('manage.noManualRatingsNeeded')}</p>
          ) : (
            <div className="admin-filter-bar">
              <select
                value={manualRatingApp}
                onChange={(e) => {
                  setManualRatingApp(e.target.value);
                  setPartialRatings({});
                }}
              >
                <option value="">{t('page.studentName')}</option>
                {manualRatingStudents.map((row) => (
                  <option key={row.applicationId} value={row.applicationId}>
                    {row.studentName} — {row.universityNumber || '—'}
                  </option>
                ))}
              </select>
              {manualCriteriaFields.map((key) => (
                <label key={key}>
                  {t(`ratings.${key}`, { defaultValue: key })}
                  <div className="ft-eval-rating-buttons">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        className={partialRatings[key] === score ? 'is-active' : ''}
                        onClick={() => setPartialRatings((prev) => ({ ...prev, [key]: score }))}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </label>
              ))}
              <Button
                type="button"
                disabled={!manualRatingApp || !manualCriteriaFields.length || manualCriteriaFields.some((key) => !partialRatings[key])}
                onClick={() =>
                  saveSupervisorRating(
                    manualRatingApp,
                    { ...partialRatings, source: 'MANUAL_AUTHORIZED_EVALUATION' },
                    apiScope
                  )
                    .then(() => {
                      qc.invalidateQueries({ queryKey: ['ft-eval-readiness', apiScope, opportunityId] });
                      qc.invalidateQueries({ queryKey: ['ft-eval-preview-payload', apiScope, manualRatingApp] });
                      setPartialRatings({});
                      setAlert({ variant: 'success', title: t('manage.completeMissingRatings') });
                    })
                    .catch((err) =>
                      setAlert({ variant: 'danger', title: getApiErrorMessage(err, tCommon('errors.generic')) })
                    )
                }
              >
                {t('manage.savePartialRating')}
              </Button>
            </div>
          )}
        </SectionCard>
      ) : null}

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
                saveSupervisorRating(ratingApp, { ...ratings, source: 'MANUAL_AUTHORIZED_EVALUATION' }, apiScope)
                  .then(() => {
                    qc.invalidateQueries({ queryKey: ['ft-eval-readiness', apiScope, opportunityId] });
                    qc.invalidateQueries({ queryKey: ['ft-eval-preview-payload', apiScope, ratingApp] });
                    setAlert({ variant: 'success', title: t('manage.completeMissingRatings') });
                  })
                  .catch((err) =>
                    setAlert({ variant: 'danger', title: getApiErrorMessage(err, tCommon('errors.generic')) })
                  )
              }
            >
              {t('page.saveRating')}
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <AppModal
        open={showMissing}
        onClose={() => setShowMissing(false)}
        title={t('manage.missingModalTitle')}
        size="lg"
      >
        {(missingStudents || []).map((row) => (
          <article key={row.applicationId || row.universityNumber} className="ft-eval-missing-student">
            <h3>
              {row.studentName || row.student_name} — {row.universityNumber || row.university_number || '—'}
            </h3>
            <p>{t('manage.missingForStudent')}</p>
            <ul>
              {(row.missingFieldDetails || row.missingFields || []).map((field) => (
                <li key={field.code || field}>{translateEvaluationFieldLabel(field.labelAr || field.code || field, locale)}</li>
              ))}
            </ul>
          </article>
        ))}
      </AppModal>
      <ConfirmationModal
        open={confirmBulkRating}
        onClose={() => setConfirmBulkRating(false)}
        onConfirm={() => {
          if (bulkApplyMut.isPending) return;
          bulkApplyMut.mutate();
        }}
        title={t('manage.applyBulkEligibleRatings')}
        message={t('manage.bulkRatingConfirmMessage', {
          students: bulkSummary.studentsNeedingBulk ?? bulkSummary.studentsAffected ?? bulkEligibleStudents.length,
          ratings: bulkSummary.ratingsToApply ?? bulkSummary.criteriaAffected ?? 0,
        })}
        confirmLabel={t('manage.bulkRatingConfirmAction')}
        cancelLabel={tCommon('actions.cancel')}
        confirmVariant="primary"
        busy={bulkApplyMut.isPending}
      />
      <ConfirmationModal
        open={confirmGenerate}
        onClose={() => setConfirmGenerate(false)}
        onConfirm={() => {
          if (generateMut.isPending) return;
          setConfirmGenerate(false);
          generateMut.mutate();
        }}
        title={t('manage.generateReady')}
        message={t('manage.generateConfirm')}
        confirmLabel={t('manage.generateReady')}
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
