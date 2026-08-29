import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useAuth } from '../../../features/auth/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { ROLES } from '../../../constants/roles.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import {
  downloadEvaluationTemplate,
  fetchEvaluationPolicy,
  fetchEvaluationTemplates,
  previewEvaluationTemplate,
  saveEvaluationPolicy,
  setDefaultEvaluationTemplate,
  uploadEvaluationTemplate,
} from '../../../features/fieldTrainingEvaluation/fieldTrainingEvaluation.service.js';

function universityIdOf(user, scopeId, isAllTenantsSelected) {
  if (user?.role === ROLES.SUPER_ADMIN && !isAllTenantsSelected) return scopeId || undefined;
  return user?.universityId || user?.university_id || scopeId || undefined;
}

export function FieldTrainingEvaluationTemplatesPage({ apiScope = 'admin' }) {
  const { t } = useTranslation('fieldTrainingEvaluation');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const qc = useQueryClient();
  const universityId = universityIdOf(user, scopeId, isAllTenantsSelected);
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [isDefault, setIsDefault] = useState(true);
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState('');
  const [policy, setPolicy] = useState(null);

  const templatesQuery = useQuery({
    queryKey: ['ft-eval-templates', apiScope, universityId],
    queryFn: () => fetchEvaluationTemplates({ university_id: universityId }, apiScope),
    enabled: Boolean(universityId) || user?.role === ROLES.SUPER_ADMIN,
  });
  const policyQuery = useQuery({
    queryKey: ['ft-eval-policy', apiScope, universityId],
    queryFn: () => fetchEvaluationPolicy({ university_id: universityId }, apiScope),
    enabled: Boolean(universityId),
  });

  const currentPolicy = policy || policyQuery.data?.policy || {};

  const uploadMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name || file.name);
      if (universityId) fd.append('university_id', universityId);
      fd.append('is_default', isDefault ? 'true' : 'false');
      return uploadEvaluationTemplate(fd, apiScope);
    },
    onSuccess: (data) => {
      setError('');
      qc.invalidateQueries({ queryKey: ['ft-eval-templates'] });
      if (data?.validation && !data.validation.valid) setError(t('page.invalidTemplate'));
    },
    onError: (err) => setError(getApiErrorMessage(err, tCommon('errors.generic'))),
  });

  const policyMut = useMutation({
    mutationFn: () =>
      saveEvaluationPolicy(
        {
          university_id: universityId,
          minimum_attendance_percentage: currentPolicy.minimumAttendancePercentage,
          required_training_hours: currentPolicy.requiredTrainingHours,
          required_tasks_required: currentPolicy.requiredTasksRequired,
          post_assessment_required: currentPolicy.postAssessmentRequired,
          professional_evaluation_required: currentPolicy.professionalEvaluationRequired,
          minimum_passing_score: currentPolicy.minimumPassingScore,
          attendance_weight: currentPolicy.attendanceWeight,
          tasks_weight: currentPolicy.tasksWeight,
          post_assessment_weight: currentPolicy.postAssessmentWeight,
          professional_evaluation_weight: currentPolicy.professionalEvaluationWeight,
          attendance_bands: currentPolicy.attendanceBands,
        },
        apiScope
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ft-eval-policy'] }),
    onError: (err) => setError(getApiErrorMessage(err, tCommon('errors.generic'))),
  });

  const rows = templatesQuery.data?.templates || [];
  const activeDefault = rows.find((row) => row.isDefault && row.validationStatus !== 'invalid');
  const columns = useMemo(
    () => [
      { key: 'name', label: t('page.name') },
      { key: 'version', label: t('page.version') },
      {
        key: 'isDefault',
        label: t('page.default'),
        render: (row) => (row.isDefault ? t('page.isDefault') : '—'),
      },
      { key: 'validationStatus', label: t('page.validation') },
      {
        key: 'opportunities',
        label: t('page.usedBy'),
        render: (row) => (row.opportunities || []).length,
      },
      {
        key: 'createdAt',
        label: t('page.createdAt'),
        render: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'),
      },
      {
        key: 'actions',
        label: t('page.actions'),
        render: (row) => (
          <div className="ft-eval-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDefaultEvaluationTemplate(row.id, apiScope).then(() => qc.invalidateQueries({ queryKey: ['ft-eval-templates'] }))}
            >
              {t('page.setDefault')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadEvaluationTemplate(row.id, apiScope)}>
              {t('page.downloadTemplate')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                const data = await previewEvaluationTemplate(row.id, apiScope);
                setPreviewHtml(data.html || '');
              }}
            >
              {t('page.preview')}
            </Button>
          </div>
        ),
      },
    ],
    [apiScope, qc, t]
  );

  if (!universityId && user?.role === ROLES.SUPER_ADMIN) {
    return (
      <div className="page">
        <AdminPageHeader title={t('page.templatesTitle')} description={t('page.selectUniversity')} />
      </div>
    );
  }

  return (
    <div className="page page--admin">
      <AdminPageHeader title={t('page.templatesTitle')} description={t('page.templatesDescription')} />
      {error ? <p className="crud-muted" role="alert">{error}</p> : null}
      <p className="crud-muted" data-testid="ft-eval-active-default">
        {activeDefault
          ? `${t('page.currentDefault')}: ${activeDefault.name} (v${activeDefault.version})`
          : t('page.noDefault')}
      </p>
      <SectionCard title={t('page.upload')}>
        <form
          className="admin-filter-bar"
          onSubmit={(e) => {
            e.preventDefault();
            if (file) uploadMut.mutate();
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('page.name')} />
          <input type="file" accept=".docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <label>
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> {t('page.setDefault')}
          </label>
          <Button type="submit" disabled={!file || uploadMut.isPending}>
            {t('page.upload')}
          </Button>
        </form>
        {uploadMut.data?.validation?.groups ? (
          <ul>
            {uploadMut.data.validation.groups.map((group) => (
              <li key={group.id}>
                {group.label}: {group.found ? t('page.found') : t('page.missing')}
              </li>
            ))}
          </ul>
        ) : null}
      </SectionCard>
      {templatesQuery.isLoading ? <LoadingSpinner /> : <DataTable columns={columns} rows={rows} />}
      {previewHtml ? (
        <SectionCard title={t('page.preview')}>
          <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </SectionCard>
      ) : null}
      <SectionCard title={t('page.policyTitle')}>
        <p className="crud-muted">{t('page.weightsHint')}</p>
        <div className="admin-filter-bar">
          {[
            ['minimumAttendancePercentage', 'Min attendance %'],
            ['minimumPassingScore', 'Min passing score'],
            ['attendanceWeight', 'Attendance weight'],
            ['tasksWeight', 'Tasks weight'],
            ['postAssessmentWeight', 'Post-assessment weight'],
            ['professionalEvaluationWeight', 'Professional weight'],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                value={currentPolicy[key] ?? ''}
                onChange={(e) => setPolicy({ ...currentPolicy, [key]: e.target.value === '' ? '' : Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
        <Button type="button" onClick={() => policyMut.mutate()} disabled={policyMut.isPending}>
          {t('page.savePolicy')}
        </Button>
      </SectionCard>
    </div>
  );
}

export function AdminFieldTrainingEvaluationTemplatesPage() {
  return <FieldTrainingEvaluationTemplatesPage apiScope="admin" />;
}
