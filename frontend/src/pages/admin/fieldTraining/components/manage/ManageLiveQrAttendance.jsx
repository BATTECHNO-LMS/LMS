import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import {
  closeAttendanceWindow,
  fetchLiveQrAttendance,
  openAttendanceWindow,
} from '../../../../../features/fieldTraining/fieldTraining.service.js';
import { getApiErrorMessage } from '../../../../../../services/apiHelpers.js';

/**
 * Live QR attendance screen for an open session window.
 * QR payload contains only a short-lived challenge — never a JWT.
 */
export function ManageLiveQrAttendance({ sessionId, sessionTitle, asInstructor = false }) {
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [qrDataUrl, setQrDataUrl] = useState('');

  const live = useQuery({
    queryKey: ['ft-live-qr', sessionId, asInstructor],
    queryFn: () => fetchLiveQrAttendance(sessionId, { asInstructor }),
    enabled: Boolean(sessionId),
    refetchInterval: 7_000,
    staleTime: 3_000,
  });

  const openMut = useMutation({
    mutationFn: () =>
      openAttendanceWindow(sessionId, { duration_seconds: 600, mode: 'normal' }, { asInstructor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ft-live-qr', sessionId] }),
  });

  const closeMut = useMutation({
    mutationFn: () => closeAttendanceWindow(sessionId, { asInstructor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ft-live-qr', sessionId] }),
  });

  const data = live.data;
  const open = data?.open;
  const qrToken = data?.qr?.token;
  const scanPath = data?.qr?.scan_path;

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!qrToken || !scanPath) {
        setQrDataUrl('');
        return;
      }
      const absolute =
        typeof window !== 'undefined'
          ? `${window.location.origin}${scanPath}`
          : scanPath;
      try {
        const url = await QRCode.toDataURL(absolute, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 360,
          color: { dark: '#0b1f33', light: '#f7f3eb' },
        });
        if (!cancelled) setQrDataUrl(url);
      } catch {
        if (!cancelled) setQrDataUrl('');
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [qrToken, scanPath, data?.qr?.rotation_version]);

  if (!sessionId) return null;

  return (
    <section className="ft-qr-live" aria-label={t('qrAttendance.title')}>
      <header className="ft-qr-live__header">
        <div>
          <p className="ft-qr-live__eyebrow">{t('qrAttendance.eyebrow')}</p>
          <h3 className="ft-qr-live__title">{sessionTitle || t('qrAttendance.title')}</h3>
        </div>
        <div className="ft-qr-live__actions">
          {!open ? (
            <button
              type="button"
              className="ft-btn ft-btn--primary"
              onClick={() => openMut.mutate()}
              disabled={openMut.isPending}
            >
              {t('qrAttendance.openWindow')}
            </button>
          ) : (
            <button
              type="button"
              className="ft-btn ft-btn--ghost"
              onClick={() => closeMut.mutate()}
              disabled={closeMut.isPending}
            >
              {t('qrAttendance.closeWindow')}
            </button>
          )}
        </div>
      </header>

      {(openMut.isError || closeMut.isError || live.isError) && (
        <p className="ft-qr-live__error" role="alert">
          {getApiErrorMessage(
            openMut.error || closeMut.error || live.error,
            t('qrAttendance.error')
          )}
        </p>
      )}

      {!open ? (
        <p className="ft-qr-live__empty">{t('qrAttendance.windowClosed')}</p>
      ) : (
        <div className="ft-qr-live__stage">
          <div className="ft-qr-live__qr-wrap">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={t('qrAttendance.qrAlt')} className="ft-qr-live__qr" />
            ) : (
              <div className="ft-qr-live__qr-placeholder">{t('qrAttendance.loadingQr')}</div>
            )}
            <p className="ft-qr-live__countdown">
              {t('qrAttendance.challengeSeconds', {
                seconds: data?.qr?.remaining_seconds ?? '—',
              })}
            </p>
            <p className="ft-qr-live__window">
              {t('qrAttendance.windowSeconds', {
                seconds: data?.window?.remaining_seconds ?? '—',
              })}
            </p>
          </div>
          <aside className="ft-qr-live__stats">
            <div className="ft-qr-live__stat">
              <span>{t('qrAttendance.present')}</span>
              <strong>{data?.stats?.present_count ?? 0}</strong>
            </div>
            <div className="ft-qr-live__stat">
              <span>{t('qrAttendance.remaining')}</span>
              <strong>{data?.stats?.remaining_count ?? 0}</strong>
            </div>
            <h4>{t('qrAttendance.recent')}</h4>
            <ul className="ft-qr-live__recent">
              {(data?.stats?.recently_confirmed || []).length === 0 ? (
                <li>{t('qrAttendance.emptyPresent')}</li>
              ) : (
                (data.stats.recently_confirmed || []).map((s) => (
                  <li key={s.application_id}>
                    <span>{s.student_name}</span>
                    <span>{s.confirmation_source}</span>
                  </li>
                ))
              )}
            </ul>
            <h4>{t('qrAttendance.roster')}</h4>
            <ul className="ft-qr-live__roster">
              {(data?.roster || []).map((s) => (
                <li key={s.application_id}>
                  <span>{s.student_name}</span>
                  <span>{s.status}</span>
                  <span>{s.confirmation_source}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </section>
  );
}
