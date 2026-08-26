import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '../../../../../components/admin/SectionCard.jsx';
import { Button } from '../../../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../../../components/common/LoadingSpinner.jsx';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { useOpportunityApplications } from '../../../../../features/fieldTraining/index.js';
import {
  selectTemplateValidation,
  templateValidationGroups,
} from '../../../../../features/fieldTrainingEvaluation/selectTemplateValidation.js';
import {
  assignOpportunityEvaluationTemplate,
  downloadEvaluationTemplate,
  fetchOpportunityEvaluationTemplate,
  generateOpportunityEvaluationReports,
  previewEvaluationApplicationPayload,
  previewEvaluationTemplate,
  saveSupervisorRating,
  uploadEvaluationTemplate,
  useUniversityDefaultEvaluationTemplate,
} from '../../../../../features/fieldTrainingEvaluation/fieldTrainingEvaluation.service.js';

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

export function ManageEvaluationTemplateTab({ opportunityId, apiScope = 'admin' }) {
  const { t } = useTranslation('fieldTrainingEvaluation');
  const { t: tCommon } = useTranslation('common');
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [file, setFile] = useState(null);
  const [lastValidation, setLastValidation] = useState(null);
  const [generating, setGenerating] = useState(false);
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

  const uploadMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', file.name);
      return uploadEvaluationTemplate(fd, apiScope, opportunityId);
    },
    onSuccess: (uploaded) => {
      const nextValidation = uploaded?.validation || uploaded?.template?.validation || null;
      setLastValidation(nextValidation);
      setError(nextValidation && nextValidation.valid === false ? t('page.invalidTemplate') : '');
      qc.invalidateQueries({ queryKey: ['ft-eval-opp-template', apiScope, opportunityId] });
    },
    onError: (err) => {
      const details = err?.response?.data?.details || err?.details;
      setLastValidation(Array.isArray(details?.groups) ? details : null);
      setError(getApiErrorMessage(err, tCommon('errors.generic')));
    },
  });

  if (query.isLoading) return <LoadingSpinner />;
  if (query.isError) {
    return (
      <div className="ft-manage-panel">
        <p role="alert">{getApiErrorMessage(query.error, tCommon('errors.generic'))}</p>
      </div>
    );
  }

  return (
    <div className="ft-manage-panel">
      {error ? <p role="alert">{error}</p> : null}
      {data.missing ? <p className="crud-muted">{t('page.templateMissing')}</p> : null}
      <SectionCard title={t('page.opportunityTemplate')}>
        <dl className="ft-eval-meta">
          <div>
            <dt>{t('page.universityDefault')}</dt>
            <dd>
              {data.universityDefault
                ? `${data.universityDefault.name} v${data.universityDefault.version} (${data.universityDefault.validationStatus})`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>{t('page.currentOpportunity')}</dt>
            <dd>
              {data.opportunityTemplate
                ? `${data.opportunityTemplate.name} v${data.opportunityTemplate.version}`
                : t('page.universityDefault')}
            </dd>
          </div>
          <div>
            <dt>{t('page.version')}</dt>
            <dd>{resolved?.version || '—'}</dd>
          </div>
          <div>
            <dt>{t('page.validation')}</dt>
            <dd>{resolved?.validationStatus || t('page.validationNotRun')}</dd>
          </div>
          <div>
            <dt>{t('page.uploadedAt')}</dt>
            <dd>{resolved?.createdAt ? new Date(resolved.createdAt).toLocaleString() : '—'}</dd>
          </div>
        </dl>
        {validationGroups.length ? (
          <ul>
            {validationGroups.map((group) => (
              <li key={group.id || group.label}>
                {group.label}: {group.found ? t('page.found') : t('page.missing')}
              </li>
            ))}
          </ul>
        ) : (
          <p className="crud-muted">{t('page.validationNotRun')}</p>
        )}
        <div className="ft-eval-actions">
          <input type="file" accept=".docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Button type="button" disabled={!file || uploadMut.isPending} onClick={() => uploadMut.mutate()}>
            {t('page.upload')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLastValidation(null);
              useUniversityDefaultEvaluationTemplate(opportunityId, apiScope).then(() =>
                qc.invalidateQueries({ queryKey: ['ft-eval-opp-template', apiScope, opportunityId] })
              );
            }}
          >
            {t('page.useDefault')}
          </Button>
          {data.universityDefault?.id ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLastValidation(null);
                assignOpportunityEvaluationTemplate(opportunityId, data.universityDefault.id, apiScope).then(() =>
                  qc.invalidateQueries({ queryKey: ['ft-eval-opp-template', apiScope, opportunityId] })
                );
              }}
            >
              {t('page.assignOverride')}
            </Button>
          ) : null}
          {resolved?.id ? (
            <>
              <Button type="button" variant="outline" onClick={() => downloadEvaluationTemplate(resolved.id, apiScope)}>
                {t('page.downloadTemplate')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  const preview = await previewEvaluationTemplate(resolved.id, apiScope);
                  setPreviewHtml(preview.html || '');
                }}
              >
                {t('page.preview')}
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            disabled={uploadMut.isPending || generating}
            onClick={() => {
              setGenerating(true);
              setError('');
              generateOpportunityEvaluationReports(opportunityId, apiScope)
                .then((data) => {
                  const generated = (data?.results || []).filter((row) => row.generated).length;
                  const incomplete = (data?.results || []).filter(
                    (row) => row.code === 'FIELD_TRAINING_EVALUATION_DATA_INCOMPLETE'
                  );
                  const failed = (data?.results || []).filter(
                    (row) => row.generated === false && !row.reused && row.code !== 'FIELD_TRAINING_EVALUATION_DATA_INCOMPLETE'
                  ).length;
                  if (data?.skipped === 'NO_APPROVED_APPLICATIONS') {
                    setError(t('page.noApprovedStudents'));
                    return;
                  }
                  if (data?.skipped === 'ALL_GENERATED') {
                    setError(t('page.allGenerated'));
                    return;
                  }
                  if (incomplete.length) {
                    const fields = [...new Set(incomplete.flatMap((row) => row.missingFields || []))];
                    setError(
                      t('page.dataIncompleteSummary', {
                        count: incomplete.length,
                        fields: fields.join(', '),
                      })
                    );
                    return;
                  }
                  setError(
                    t('page.generateSummary', { generated, failed, selected: (data?.results || []).length })
                  );
                  qc.invalidateQueries({ queryKey: ['ft-eval-opp-template', apiScope, opportunityId] });
                })
                .catch((err) => setError(getApiErrorMessage(err, tCommon('errors.generic'))))
                .finally(() => setGenerating(false));
            }}
          >
            {generating ? t('page.generating') : t('page.generateMissing')}
          </Button>
        </div>
      </SectionCard>
      {previewHtml ? (
        <SectionCard title={t('page.preview')}>
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </SectionCard>
      ) : null}
      <SectionCard title={t('page.studentDataPreview')}>
        <div className="admin-filter-bar">
          <select value={ratingApp} onChange={(e) => setRatingApp(e.target.value)}>
            <option value="">{t('page.studentName')}</option>
            {(appsQuery.data?.applications || [])
              .filter((app) => app.status === 'approved')
              .map((app) => (
                <option key={app.id} value={app.id}>
                  {app.student?.full_name || app.student_name || app.id}
                </option>
              ))}
          </select>
        </div>
        {payloadQuery.isFetching ? <LoadingSpinner /> : null}
        {payloadQuery.data?.payload ? (
          <dl className="ft-eval-payload-preview">
            {PREVIEW_FIELDS.map(([key, labelKey]) => (
              <div key={key}>
                <dt>{t(`page.${labelKey}`)}</dt>
                <dd>{payloadQuery.data.payload[key] === '' || payloadQuery.data.payload[key] == null ? '—' : String(payloadQuery.data.payload[key])}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {payloadQuery.data?.missingFields?.length ? (
          <p role="alert">{t('page.dataIncompleteFields', { fields: payloadQuery.data.missingFields.join(', ') })}</p>
        ) : null}
      </SectionCard>
      <SectionCard title={t('page.supervisorRatings')}>
        <div className="admin-filter-bar">
          {Object.keys(ratings).map((key) => (
            <label key={key}>
              {key}
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
                setError(getApiErrorMessage(err, tCommon('errors.generic')))
              )
            }
          >
            {t('page.saveRating')}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
