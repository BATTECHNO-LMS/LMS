import { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { CohortCard } from '../../components/student/enrollment/CohortCard.jsx';
import { EmptyState } from '../../components/student/enrollment/EmptyState.jsx';
import { PendingStateBanner } from '../../components/student/enrollment/PendingStateBanner.jsx';
import { useLocale } from '../../features/locale/index.js';
import { useAvailableCohorts } from '../../features/cohorts/index.js';
import { useStudentEnrollments, useRequestEnrollment } from '../../features/enrollments/index.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

export function AvailableCohortsPage() {
  const { t } = useTranslation('enrollments');
  const { locale } = useLocale();
  const isArabic = locale === 'ar';
  const { data: cohortsPayload, isLoading: cohortsLoading, isError: cohortsError, error: cohortsErr } =
    useAvailableCohorts({ staleTime: 30_000 });
  const { data: minePayload, isLoading: mineLoading } = useStudentEnrollments({ staleTime: 30_000 });
  const requestMut = useRequestEnrollment();
  const [requestErr, setRequestErr] = useState('');

  const cohorts = cohortsPayload?.cohorts ?? [];
  const enrollments = minePayload?.enrollments ?? [];

  const enrollmentByCohort = useMemo(() => {
    const m = new Map();
    for (const e of enrollments) {
      if (!m.has(e.cohort_id)) m.set(e.cohort_id, e);
    }
    return m;
  }, [enrollments]);

  const hasPending = useMemo(() => enrollments.some((e) => e.enrollment_status === 'pending'), [enrollments]);

  const cohortStatusLabel = useCallback(
    (status) => {
      if (status === 'open_for_enrollment') return t('studentEnrollment.cohortOpen');
      return t('studentEnrollment.cohortClosed');
    },
    [t]
  );

  const catalogOpenLabel = useCallback(() => t('studentEnrollment.catalogOpen'), [t]);

  async function onRegister(cohortId) {
    setRequestErr('');
    try {
      await requestMut.mutateAsync({ cohort_id: cohortId });
    } catch (e) {
      setRequestErr(getApiErrorMessage(e));
    }
  }

  const loading = cohortsLoading || mineLoading;
  const loadErr = cohortsError ? getApiErrorMessage(cohortsErr) : '';

  return (
    <div className="page page--dashboard page--student">
      <AdminPageHeader title={t('studentEnrollment.availableTitle')} description={t('studentEnrollment.availableSubtitle')} />

      {hasPending ? (
        <PendingStateBanner style={{ marginBottom: '1rem' }}>
          {t('studentEnrollment.pendingReviewBanner')}
        </PendingStateBanner>
      ) : null}

      {requestErr ? <p className="form-error">{requestErr}</p> : null}

      {loading ? <LoadingSpinner /> : null}
      {loadErr ? <p className="form-error">{loadErr}</p> : null}

      {!loading && !loadErr && cohorts.length === 0 ? (
        <EmptyState title={t('studentEnrollment.noCohorts')} description={t('studentEnrollment.noCohortsHint')} />
      ) : null}

      {!loading && !loadErr && cohorts.length > 0 ? (
        <div className="student-cohort-grid">
          {cohorts.map((c) => {
            const en = enrollmentByCohort.get(c.id);
            const spots =
              typeof c.spots_remaining === 'number'
                ? isArabic
                  ? `السعة: ${c.capacity} · المتبقي: ${c.spots_remaining}`
                  : `Capacity: ${c.capacity} · Remaining: ${c.spots_remaining}`
                : isArabic
                  ? `السعة: ${c.capacity}`
                  : `Capacity: ${c.capacity}`;
            return (
              <CohortCard
                key={c.id}
                cohort={c}
                enrollment={en}
                catalogStatusLabel={catalogOpenLabel()}
                cohortStatusLabel={cohortStatusLabel(c.status)}
                pendingLabel={t('studentEnrollment.badgePending')}
                registerLabel={t('studentEnrollment.ctaRegister')}
                waitLabel={t('studentEnrollment.ctaWaiting')}
                rejectedLabel={t('studentEnrollment.badgeRejected')}
                registeredLabel={t('studentEnrollment.badgeRegistered')}
                enterProgramLabel={t('studentEnrollment.enterProgram')}
                rejectedRequestLabel={t('studentEnrollment.ctaRejectedRequest')}
                trackLabel={t('studentEnrollment.track')}
                capacityLine={c.capacity != null ? spots : ''}
                onRegister={() => onRegister(c.id)}
                registerDisabled={requestMut.isPending}
                isArabic={isArabic}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
