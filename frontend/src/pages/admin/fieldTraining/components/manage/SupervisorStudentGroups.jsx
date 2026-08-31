import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Search } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '../../../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import { Button } from '../../../../../components/common/Button.jsx';
import { AlertBanner } from '../../../../../components/designSystem/AlertBanner.jsx';
import { LoadingSpinner } from '../../../../../components/common/LoadingSpinner.jsx';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import {
  downloadSupervisorReportsZip,
  fetchSupervisorGroups,
} from '../../../../../features/fieldTrainingEvaluation/fieldTrainingEvaluation.service.js';

const EVAL_LABEL = {
  generated: 'groups.generated',
  missing_file: 'groups.missingFile',
  not_generated: 'groups.notGenerated',
};
const LETTER_LABEL = {
  issued: 'groups.issued',
  pending: 'groups.pending',
  ineligible: 'groups.ineligible',
};

export function SupervisorStudentGroups({ opportunityId, apiScope = 'admin' }) {
  const { t } = useTranslation('fieldTrainingEvaluation');
  const { t: tCommon } = useTranslation('common');
  const [studentQuery, setStudentQuery] = useState('');
  const [supervisorFilter, setSupervisorFilter] = useState('');
  const [evaluationFilter, setEvaluationFilter] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [zipSkipped, setZipSkipped] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const params = useMemo(
    () => ({
      opportunity_id: opportunityId,
      search: studentQuery || undefined,
      evaluation_status: evaluationFilter || undefined,
    }),
    [opportunityId, studentQuery, evaluationFilter]
  );

  const query = useQuery({
    queryKey: ['ft-supervisor-groups', apiScope, params],
    queryFn: () => fetchSupervisorGroups(params, apiScope),
    enabled: Boolean(opportunityId),
  });

  const groups = useMemo(() => {
    const list = query.data?.groups || [];
    if (!supervisorFilter) return list;
    return list.filter((group) => group.supervisor_normalized === supervisorFilter);
  }, [query.data, supervisorFilter]);
  const totals = query.data?.totals || {};

  const zipMut = useMutation({
    mutationFn: (body) => downloadSupervisorReportsZip({ opportunity_id: opportunityId, ...body }, apiScope),
    onSuccess: (meta, body) => {
      const source =
        body?.supervisor_normalized != null
          ? (query.data?.groups || []).filter((g) => g.supervisor_normalized === body.supervisor_normalized)
          : query.data?.groups || [];
      const skipped = source.flatMap((group) =>
        (group.students || [])
          .filter((row) => !row.has_pdf)
          .map((row) => ({
            name: row.student_name,
            reason: row.evaluation_status === 'missing_file' ? 'groups.missingFile' : 'groups.notGenerated',
          }))
      );
      setZipSkipped(skipped);
      setError('');
      setMessage(
        t('groups.zipSummary', {
          included: meta?.included ?? 0,
          missing: meta?.missing ?? skipped.length,
          failed: meta?.failed ?? 0,
          skipped: meta?.skipped ?? skipped.length,
        })
      );
    },
    onError: (err) => {
      setZipSkipped([]);
      setError(getApiErrorMessage(err, tCommon('errors.generic')));
    },
  });

  if (!opportunityId) {
    return <p className="muted">{t('groups.selectOpportunity')}</p>;
  }

  return (
    <SectionCard title={t('groups.title')} className="ft-supervisor-groups-panel">
      {error ? <AlertBanner variant="danger" title={error} onDismiss={() => setError('')} /> : null}
      {message ? <AlertBanner variant="success" title={message} onDismiss={() => { setMessage(''); setZipSkipped([]); }} /> : null}
      {zipSkipped.length ? (
        <AlertBanner variant="warning" title={t('groups.zipSkippedTitle')}>
          {zipSkipped
            .slice(0, 20)
            .map((row) => t('groups.zipSkippedWhy', { name: row.name, reason: t(row.reason) }))
            .join(' · ')}
        </AlertBanner>
      ) : null}
      {totals.unassigned ? <AlertBanner variant="warning" title={t('groups.unassigned')} /> : null}

      <div className="ft-completion-filters admin-filter-bar">
        <label className="ft-completion-search">
          <Search size={16} aria-hidden />
          <input
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            placeholder={t('groups.searchStudent')}
          />
        </label>
        <select value={supervisorFilter} onChange={(e) => setSupervisorFilter(e.target.value)}>
          <option value="">{t('groups.filterSupervisor')}</option>
          {(query.data?.groups || []).map((group) => (
            <option key={group.supervisor_normalized || 'unassigned'} value={group.supervisor_normalized}>
              {group.supervisor_label}
            </option>
          ))}
        </select>
        <select value={evaluationFilter} onChange={(e) => setEvaluationFilter(e.target.value)}>
          <option value="">{t('groups.filterEvaluation')}</option>
          <option value="generated">{t('groups.generated')}</option>
          <option value="not_generated">{t('groups.notGenerated')}</option>
          <option value="missing_file">{t('groups.missingFile')}</option>
        </select>
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(new Set(groups.map((g) => g.supervisor_normalized)))}>
          {t('groups.expandAll')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
          {t('groups.collapseAll')}
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={zipMut.isPending || !groups.length}
          loading={zipMut.isPending}
          onClick={() => zipMut.mutate({})}
        >
          <Download size={16} aria-hidden />
          {zipMut.isPending ? t('groups.zipPreparing') : t('groups.downloadAll')}
        </Button>
      </div>

      <p className="muted">
        {t('groups.studentCount')}: {totals.students || 0} — {t('groups.completedReports')}: {totals.completed_reports || 0} — {t('groups.pendingReports')}: {totals.pending_reports || 0}
      </p>

      {query.isLoading ? <LoadingSpinner /> : (
        <ul className="ft-supervisor-groups">
          {groups.map((group) => {
            const key = group.supervisor_normalized;
            const open = expanded.has(key);
            return (
              <li key={key || group.supervisor_label} className="ft-supervisor-card">
                <div className="ft-supervisor-card__head">
                  <button
                    type="button"
                    className="ft-supervisor-card__toggle"
                    onClick={() => {
                      const next = new Set(expanded);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      setExpanded(next);
                    }}
                  >
                    <span>{group.title || `${group.supervisor_label} — ${group.student_count}`}</span>
                    {group.unassigned ? <StatusBadge variant="warning">{t('groups.unassigned')}</StatusBadge> : null}
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={zipMut.isPending}
                    onClick={() => zipMut.mutate({ supervisor_normalized: key })}
                  >
                    {t('groups.downloadSupervisor')}
                  </Button>
                </div>
                <p className="muted">
                  {t('groups.completedReports')}: {group.completed_reports} — {t('groups.pendingReports')}: {group.pending_reports}
                </p>
                {open ? (
                  <ul className="ft-supervisor-students">
                    {group.students.map((row) => (
                      <li key={row.application_id}>
                        <strong>{row.student_name}</strong>
                        <span>{row.university_number}</span>
                        <span>{row.university_email}</span>
                        <span>{row.specialty}</span>
                        <span>{row.opportunity_title}</span>
                        <span>{t('groups.eligibility')}: {row.eligibility_label}</span>
                        <span>{t('groups.evaluationStatus')}: {t(EVAL_LABEL[row.evaluation_status] || 'groups.notGenerated')}</span>
                        <span>{t('groups.reportStatus')}: {t(EVAL_LABEL[row.report_status] || 'groups.notGenerated')}</span>
                        <span>{t('groups.letterStatus')}: {t(LETTER_LABEL[row.completion_letter_status] || 'groups.pending')}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
