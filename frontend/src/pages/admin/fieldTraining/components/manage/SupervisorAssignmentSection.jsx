import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '../../../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import { Button } from '../../../../../components/common/Button.jsx';
import { AlertBanner } from '../../../../../components/designSystem/AlertBanner.jsx';
import { ConfirmationModal } from '../../../../../components/designSystem/ConfirmationModal.jsx';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import {
  applySupervisorAssignments,
  downloadSupervisorAssignmentTemplate,
  fetchAcademicSupervisors,
  previewSupervisorAssignments,
  resolveSupervisorAssignments,
} from '../../../../../features/fieldTrainingEvaluation/fieldTrainingEvaluation.service.js';
import { ExcelAssignmentDropzone } from '../../../../../features/fieldTrainingEvaluation/components/ExcelAssignmentDropzone.jsx';

export function SupervisorAssignmentSection({ opportunityId, apiScope = 'admin' }) {
  const { t } = useTranslation('fieldTrainingEvaluation');
  const { t: tCommon } = useTranslation('common');
  const qc = useQueryClient();
  const canManage = apiScope === 'admin';
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [preview, setPreview] = useState(null);
  const [alert, setAlert] = useState(null);
  const [supervisorQuery, setSupervisorQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [supervisorFilter, setSupervisorFilter] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());
  const [confirmApply, setConfirmApply] = useState(false);

  const supervisorsQuery = useQuery({
    queryKey: ['ft-academic-supervisors', opportunityId],
    queryFn: () => fetchAcademicSupervisors(opportunityId, apiScope),
    enabled: Boolean(opportunityId) && canManage,
  });
  const supervisorOptions = supervisorsQuery.data?.supervisors || [];

  const previewMut = useMutation({
    mutationFn: () => previewSupervisorAssignments(opportunityId, file, apiScope),
    onSuccess: (data) => {
      setPreview(data);
      setExpanded(new Set((data.groups || []).map((g) => g.supervisor_normalized)));
      setAlert({
        variant: data.can_apply ? 'success' : 'warning',
        title: t('assignment.previewReady', { count: data.totals?.excel_rows || 0 }),
      });
    },
    onError: (err) => setAlert({ variant: 'danger', title: getApiErrorMessage(err) }),
  });

  const resolveMut = useMutation({
    mutationFn: ({ normalized, supervisorId }) =>
      resolveSupervisorAssignments(
        opportunityId,
        { batch_id: preview.batch_id, resolutions: { [normalized]: supervisorId } },
        apiScope
      ),
    onSuccess: (data) => setPreview(data),
    onError: (err) => setAlert({ variant: 'danger', title: getApiErrorMessage(err) }),
  });

  const applyMut = useMutation({
    mutationFn: () =>
      applySupervisorAssignments(
        opportunityId,
        {
          batch_id: preview.batch_id,
          confirm_reassignments: true,
          preview,
        },
        apiScope
      ),
    onSuccess: (data) => {
      setConfirmApply(false);
      setAlert({
        variant: 'success',
        title: t('assignment.applySuccess', {
          created: data.created,
          updated: data.updated,
        }),
      });
      qc.invalidateQueries({ queryKey: ['ft-eval-opp-template', apiScope, opportunityId] });
    },
    onError: (err) => setAlert({ variant: 'danger', title: getApiErrorMessage(err) }),
  });

  const groups = useMemo(() => {
    const list = preview?.groups || [];
    return list.filter((group) => {
      if (supervisorFilter && group.supervisor_normalized !== supervisorFilter) return false;
      if (supervisorQuery && !String(group.supervisor_label || '').includes(supervisorQuery.trim())) return false;
      return true;
    });
  }, [preview, supervisorFilter, supervisorQuery]);

  function visibleStudents(group) {
    return (group.students || []).filter((row) => {
      if (statusFilter === 'valid' && row.status !== 'valid') return false;
      if (statusFilter === 'error' && row.status !== 'error') return false;
      if (studentQuery) {
        const q = studentQuery.trim().toLowerCase();
        const hay = [row.student_name, row.university_number, row.university_email].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  if (!canManage) return null;

  return (
    <SectionCard title={t('assignment.title')} className="ft-supervisor-assign">
      <p className="ft-manage-panel__desc">{t('assignment.desc')}</p>
      {alert ? <AlertBanner variant={alert.variant} title={alert.title} onDismiss={() => setAlert(null)} /> : null}

      <div className="ft-eval-actions ft-eval-actions--primary">
        <Button type="button" variant="outline" onClick={() => downloadSupervisorAssignmentTemplate(opportunityId, apiScope)}>
          <Download size={16} aria-hidden />
          {t('assignment.downloadTemplate')}
        </Button>
      </div>

      <ExcelAssignmentDropzone
        file={file}
        error={fileError}
        onFile={(next, err) => {
          setFile(next);
          setFileError(err);
        }}
      />

      <div className="ft-eval-actions">
        <Button
          type="button"
          variant="outline"
          disabled={!file || previewMut.isPending}
          loading={previewMut.isPending}
          onClick={() => previewMut.mutate()}
        >
          {t('assignment.preview')}
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={!preview?.can_apply || applyMut.isPending}
          onClick={() => setConfirmApply(true)}
        >
          {t('assignment.apply')}
        </Button>
      </div>

      {preview ? (
        <>
          <dl className="ft-eval-payload-preview">
            <div>
              <dt>{t('assignment.totalRows')}</dt>
              <dd>{preview.totals.excel_rows}</dd>
            </div>
            <div>
              <dt>{t('assignment.validStudents')}</dt>
              <dd>{preview.totals.valid_students}</dd>
            </div>
            <div>
              <dt>{t('assignment.invalidStudents')}</dt>
              <dd>{preview.totals.invalid_students}</dd>
            </div>
            <div>
              <dt>{t('assignment.duplicates')}</dt>
              <dd>{preview.totals.duplicate_rows}</dd>
            </div>
            <div>
              <dt>{t('assignment.conflicts')}</dt>
              <dd>{preview.totals.conflicting_assignments}</dd>
            </div>
            <div>
              <dt>{t('assignment.distinctSupervisors')}</dt>
              <dd>{preview.totals.distinct_supervisors}</dd>
            </div>
            <div>
              <dt>{t('assignment.linkedSupervisors')}</dt>
              <dd>{preview.totals.linked_supervisors}</dd>
            </div>
            <div>
              <dt>{t('assignment.unresolvedSupervisors')}</dt>
              <dd>{preview.totals.unresolved_supervisors}</dd>
            </div>
          </dl>

          <div className="ft-completion-filters admin-filter-bar">
            <label className="ft-completion-search">
              <Search size={16} aria-hidden />
              <input value={supervisorQuery} onChange={(e) => setSupervisorQuery(e.target.value)} placeholder={t('assignment.searchSupervisor')} />
            </label>
            <label className="ft-completion-search">
              <Search size={16} aria-hidden />
              <input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder={t('assignment.searchStudent')} />
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{t('assignment.filterAll')}</option>
              <option value="valid">{t('assignment.filterValid')}</option>
              <option value="error">{t('assignment.filterErrors')}</option>
            </select>
            <select value={supervisorFilter} onChange={(e) => setSupervisorFilter(e.target.value)}>
              <option value="">{t('assignment.filterSupervisor')}</option>
              {(preview.groups || []).map((group) => (
                <option key={group.supervisor_normalized} value={group.supervisor_normalized}>
                  {group.supervisor_label}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(new Set(groups.map((g) => g.supervisor_normalized)))}>
              {t('assignment.expandAll')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
              {t('assignment.collapseAll')}
            </Button>
          </div>

          <ul className="ft-supervisor-groups">
            {groups.map((group) => {
              const open = expanded.has(group.supervisor_normalized);
              const students = visibleStudents(group);
              return (
                <li key={group.supervisor_normalized || group.supervisor_label} className="ft-supervisor-card">
                  <button
                    type="button"
                    className="ft-supervisor-card__head"
                    onClick={() => {
                      const next = new Set(expanded);
                      if (next.has(group.supervisor_normalized)) next.delete(group.supervisor_normalized);
                      else next.add(group.supervisor_normalized);
                      setExpanded(next);
                    }}
                  >
                    <span>
                      {group.supervisor_label} — {group.student_count}
                    </span>
                    <StatusBadge variant={group.resolution_status === 'linked' ? 'success' : 'default'}>
                      {group.resolution_label}
                    </StatusBadge>
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {open ? (
                    <div className="ft-supervisor-card__body">
                      {group.resolution_status !== 'linked' ? (
                        <label className="ft-supervisor-resolve">
                          {t('assignment.selectAccount')}
                          <select
                            value={group.account?.id || ''}
                            onChange={(e) => {
                              if (e.target.value) {
                                resolveMut.mutate({
                                  normalized: group.supervisor_normalized,
                                  supervisorId: e.target.value,
                                });
                              }
                            }}
                          >
                            <option value="">{t('assignment.selectAccount')}</option>
                            {supervisorOptions.map((row) => (
                              <option key={row.id} value={row.id}>
                                {row.full_name} ({row.email})
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p className="muted">
                          {group.account?.full_name} — {group.account?.email}
                        </p>
                      )}
                      <ul className="ft-supervisor-students">
                        {students.map((row) => (
                          <li key={`${row.excel_row}-${row.university_number}`}>
                            <strong>{row.student_name}</strong>
                            <span>{row.university_number}</span>
                            <span>{row.university_email}</span>
                            <span>{row.specialty}</span>
                            <span>{row.opportunity}</span>
                            <span>
                              {t('assignment.current')}: {row.current_supervisor_name || '—'}
                            </span>
                            <span>
                              {t('assignment.proposed')}: {row.proposed_supervisor_name || '—'}
                            </span>
                            {row.reassignment ? <StatusBadge variant="warning">{t('assignment.reassignment')}</StatusBadge> : null}
                            <StatusBadge variant={row.status === 'valid' ? 'success' : 'danger'}>
                              {row.status === 'valid' ? t('assignment.filterValid') : row.errors?.[0]?.label || t('assignment.filterErrors')}
                            </StatusBadge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <ConfirmationModal
        open={confirmApply}
        onClose={() => setConfirmApply(false)}
        onConfirm={() => applyMut.mutate()}
        title={t('assignment.apply')}
        message={
          preview?.reassignment_count
            ? t('assignment.reassignmentConfirm', { count: preview.reassignment_count })
            : t('assignment.applyConfirm')
        }
        confirmLabel={t('assignment.apply')}
        cancelLabel={tCommon('actions.cancel')}
        confirmVariant="primary"
        busy={applyMut.isPending}
      />
    </SectionCard>
  );
}
