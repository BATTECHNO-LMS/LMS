import { Link, useParams } from 'react-router-dom';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import { useEnrollment } from '../../../features/enrollments/index.js';
import { useTranslation } from 'react-i18next';
import { genericStatusVariant, statusLabelAr } from '../../../utils/statusMap.js';
import { useLocale } from '../../../features/locale/index.js';
import { usePortalPathPrefix } from '../../../utils/portalPathPrefix.js';

export function EnrollmentViewPage() {
  const { id } = useParams();
  const { t } = useTranslation('enrollments');
  const { t: tCommon } = useTranslation('common');
  const { locale } = useLocale();
  const base = usePortalPathPrefix();
  const { data, isLoading, isError } = useEnrollment(id);

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
          {tCommon('actions.backToList')}
        </Link>
      </div>
    );
  }

  const cohortLink = data.cohort_id ? `${base}/cohorts/${data.cohort_id}` : `${base}/cohorts`;

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={<>{t('viewTitle')}</>} description="" />
      <SectionCard
        title={tCommon('actions.details')}
        actions={
          <Link className="btn btn--outline" to={cohortLink}>
            {t('backToCohort')}
          </Link>
        }
      >
        <dl className="crud-dl">
          <div>
            <dt>{t('student')}</dt>
            <dd>{data.student?.full_name ?? '—'}</dd>
          </div>
          <div>
            <dt>{t('enrollmentStatus')}</dt>
            <dd>
              <StatusBadge variant={genericStatusVariant(data.enrollment_status)}>
                {statusLabelAr(data.enrollment_status, locale)}
              </StatusBadge>
            </dd>
          </div>
          <div>
            <dt>{t('finalStatus')}</dt>
            <dd>{statusLabelAr(data.final_status, locale)}</dd>
          </div>
          <div>
            <dt>{t('attendancePct')}</dt>
            <dd>{data.attendance_percentage != null ? `${data.attendance_percentage}%` : '—'}</dd>
          </div>
          <div>
            <dt>{t('recognition')}</dt>
            <dd>{data.recognition_eligibility_status ? statusLabelAr(data.recognition_eligibility_status, locale) : '—'}</dd>
          </div>
        </dl>
      </SectionCard>
    </div>
  );
}
