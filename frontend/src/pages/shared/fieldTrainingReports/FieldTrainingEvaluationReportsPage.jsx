import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { AdminFilterBar } from '../../../components/admin/AdminFilterBar.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { useAuth } from '../../../features/auth/index.js';
import { useTenant } from '../../../features/tenant/index.js';
import { ROLES } from '../../../constants/roles.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import {
  downloadEvaluationReportPdf,
  downloadEvaluationReportsZip,
  fetchEvaluationReports,
  generateEvaluationReports,
} from '../../../features/fieldTrainingEvaluation/fieldTrainingEvaluation.service.js';

const STATUS_VARIANT = { PASSED: 'success', FAILED: 'danger', NOT_ELIGIBLE: 'warning' };

export function FieldTrainingEvaluationReportsPage({ mode = 'admin', apiScope }) {
  const scope = apiScope || (mode === 'reviewer' || mode === 'academic' ? 'academic' : mode);
  const { t, i18n } = useTranslation('fieldTrainingEvaluation');
  const { t: tCommon } = useTranslation('common');
  const { user } = useAuth();
  const { scopeId, isAllTenantsSelected } = useTenant();
  const qc = useQueryClient();
  const universityId =
    user?.role === ROLES.SUPER_ADMIN && !isAllTenantsSelected
      ? scopeId
      : user?.universityId || user?.university_id || scopeId;
  const [filters, setFilters] = useState({ generated: 'all' });
  const [selected, setSelected] = useState(() => new Set());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const params = useMemo(
    () => ({
      university_id: universityId || undefined,
      opportunity_id: filters.opportunity_id || undefined,
      student_name: filters.student_name || undefined,
      university_number: filters.university_number || undefined,
      final_status: filters.final_status || undefined,
      generated: filters.generated === 'all' ? undefined : filters.generated,
      academic_year: filters.academic_year || undefined,
      semester: filters.semester || undefined,
    }),
    [filters, universityId]
  );

  const query = useQuery({
    queryKey: ['ft-eval-reports', scope, params],
    queryFn: () => fetchEvaluationReports(params, scope),
    enabled: Boolean(universityId) || user?.role === ROLES.SUPER_ADMIN,
  });

  const reports = query.data?.reports || [];
  const capabilities = query.data?.capabilities || {};
  const readOnly = mode === 'reviewer' || capabilities.readOnly;

  const zipMut = useMutation({
    mutationFn: (body) => downloadEvaluationReportsZip(body, scope),
    onSuccess: (meta) => {
      setError('');
      setMessage(
        t('page.zipSummary', {
          selected: meta.selected || selected.size,
          included: meta.included || '—',
          missing: meta.missing || '0',
          failed: meta.failed || '0',
        })
      );
    },
    onError: (err) => setError(getApiErrorMessage(err, tCommon('errors.generic'))),
  });

  const generateMut = useMutation({
    mutationFn: (ids) => generateEvaluationReports(ids, {}, scope),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ft-eval-reports'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, tCommon('errors.generic'))),
  });

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const columns = useMemo(
    () => [
      {
        key: 'select',
        label: '',
        render: (row) =>
          row.id ? (
            <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
          ) : null,
      },
      { key: 'studentName', label: t('page.studentName') },
      { key: 'universityNumber', label: t('page.universityNumber') },
      { key: 'universityName', label: t('page.university') },
      { key: 'opportunityTitle', label: t('page.opportunity') },
      {
        key: 'period',
        label: t('page.period'),
        render: (row) =>
          row.trainingStart ? `${new Date(row.trainingStart).toLocaleDateString()} – ${row.trainingEnd ? new Date(row.trainingEnd).toLocaleDateString() : ''}` : '—',
      },
      { key: 'attendance', label: t('page.attendance') },
      { key: 'actualHours', label: t('page.hours') },
      { key: 'professionalTotal', label: t('page.professional') },
      { key: 'finalScore', label: t('page.finalScore') },
      {
        key: 'finalStatus',
        label: t('page.finalStatus'),
        render: (row) =>
          row.finalStatus ? (
            <StatusBadge variant={STATUS_VARIANT[row.finalStatus] || 'neutral'}>
              {t(`status.${row.finalStatus}`, { lng: i18n.language?.startsWith('ar') ? 'ar' : undefined })}
            </StatusBadge>
          ) : (
            '—'
          ),
      },
      { key: 'reportStatus', label: t('page.reportStatus') },
      {
        key: 'generatedAt',
        label: t('page.generatedAt'),
        render: (row) => (row.generatedAt ? new Date(row.generatedAt).toLocaleString() : '—'),
      },
      {
        key: 'actions',
        label: t('page.actions'),
        render: (row) =>
          row.id && row.hasPdf ? (
            <Button type="button" variant="outline" size="sm" onClick={() => downloadEvaluationReportPdf(row.id, scope)}>
              {t('page.downloadPdf')}
            </Button>
          ) : null,
      },
    ],
    [i18n.language, scope, selected, t]
  );

  const missingIds = reports.filter((row) => !row.id && row.applicationId).map((row) => row.applicationId);

  return (
    <div className="page page--admin">
      <AdminPageHeader title={t('page.reportsTitle')} description={t('page.reportsDescription')} />
      {readOnly ? <p className="crud-muted">{t('page.readOnly')}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      <AdminFilterBar>
        <input
          placeholder={t('page.studentName')}
          value={filters.student_name || ''}
          onChange={(e) => setFilters((f) => ({ ...f, student_name: e.target.value }))}
        />
        <input
          placeholder={t('page.universityNumber')}
          value={filters.university_number || ''}
          onChange={(e) => setFilters((f) => ({ ...f, university_number: e.target.value }))}
        />
        <input
          placeholder={t('page.academicYear')}
          value={filters.academic_year || ''}
          onChange={(e) => setFilters((f) => ({ ...f, academic_year: e.target.value }))}
        />
        <select value={filters.final_status || ''} onChange={(e) => setFilters((f) => ({ ...f, final_status: e.target.value }))}>
          <option value="">{t('page.all')}</option>
          <option value="PASSED">{t('status.PASSED')}</option>
          <option value="FAILED">{t('status.FAILED')}</option>
          <option value="NOT_ELIGIBLE">{t('status.NOT_ELIGIBLE')}</option>
        </select>
        <select value={filters.generated || 'all'} onChange={(e) => setFilters((f) => ({ ...f, generated: e.target.value }))}>
          <option value="all">{t('page.all')}</option>
          <option value="yes">{t('page.generated')}</option>
          <option value="no">{t('page.notGenerated')}</option>
        </select>
      </AdminFilterBar>
      <div className="ft-eval-actions">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSelected(new Set(reports.filter((r) => r.id).map((r) => r.id)))}
        >
          {t('page.selectAll')}
        </Button>
        <Button
          type="button"
          onClick={() =>
            zipMut.mutate(
              selected.size
                ? { evaluation_ids: [...selected], university_id: universityId }
                : { select_all_filtered: true, university_id: universityId, ...params }
            )
          }
          disabled={zipMut.isPending}
        >
          {t('page.downloadZip')}
        </Button>
        {!readOnly ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => generateMut.mutate(missingIds)}
            disabled={!missingIds.length || generateMut.isPending}
          >
            {t('page.generateMissing')}
          </Button>
        ) : null}
      </div>
      {query.isLoading ? <LoadingSpinner /> : <DataTable columns={columns} rows={reports} />}
    </div>
  );
}

export function AdminFieldTrainingEvaluationReportsPage() {
  return <FieldTrainingEvaluationReportsPage mode="admin" />;
}

export function ReviewerFieldTrainingEvaluationReportsPage() {
  return <FieldTrainingEvaluationReportsPage mode="reviewer" />;
}

export function AcademicFieldTrainingEvaluationReportsPage() {
  return <FieldTrainingEvaluationReportsPage mode="academic" />;
}
