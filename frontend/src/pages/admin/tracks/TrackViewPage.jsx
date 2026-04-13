import { Link, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { useTrack } from '../../../features/tracks/index.js';

export function TrackViewPage() {
  const { t } = useTranslation('tracks');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const { id } = useParams();
  const { data: row, isLoading, isError } = useTrack(id);

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
        <Link className="btn btn--primary" to="/admin/tracks">
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
          <Link className="btn btn--primary" to={`/admin/tracks/${id}/edit`}>
            <Pencil size={18} aria-hidden /> {tCommon('actions.edit')}
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>{t('table.name')}</dt>
            <dd>{row.name}</dd>
          </div>
          <div>
            <dt>{t('table.code')}</dt>
            <dd>{row.code}</dd>
          </div>
          <div>
            <dt>{t('fields.description')}</dt>
            <dd>{row.description ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('table.status')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(row.status)}>{statusLabelAr(row.status, locale)}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{t('table.microCount')}</dt>
            <dd>{row.micro_credentials_count ?? 0}</dd>
          </div>
        </dl>
        <div className="crud-view-actions">
          <Link className="btn btn--outline" to="/admin/tracks">
            {tCommon('actions.backToList')}
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
