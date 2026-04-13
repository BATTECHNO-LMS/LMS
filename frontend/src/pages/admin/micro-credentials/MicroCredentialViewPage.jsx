import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { useMicroCredential, useUpdateMicroCredentialStatus } from '../../../features/microCredentials/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { LearningOutcomesPanel } from '../../../features/learningOutcomes/components/LearningOutcomesPanel.jsx';
import { useUniversities } from '../../../features/universities/index.js';

export function MicroCredentialViewPage() {
  const { t } = useTranslation('microCredentials');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { id } = useParams();
  const { data: row, isLoading, isError } = useMicroCredential(id);
  const { data: uniPayload } = useUniversities();
  const uniNameById = useMemo(() => {
    const map = {};
    for (const u of uniPayload?.universities ?? []) {
      map[String(u.id)] = String(u.name ?? u.id);
    }
    return map;
  }, [uniPayload]);
  const statusMutation = useUpdateMicroCredentialStatus();
  const [statusMsg, setStatusMsg] = useState('');

  const loCount = row?.learning_outcomes_count ?? 0;
  const descLen = (row?.description ?? '').trim().length;
  const hrs = row?.duration_hours != null ? Number(row.duration_hours) : 0;
  const canRequestReview =
    row && row.status === 'draft' && loCount >= 1 && descLen >= 10 && hrs > 0 && row.delivery_mode;
  const canActivate = row && row.internal_approval_status === 'approved' && row.status !== 'active';

  async function patchStatus(status) {
    if (!id) return;
    setStatusMsg('');
    try {
      await statusMutation.mutateAsync({ id, status });
    } catch (err) {
      setStatusMsg(getApiErrorMessage(err, tCommon('errors.generic')));
    }
  }

  if (isLoading) {
    return (
      <div className="page page--admin crud-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !row) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title={<>{tCommon('errors.generic')}</>} description={<>{t('empty.noRecords')}</>} />
        <Link className="btn btn--primary" to="/admin/micro-credentials">
          {tCommon('actions.backToList')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('view.title')}</>} description={<>{t('description')}</>} />
      <SectionCard
        title={tCommon('actions.details')}
        actions={
          <Link className="btn btn--primary" to={`/admin/micro-credentials/${id}/edit`}>
            <Pencil size={18} aria-hidden /> {tCommon('actions.edit')}
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>{t('table.title')}</dt>
            <dd>{row.title}</dd>
          </div>
          <div>
            <dt>{t('table.code')}</dt>
            <dd>{row.code}</dd>
          </div>
          <div>
            <dt>{t('table.level')}</dt>
            <dd>{row.level}</dd>
          </div>
          <div>
            <dt>{t('table.hours')}</dt>
            <dd>{row.duration_hours}</dd>
          </div>
          <div>
            <dt>{t('fields.deliveryMode')}</dt>
            <dd>{statusLabelAr(row.delivery_mode, locale)}</dd>
          </div>
          <div>
            <dt>{t('table.track')}</dt>
            <dd>{row.track?.name ?? row.track_id}</dd>
          </div>
          <div>
            <dt>{t('fields.description')}</dt>
            <dd>{row.description ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('table.internalApproval')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.internal_approval_status)}>
                {statusLabelAr(row.internal_approval_status, locale)}
              </StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{t('table.status')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status, locale)}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{t('fields.universities')}</dt>
            <dd>
              {(row.linked_university_ids ?? []).length
                ? (row.linked_university_ids ?? []).map((uid) => uniNameById[String(uid)] ?? uid).join(', ')
                : '—'}
            </dd>
          </div>
        </dl>
        {statusMsg ? <p className="auth-form__error">{statusMsg}</p> : null}
        <div className="crud-view-actions">
          <span className="form-field__label" style={{ width: '100%', marginBottom: '0.35rem' }}>
            {t('statusActions.section')}
          </span>
          <button
            type="button"
            className="btn btn--outline"
            disabled={statusMutation.isPending || !canRequestReview}
            onClick={() => patchStatus('under_review')}
          >
            {t('statusActions.requestReview')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={statusMutation.isPending || !canActivate}
            onClick={() => patchStatus('active')}
          >
            {t('statusActions.activate')}
          </button>
          <Link className="btn btn--outline" to="/admin/micro-credentials">
            {tCommon('actions.backToList')}
          </Link>
        </div>
      </SectionCard>
      <div style={{ marginTop: '1.5rem' }}>
        <LearningOutcomesPanel microCredentialId={id} readOnly />
      </div>
    </div>
  );
}
