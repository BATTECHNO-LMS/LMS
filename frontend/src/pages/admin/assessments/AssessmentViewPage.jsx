import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { FormSelect } from '../../../components/forms/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { useAssessment, useUpdateAssessmentStatus } from '../../../features/assessments/index.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';
import { useState } from 'react';

const STATUSES = ['draft', 'published', 'open', 'closed', 'archived'];

export function AssessmentViewPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('assessments');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { id } = useParams();
  const { data, isLoading, isError } = useAssessment(id);
  const statusMut = useUpdateAssessmentStatus();
  const [nextStatus, setNextStatus] = useState('');
  const [statusErr, setStatusErr] = useState('');

  async function applyStatus() {
    if (!id || !nextStatus) return;
    setStatusErr('');
    try {
      await statusMut.mutateAsync({ id, body: { status: nextStatus } });
      setNextStatus('');
    } catch (e) {
      setStatusErr(getApiErrorMessage(e, tCommon('errors.generic')));
    }
  }

  if (isLoading) {
    return (
      <div className="page page--admin crud-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="page page--admin crud-page">
        <AdminPageHeader title={t('view.notFound')} description="" />
        <Link className="btn btn--primary" to="/admin/assessments">
          {tCommon('actions.backToList')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('view.title')}</>} description={<>{t('view.description')}</>} />
      <SectionCard
        title={tCommon('actions.details')}
        actions={
          <Link className="btn btn--primary" to={`${base}/assessments/${id}/edit`}>
            <Pencil size={18} aria-hidden /> {tCommon('actions.edit')}
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>{t('table.name')}</dt>
            <dd>{data.title}</dd>
          </div>
          <div>
            <dt>{t('table.type')}</dt>
            <dd>{t(`typeLabels.${data.assessment_type}`, { defaultValue: data.assessment_type })}</dd>
          </div>
          <div>
            <dt>{t('table.weight')}</dt>
            <dd>{data.weight}%</dd>
          </div>
          <div>
            <dt>{t('table.cohort')}</dt>
            <dd>{data.cohort?.title ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('table.dueDate')}</dt>
            <dd>{data.due_date ? String(data.due_date).slice(0, 10) : '—'}</dd>
          </div>
          <div>
            <dt>{tCommon('status.label')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(data.status)}>{statusLabelAr(data.status, locale)}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{t('view.counts')}</dt>
            <dd>
              {t('view.submissions')}: {data.submissions_count ?? 0} · {t('view.grades')}: {data.grades_count ?? 0}
            </dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to={`${base}/assessments`}>
            {tCommon('actions.backToList')}
          </Link>
        </div>
      </SectionCard>

      <SectionCard title={tCommon('actions.update')}>
        {statusErr ? <p className="form-error">{statusErr}</p> : null}
        <div className="crud-form-grid" style={{ maxWidth: 480 }}>
          <FormSelect id="next-status" label={tCommon('status.label')} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
            <option value="">{tCommon('status.allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabelAr(s, locale)}
              </option>
            ))}
          </FormSelect>
          <div style={{ alignSelf: 'end' }}>
            <button type="button" className="btn btn--primary" disabled={!nextStatus || statusMut.isPending} onClick={applyStatus}>
              {tCommon('actions.update')}
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
