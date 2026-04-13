import { Link, useParams } from 'react-router-dom';
import { ClipboardCheck, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { useSession } from '../../../features/sessions/index.js';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

export function SessionViewPage() {
  const base = usePortalPathPrefix();
  const { t } = useTranslation('sessions');
  const { t: tCommon } = useTranslation('common');
  const { sessionId } = useParams();
  const { locale } = useLocale();
  const { data, isLoading, isError } = useSession(sessionId);

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
        <AdminPageHeader title={tCommon('errors.notFound')} description="" />
        <Link className="btn btn--primary" to={`${base}/cohorts`}>
          {tCommon('actions.back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={data.title} description="" />
      <SectionCard
        title={tCommon('actions.details')}
        actions={
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link className="btn btn--outline" to={`/admin/sessions/${sessionId}/attendance`}>
              <ClipboardCheck size={18} aria-hidden /> {t('attendance')}
            </Link>
            <Link className="btn btn--primary" to={`/admin/sessions/${sessionId}/edit`}>
              <Pencil size={18} aria-hidden /> {t('edit')}
            </Link>
          </div>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>{t('sessionDate')}</dt>
            <dd>{data.session_date}</dd>
          </div>
          <div>
            <dt>{t('startTime')}</dt>
            <dd>{data.start_time}</dd>
          </div>
          <div>
            <dt>{t('endTime')}</dt>
            <dd>{data.end_time}</dd>
          </div>
          <div>
            <dt>{t('sessionType')}</dt>
            <dd>{statusLabelAr(data.session_type, locale)}</dd>
          </div>
          <div>
            <dt>{t('documentation')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(data.documentation_status)}>
                {statusLabelAr(data.documentation_status, locale)}
              </StatusBadge>
            </dd>
          </div>
          {data.notes ? (
            <div>
              <dt>{t('notes')}</dt>
              <dd>{data.notes}</dd>
            </div>
          ) : null}
        </dl>
        <Link className="btn btn--outline" to={`${base}/cohorts/${data.cohort_id}/sessions`}>
          {t('backToCohort')}
        </Link>
      </SectionCard>
    </div>
  );
}
