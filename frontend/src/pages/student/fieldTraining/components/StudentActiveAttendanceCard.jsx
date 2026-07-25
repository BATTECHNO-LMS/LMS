import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchActiveAttendanceWindows } from '../../../../features/fieldTraining/fieldTraining.service.js';

/**
 * Inline card (not only the global popup) for an open attendance window
 * belonging to this opportunity.
 */
export function StudentActiveAttendanceCard({ opportunityId }) {
  const { t } = useTranslation('fieldTraining');
  const { data } = useQuery({
    queryKey: ['field-training', 'attendance-window', 'active'],
    queryFn: fetchActiveAttendanceWindows,
    refetchInterval: 5000,
    staleTime: 2000,
  });

  const windowRow = useMemo(() => {
    const windows = data?.windows ?? [];
    return windows.find((w) => w.opportunity?.id === opportunityId) || null;
  }, [data?.windows, opportunityId]);

  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!windowRow?.expires_at) {
      setRemaining(null);
      return undefined;
    }
    const tick = () => {
      const left = Math.max(
        0,
        Math.floor((new Date(windowRow.expires_at).getTime() - Date.now()) / 1000)
      );
      setRemaining(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [windowRow?.expires_at, windowRow?.id]);

  if (!windowRow) return null;

  return (
    <div className="ft-attendance-eligibility ft-attendance-eligibility--warn" role="status">
      <strong>
        {windowRow.mode === 'late' ? t('attendance.latePopupTitle') : t('attendance.popupTitle')}
      </strong>
      <p>
        {windowRow.session?.title} ·{' '}
        {t('attendance.remaining', {
          seconds: remaining ?? windowRow.remaining_seconds ?? '—',
        })}
      </p>
      <p>{t('attendance.popupHint')}</p>
    </div>
  );
}
