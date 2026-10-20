import { useMemo, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { confirmQrAttendance } from '../../features/fieldTraining/fieldTraining.service.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { useAuth } from '../../features/auth/index.js';

/**
 * Student QR attendance confirmation.
 * Identity comes from authenticated session — never from QR payload student ids.
 */
export function StudentQrAttendancePage() {
  const { t } = useTranslation('fieldTraining');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = useMemo(() => params.get('t') || '', [params]);
  const [result, setResult] = useState(null);

  const confirmMut = useMutation({
    mutationFn: () => confirmQrAttendance({ token }),
    onSuccess: (data) => setResult({ ok: true, data }),
    onError: (err) =>
      setResult({
        ok: false,
        message: getApiErrorMessage(
          err,
          t('qrAttendance.studentExpired')
        ),
        code: err?.response?.data?.code || err?.code,
      }),
  });

  if (!user) {
    const next = encodeURIComponent(`/student/field-training/attendance/qr?t=${encodeURIComponent(token)}`);
    return (
      <div className="ft-qr-student">
        <h1>{t('qrAttendance.studentTitle')}</h1>
        <p>{t('qrAttendance.loginRequired')}</p>
        <Link className="ft-btn ft-btn--primary" to={`/login?next=${next}`}>
          {t('qrAttendance.loginCta')}
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="ft-qr-student">
        <h1>{t('qrAttendance.studentTitle')}</h1>
        <p>{t('qrAttendance.missingToken')}</p>
      </div>
    );
  }

  if (result?.ok) {
    const d = result.data;
    return (
      <div className="ft-qr-student ft-qr-student--success">
        <h1>{t('qrAttendance.studentSuccess')}</h1>
        <p>
          {d?.session?.title || '—'} · {d?.status || 'حاضر'}
        </p>
        {d?.confirmed_at ? (
          <p className="ft-qr-student__time">{new Date(d.confirmed_at).toLocaleString()}</p>
        ) : null}
        <button type="button" className="ft-btn" onClick={() => navigate('/student/field-training')}>
          {t('qrAttendance.back')}
        </button>
      </div>
    );
  }

  if (result && !result.ok) {
    return (
      <div className="ft-qr-student ft-qr-student--error">
        <h1>{t('qrAttendance.studentTitle')}</h1>
        <p role="alert">{result.message}</p>
        <button type="button" className="ft-btn ft-btn--primary" onClick={() => setResult(null)}>
          {t('qrAttendance.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="ft-qr-student">
      <h1>{t('qrAttendance.studentTitle')}</h1>
      <p>{t('qrAttendance.studentConfirmHint')}</p>
      <button
        type="button"
        className="ft-btn ft-btn--primary"
        disabled={confirmMut.isPending}
        onClick={() => confirmMut.mutate()}
      >
        {t('qrAttendance.confirmCta')}
      </button>
    </div>
  );
}
