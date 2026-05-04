import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminPageHeader } from '../../../components/admin/AdminPageHeader.jsx';
import { SectionCard } from '../../../components/admin/SectionCard.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import {
  usePendingEnrollments,
  useApproveEnrollment,
  useRejectEnrollment,
} from '../../../features/enrollments/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { useLocale } from '../../../features/locale/index.js';

export function PendingEnrollmentsPage() {
  const { t } = useTranslation('enrollments');
  const { locale } = useLocale();
  const { data, isLoading, isError, error, refetch } = usePendingEnrollments({ staleTime: 15_000 });
  const approveMut = useApproveEnrollment();
  const rejectMut = useRejectEnrollment();
  const [busyId, setBusyId] = useState('');

  const rows = useMemo(() => {
    const list = data?.enrollments ?? [];
    return list.map((e) => ({
      id: e.id,
      studentName: e.student?.full_name ?? e.student?.email ?? '—',
      cohortTitle: e.cohort?.title ?? '—',
      university: e.cohort?.university?.name ?? '—',
      mcTitle: e.cohort?.micro_credential?.title ?? '—',
      enrolledAt: e.enrolled_at ? new Date(e.enrolled_at).toLocaleString(locale) : '—',
    }));
  }, [data, locale]);

  const loadError = isError ? getApiErrorMessage(error) : '';

  async function onApprove(id) {
    setBusyId(id);
    try {
      await approveMut.mutateAsync(id);
    } finally {
      setBusyId('');
    }
  }

  async function onReject(id) {
    // eslint-disable-next-line no-alert
    const reason = window.prompt(t('pendingList.rejectPrompt'));
    if (reason === null) return;
    setBusyId(id);
    try {
      await rejectMut.mutateAsync({ id, body: { rejection_reason: reason || undefined } });
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader title={t('pendingList.title')} description={t('pendingList.description')} />

      {isLoading ? <LoadingSpinner /> : null}
      {loadError ? (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      ) : null}

      <SectionCard title={t('pendingList.tableTitle')}>
        <DataTable
          emptyTitle={t('pendingList.empty')}
          emptyDescription=""
          columns={[
            { key: 'studentName', label: t('pendingList.student') },
            { key: 'cohortTitle', label: t('pendingList.cohort') },
            { key: 'mcTitle', label: t('pendingList.microCredential') },
            { key: 'university', label: t('pendingList.university') },
            { key: 'enrolledAt', label: t('pendingList.requestedAt') },
            {
              key: 'actions',
              label: t('pendingList.actions'),
              render: (r) => (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={busyId === r.id || approveMut.isPending || rejectMut.isPending}
                    onClick={() => onApprove(r.id)}
                  >
                    {t('pendingList.approve')}
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    disabled={busyId === r.id || approveMut.isPending || rejectMut.isPending}
                    onClick={() => onReject(r.id)}
                  >
                    {t('pendingList.reject')}
                  </button>
                </div>
              ),
            },
          ]}
          rows={rows}
        />
        <p className="crud-muted" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => refetch()}>
            {t('pendingList.refresh')}
          </button>
        </p>
      </SectionCard>
    </div>
  );
}
