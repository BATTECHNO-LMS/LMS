import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Pencil,
  Play,
  Send,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import {
  archiveAdminFieldTraining,
  getOpportunitySpecialtyLabel,
  opportunityStatusVariant,
  publishAdminFieldTraining,
  startFieldTraining,
  useOpportunityApplications,
} from '../../../../../features/fieldTraining/index.js';
import { fieldTrainingKeys } from '../../../../../features/fieldTraining/hooks/fieldTrainingQueryKeys.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';

export function ManageHeader({
  opportunityId,
  opp,
  apiScope = 'admin',
  listBase,
  readyCount: readyCountProp = 0,
}) {
  const isInstructor = apiScope === 'instructor';
  const { t, i18n } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [confirmStart, setConfirmStart] = useState(false);
  const [actionError, setActionError] = useState('');

  const { data: appsData } = useOpportunityApplications(
    opportunityId,
    {},
    { enabled: Boolean(opportunityId) && confirmStart, scope: apiScope }
  );

  const readyCount = useMemo(() => {
    const apps = appsData?.applications;
    if (!apps) return readyCountProp;
    return apps.filter(
      (a) =>
        a.status === 'approved' &&
        ['ready_for_training', 'pre_assessment_completed', 'in_training'].includes(a.training_status)
    ).length;
  }, [appsData, readyCountProp]);

  const invalidateOpp = () => {
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminDetail(opportunityId) });
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.instructorDetail(opportunityId) });
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.adminApplications(opportunityId) });
    qc.invalidateQueries({ queryKey: fieldTrainingKeys.all });
  };

  const startMut = useMutation({
    mutationFn: () => startFieldTraining(opportunityId, { asInstructor: isInstructor }),
    onSuccess: () => {
      setConfirmStart(false);
      invalidateOpp();
    },
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  const publishMut = useMutation({
    mutationFn: () => publishAdminFieldTraining(opportunityId),
    onSuccess: invalidateOpp,
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  const archiveMut = useMutation({
    mutationFn: () => archiveAdminFieldTraining(opportunityId),
    onSuccess: invalidateOpp,
    onError: (err) => setActionError(getApiErrorMessage(err)),
  });

  const status = opp?.status;
  const canStart = status === 'published';
  const canPublish = !isInstructor && status === 'draft';
  const canArchive =
    !isInstructor && (status === 'published' || status === 'completed' || status === 'draft');
  const canEdit = !isInstructor && status !== 'archived';
  const busy = startMut.isPending || publishMut.isPending || archiveMut.isPending;

  return (
    <header className="ft-manage-header">
      <div className="ft-manage-header__top">
        <Link to={listBase} className="ft-manage-header__back">
          <ArrowLeft size={18} aria-hidden />
          {t('backToList')}
        </Link>
        {status ? (
          <StatusBadge variant={opportunityStatusVariant(status)}>
            {t(`status.${status}`)}
          </StatusBadge>
        ) : null}
      </div>

      <div className="ft-manage-header__main">
        <div className="ft-manage-header__text">
          <p className="ft-manage-header__eyebrow">{t('manageTraining.title')}</p>
          <h1 className="ft-manage-header__title">{opp?.title || '—'}</h1>
          <div className="ft-manage-header__meta">
            <span>{getOpportunitySpecialtyLabel(opp, i18n.language)}</span>
            {opp?.assigned_instructor?.full_name ? (
              <span className="ft-manage-header__instructor">
                <User size={14} aria-hidden />
                {opp.assigned_instructor.full_name}
              </span>
            ) : null}
          </div>
        </div>

        <div className="ft-manage-header__actions">
          {canStart ? (
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => {
                setActionError('');
                setConfirmStart(true);
              }}
            >
              <Play size={16} aria-hidden />
              {t('manageTraining.startTraining')}
            </Button>
          ) : null}
          {canEdit ? (
            <Button as={Link} to={`${listBase}?edit=${opportunityId}`} variant="outline" disabled={busy}>
              <Pencil size={16} aria-hidden />
              {t('edit')}
            </Button>
          ) : null}
          {canPublish ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setActionError('');
                publishMut.mutate();
              }}
            >
              <Send size={16} aria-hidden />
              {publishMut.isPending ? t('saving') : t('publish')}
            </Button>
          ) : null}
          {canArchive ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setActionError('');
                archiveMut.mutate();
              }}
            >
              <Archive size={16} aria-hidden />
              {archiveMut.isPending ? t('saving') : t('archive')}
            </Button>
          ) : null}
        </div>
      </div>

      {actionError ? <p className="form-field__error ft-manage-header__error">{actionError}</p> : null}

      {confirmStart ? (
        <div className="ft-modal-backdrop" onClick={() => setConfirmStart(false)} role="presentation">
          <div className="ft-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <header className="ft-modal__header">
              <h2 className="ft-modal__title">{t('manageHub.startConfirmTitle')}</h2>
              <p className="ft-modal__subtitle">
                {t('manageHub.startConfirmBody', { count: readyCount })}
              </p>
            </header>
            <footer className="ft-modal__footer">
              <Button type="button" variant="outline" onClick={() => setConfirmStart(false)}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={startMut.isPending}
                onClick={() => startMut.mutate()}
              >
                {startMut.isPending ? t('saving') : t('manageTraining.startTraining')}
              </Button>
            </footer>
          </div>
        </div>
      ) : null}
    </header>
  );
}
