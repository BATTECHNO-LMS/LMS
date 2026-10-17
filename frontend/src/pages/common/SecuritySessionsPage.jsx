import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  ShieldAlert,
  Monitor,
  Smartphone,
  Tablet,
  LogOut,
  KeyRound,
  RefreshCw,
  MapPin,
  Clock,
} from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader.jsx';
import { StudentPageHeader } from '../../components/student/StudentPageHeader.jsx';
import { SectionCard } from '../../components/admin/SectionCard.jsx';
import { Button } from '../../components/common/Button.jsx';
import { LoadingSpinner } from '../../components/common/LoadingSpinner.jsx';
import { AppModal } from '../../components/designSystem/AppModal.jsx';
import { ConfirmationModal } from '../../components/designSystem/ConfirmationModal.jsx';
import { FormInput } from '../../components/forms/FormInput.jsx';
import { useAuth } from '../../features/auth/index.js';
import { MfaEnrollmentWizard } from '../../features/auth/mfa/components/MfaEnrollmentWizard.jsx';
import { OtpCodeInput } from '../../features/auth/mfa/components/OtpCodeInput.jsx';
import { RecoveryCodesPanel } from '../../features/auth/mfa/components/RecoveryCodesPanel.jsx';
import {
  disableMfa,
  endOtherSessions,
  endOwnSession,
  fetchMfaStatus,
  fetchOwnSessions,
  regenerateRecoveryCodes,
  startSelfEnrollment,
  verifySelfEnrollment,
} from '../../features/auth/mfa/mfaApi.js';
import { isCompleteOtp, mfaErrorMessage, sessionDeviceLabel } from '../../features/auth/mfa/mfaPolicy.js';
import { SESSION_END_REASON_LABELS_AR } from '../../features/auditLogs/auditPresentation.js';
import { formatDate } from '../../utils/locale.js';
import { cn } from '../../utils/helpers.js';

const MFA_KEY = ['auth', 'mfa-status'];
const SESSIONS_KEY = ['auth', 'own-sessions'];

const STATUS_LABELS = { ACTIVE: 'نشطة', ENDED: 'منتهية', EXPIRED: 'منتهية الصلاحية' };
const LOGIN_METHOD_LABELS = {
  PASSWORD: 'كلمة المرور',
  PASSWORD_TOTP: 'كلمة المرور + تطبيق المصادقة',
  PASSWORD_RECOVERY_CODE: 'كلمة المرور + رمز استرداد',
};

function when(value) {
  if (!value) return '—';
  return formatDate(value, 'ar', { dateStyle: 'medium', timeStyle: 'short' });
}

function DeviceIcon({ os }) {
  if (os === 'iPhone' || os === 'Android') return <Smartphone size={20} aria-hidden />;
  if (os === 'iPad') return <Tablet size={20} aria-hidden />;
  return <Monitor size={20} aria-hidden />;
}

/** Password + current TOTP form used for regenerate / disable. */
function CredentialForm({ submitLabel, submitVariant = 'primary', onSubmit, onCancel }) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);

  // AppModal focuses its close button on open; move focus to the first field after it.
  useEffect(() => {
    const t = window.setTimeout(() => formRef.current?.querySelector('input')?.focus(), 30);
    return () => window.clearTimeout(t);
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!password || !isCompleteOtp(code)) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit({ password, code });
    } catch (err) {
      setCode('');
      setError(mfaErrorMessage(err));
      setBusy(false);
    }
  }
  return (
    <form ref={formRef} onSubmit={submit} className="mfa-cred-form">
      <FormInput
        id="mfa-cred-password"
        type="password"
        label="كلمة المرور الحالية"
        autoComplete="current-password"
        passwordToggle
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <OtpCodeInput value={code} onChange={setCode} label="رمز التحقق من التطبيق" autoFocus={false} error={error} disabled={busy} />
      <div className="mfa-wizard__actions">
        <Button type="submit" variant={submitVariant} loading={busy} disabled={busy || !password || !isCompleteOtp(code)}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}

export function SecuritySessionsPage() {
  const location = useLocation();
  const { expireSession } = useAuth();
  const qc = useQueryClient();
  const isStudentPortal = location.pathname.startsWith('/student') || location.pathname.startsWith('/trainee');
  const PageHeader = isStudentPortal ? StudentPageHeader : AdminPageHeader;

  const [modal, setModal] = useState(null);
  const [issuedCodes, setIssuedCodes] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const mfaQuery = useQuery({ queryKey: MFA_KEY, queryFn: fetchMfaStatus });
  const sessionsQuery = useQuery({ queryKey: SESSIONS_KEY, queryFn: fetchOwnSessions, refetchInterval: 60_000 });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: MFA_KEY });
    qc.invalidateQueries({ queryKey: SESSIONS_KEY });
  };

  const endOne = useMutation({
    mutationFn: (id) => endOwnSession(id),
    onSuccess: (data) => {
      setConfirm(null);
      if (data?.endedCurrent) {
        expireSession('USER_LOGOUT');
        return;
      }
      setNotice('تم إنهاء الجلسة.');
      refresh();
    },
    onError: (err) => {
      setConfirm(null);
      setError(mfaErrorMessage(err));
    },
  });

  const endOthers = useMutation({
    mutationFn: endOtherSessions,
    onSuccess: (data) => {
      setConfirm(null);
      setNotice(data?.sessionsEnded ? `تم إنهاء ${data.sessionsEnded} من الجلسات الأخرى.` : 'لا توجد جلسات أخرى نشطة.');
      refresh();
    },
    onError: (err) => {
      setConfirm(null);
      setError(mfaErrorMessage(err));
    },
  });

  function closeModal() {
    setModal(null);
    setIssuedCodes(null);
  }

  const mfa = mfaQuery.data;
  const sessions = sessionsQuery.data?.sessions || [];
  const otherActive = sessions.filter((s) => s.status === 'ACTIVE' && !s.isCurrent).length;
  const lowCodes = mfa?.enabled && mfa.recoveryCodesRemaining <= 2;

  return (
    <div className={cn('page page--dashboard security-page', isStudentPortal ? 'page--student' : 'page--admin')}>
      <PageHeader
        title="الأمان والجلسات"
        description="إدارة المصادقة الثنائية والأجهزة التي سجّلت الدخول إلى حسابك."
      />

      {notice ? (
        <p className="security-page__notice" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <SectionCard title="المصادقة الثنائية (TOTP)" className="security-card">
        {mfaQuery.isLoading ? (
          <LoadingSpinner />
        ) : mfaQuery.isError ? (
          <p className="form-error">{mfaErrorMessage(mfaQuery.error)}</p>
        ) : (
          <div className="mfa-status">
            <div className={cn('mfa-status__badge', mfa.enabled ? 'is-on' : 'is-off')}>
              {mfa.enabled ? <ShieldCheck size={22} aria-hidden /> : <ShieldAlert size={22} aria-hidden />}
              <div>
                <p className="mfa-status__title">{mfa.enabled ? 'المصادقة الثنائية مفعّلة' : 'المصادقة الثنائية غير مفعّلة'}</p>
                <p className="mfa-status__meta">
                  {mfa.enabled ? (
                    <>
                      <span>مفعّلة منذ {when(mfa.enabledAt)}</span>
                      <span>آخر استخدام {when(mfa.lastUsedAt)}</span>
                    </>
                  ) : (
                    'أضف طبقة حماية ثانية عبر تطبيق مصادقة على هاتفك.'
                  )}
                </p>
              </div>
              {mfa.required ? <span className="mfa-status__pill">إلزامية لحسابك</span> : null}
            </div>

            {mfa.enabled ? (
              <p className={cn('mfa-status__codes', lowCodes && 'is-low')}>
                <KeyRound size={16} aria-hidden /> رموز الاسترداد المتبقية: <strong>{mfa.recoveryCodesRemaining}</strong>
                {lowCodes ? ' — يُنصح بإنشاء رموز جديدة.' : ''}
              </p>
            ) : null}

            <div className="mfa-status__actions">
              {!mfa.enabled ? (
                <Button type="button" variant="primary" onClick={() => setModal('enroll')}>
                  <ShieldCheck size={16} aria-hidden /> تفعيل المصادقة الثنائية
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setModal('regenerate')}>
                    <RefreshCw size={16} aria-hidden /> إنشاء رموز استرداد جديدة
                  </Button>
                  {!mfa.required ? (
                    <Button type="button" variant="ghost" onClick={() => setModal('disable')}>
                      إيقاف المصادقة الثنائية
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="الجلسات النشطة والأجهزة"
        className="security-card"
        actions={
          otherActive > 0 ? (
            <Button type="button" variant="danger" size="sm" onClick={() => setConfirm({ type: 'others' })}>
              <LogOut size={16} aria-hidden /> إنهاء جميع الجلسات الأخرى
            </Button>
          ) : null
        }
      >
        {sessionsQuery.isLoading ? (
          <LoadingSpinner />
        ) : sessionsQuery.isError ? (
          <p className="form-error">{mfaErrorMessage(sessionsQuery.error)}</p>
        ) : (
          <ul className="session-list">
            {sessions.map((s) => (
              <li key={s.id} className={cn('session-item', s.isCurrent && 'is-current', s.status !== 'ACTIVE' && 'is-ended')}>
                <span className="session-item__icon">
                  <DeviceIcon os={s.os} />
                </span>
                <div className="session-item__main">
                  <p className="session-item__title">
                    <span dir="auto">{sessionDeviceLabel(s)}</span>
                    {s.isCurrent ? <span className="session-item__badge">الجلسة الحالية</span> : null}
                    <span className={cn('session-item__status', `is-${s.status.toLowerCase()}`)}>{STATUS_LABELS[s.status] || s.status}</span>
                  </p>
                  <p className="session-item__meta">
                    {s.ipApprox ? (
                      <span>
                        <MapPin size={14} aria-hidden /> <span dir="ltr">{s.ipApprox}</span>
                      </span>
                    ) : null}
                    <span>
                      <Clock size={14} aria-hidden /> بدأت {when(s.createdAt)}
                    </span>
                    <span>آخر نشاط {when(s.lastActivityAt)}</span>
                  </p>
                  <p className="session-item__meta">
                    <span>{LOGIN_METHOD_LABELS[s.loginMethod] || 'كلمة المرور'}</span>
                    {s.authenticationLevel === 'MFA' ? <span className="session-item__mfa">تحقق ثنائي</span> : null}
                    {s.status !== 'ACTIVE' && s.endReason ? (
                      <span>
                        {SESSION_END_REASON_LABELS_AR[s.endReason] || 'منتهية'} · {when(s.endedAt)}
                      </span>
                    ) : null}
                  </p>
                </div>
                {s.status === 'ACTIVE' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={s.isCurrent ? 'outline' : 'danger'}
                    className="session-item__action"
                    onClick={() => setConfirm({ type: 'one', session: s })}
                    aria-label={s.isCurrent ? 'إنهاء الجلسة الحالية' : `إنهاء جلسة ${sessionDeviceLabel(s)}`}
                  >
                    {s.isCurrent ? 'إنهاء الجلسة' : 'إنهاء'}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <ConfirmationModal
        open={confirm?.type === 'others'}
        onClose={() => setConfirm(null)}
        onConfirm={() => endOthers.mutate()}
        busy={endOthers.isPending}
        title="إنهاء جميع الجلسات الأخرى"
        message="سيتم تسجيل الخروج من جميع الأجهزة الأخرى فورًا. ستبقى هذه الجلسة نشطة."
        confirmLabel="إنهاء الجلسات الأخرى"
      />
      <ConfirmationModal
        open={confirm?.type === 'one'}
        onClose={() => setConfirm(null)}
        onConfirm={() => endOne.mutate(confirm.session.id)}
        busy={endOne.isPending}
        title={confirm?.session?.isCurrent ? 'إنهاء الجلسة الحالية' : 'إنهاء الجلسة'}
        message={
          confirm?.session?.isCurrent
            ? 'سيتم تسجيل خروجك من هذا الجهاز.'
            : `سيتم تسجيل الخروج من ${confirm?.session ? sessionDeviceLabel(confirm.session) : 'هذا الجهاز'} فورًا.`
        }
        confirmLabel="إنهاء"
      />

      <AppModal
        open={modal === 'enroll'}
        onClose={closeModal}
        title="تفعيل المصادقة الثنائية"
        size="lg"
        closeOnOverlay={false}
      >
        {modal === 'enroll' ? (
          <MfaEnrollmentWizard
            requiresPassword
            startSetup={(password) => startSelfEnrollment(password)}
            verifyCode={(code) => verifySelfEnrollment(code)}
            onFinished={() => {
              closeModal();
              setNotice('تم تفعيل المصادقة الثنائية.');
              refresh();
            }}
            onCancel={closeModal}
          />
        ) : null}
      </AppModal>

      <AppModal
        open={modal === 'regenerate'}
        onClose={closeModal}
        title="إنشاء رموز استرداد جديدة"
        description={issuedCodes ? undefined : 'سيتم إلغاء جميع رموز الاسترداد السابقة فور إنشاء الرموز الجديدة.'}
        size="md"
        closeOnOverlay={false}
        dismissible={!issuedCodes}
      >
        {modal === 'regenerate' && !issuedCodes ? (
          <CredentialForm
            submitLabel="إنشاء رموز جديدة"
            onCancel={closeModal}
            onSubmit={async (creds) => {
              const data = await regenerateRecoveryCodes(creds);
              setIssuedCodes(data.recoveryCodes);
              refresh();
            }}
          />
        ) : null}
        {modal === 'regenerate' && issuedCodes ? (
          <RecoveryCodesPanel codes={issuedCodes} onAcknowledge={closeModal} continueLabel="تم" />
        ) : null}
      </AppModal>

      <AppModal
        open={modal === 'disable'}
        onClose={closeModal}
        title="إيقاف المصادقة الثنائية"
        description="سيصبح تسجيل الدخول بكلمة المرور فقط. يمكنك إعادة التفعيل في أي وقت."
        size="md"
        variant="danger"
        closeOnOverlay={false}
      >
        {modal === 'disable' ? (
          <CredentialForm
            submitLabel="إيقاف المصادقة الثنائية"
            submitVariant="danger"
            onCancel={closeModal}
            onSubmit={async (creds) => {
              await disableMfa(creds);
              closeModal();
              setNotice('تم إيقاف المصادقة الثنائية.');
              refresh();
            }}
          />
        ) : null}
      </AppModal>
    </div>
  );
}
