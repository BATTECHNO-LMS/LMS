import { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldCheck, Clock } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { OtpCodeInput } from './OtpCodeInput.jsx';
import { RecoveryCodeInput } from './RecoveryCodeInput.jsx';
import { MfaEnrollmentWizard } from './MfaEnrollmentWizard.jsx';
import {
  cancelLoginChallenge,
  completeChallengeEnrollment,
  startChallengeEnrollment,
  verifyChallengeEnrollment,
  verifyLoginChallenge,
} from '../mfaApi.js';
import {
  MFA_TEXT,
  formatCountdown,
  isCompleteOtp,
  isCompleteRecoveryCode,
  isTerminalChallengeError,
  mfaErrorCode,
  mfaErrorMessage,
} from '../mfaPolicy.js';

/**
 * Second login step. `mfa` comes from POST /auth/login (no token yet):
 *   { status: 'MFA_REQUIRED' | 'MFA_ENROLLMENT_REQUIRED', challengeToken, expiresIn }
 * The challenge token lives only in memory; on success `onAuthenticated(token)` finishes login.
 */
export function MfaLoginStep({ mfa, onAuthenticated, onRestart }) {
  const enrollment = mfa.status === 'MFA_ENROLLMENT_REQUIRED';
  const [mode, setMode] = useState('totp');
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');
  const [terminal, setTerminal] = useState('');
  const [busy, setBusy] = useState(false);
  const deadline = useRef(Date.now() + Number(mfa.expiresIn || 300) * 1000);
  const [remaining, setRemaining] = useState(Number(mfa.expiresIn || 300));
  const headingRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!enrollment && !terminal && !busy) inputRef.current?.focus();
  }, [enrollment, terminal, busy, mode]);

  useEffect(() => {
    if (terminal) headingRef.current?.focus();
  }, [terminal]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const left = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) setTerminal(MFA_TEXT.challengeExpired);
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  const back = useCallback(() => {
    cancelLoginChallenge(mfa.challengeToken).catch(() => {});
    onRestart();
  }, [mfa.challengeToken, onRestart]);

  async function finishWithToken(data) {
    if (!data?.token) throw new Error('missing token');
    await onAuthenticated(data.token);
  }

  async function submit(value) {
    if (busy || terminal) return;
    const usingRecovery = mode === 'recovery';
    const current = value ?? (usingRecovery ? recoveryCode : code);
    if (usingRecovery ? !isCompleteRecoveryCode(current) : !isCompleteOtp(current)) return;
    setError('');
    setBusy(true);
    try {
      const data = await verifyLoginChallenge({
        challengeToken: mfa.challengeToken,
        ...(usingRecovery ? { recoveryCode: current } : { code: current }),
      });
      await finishWithToken(data);
    } catch (err) {
      setCode('');
      if (isTerminalChallengeError(err)) setTerminal(mfaErrorMessage(err));
      else setError(mfaErrorMessage(err));
      if (mfaErrorCode(err) === 'MFA_TEMPORARILY_LOCKED') setTerminal(mfaErrorMessage(err));
      setBusy(false);
    }
  }

  if (terminal) {
    return (
      <div className="mfa-login">
        <div className="mfa-login__icon mfa-login__icon--warn" aria-hidden>
          <Clock size={26} />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="auth-split__title">
          تعذر إكمال التحقق
        </h1>
        <p className="auth-form__error" role="alert">
          {terminal}
        </p>
        <Button type="button" variant="primary" className="mfa-wide-btn" onClick={onRestart}>
          العودة إلى تسجيل الدخول
        </Button>
      </div>
    );
  }

  if (enrollment) {
    return (
      <div className="mfa-login mfa-login--enroll">
        <header className="auth-split__header">
          <h1 ref={headingRef} tabIndex={-1} className="auth-split__title">
            إعداد المصادقة الثنائية
          </h1>
          <p className="auth-split__subtitle">
            حسابك يتطلب المصادقة الثنائية. أكمل الإعداد للمتابعة — لن تُنشأ جلسة قبل إكماله.
          </p>
          <p className="mfa-login__timer" aria-live="off">
            <Clock size={14} aria-hidden /> صلاحية الطلب: <span dir="ltr">{formatCountdown(remaining)}</span>
          </p>
        </header>
        <MfaEnrollmentWizard
          startSetup={() => startChallengeEnrollment(mfa.challengeToken)}
          verifyCode={(c) => verifyChallengeEnrollment({ challengeToken: mfa.challengeToken, code: c })}
          onFinished={async () => finishWithToken(await completeChallengeEnrollment(mfa.challengeToken))}
          onTerminalError={setTerminal}
          finishLabel="إنهاء الإعداد وتسجيل الدخول"
          onCancel={back}
        />
      </div>
    );
  }

  const usingRecovery = mode === 'recovery';
  return (
    <div className="mfa-login">
      <div className="mfa-login__icon" aria-hidden>
        <ShieldCheck size={26} />
      </div>
      <header className="auth-split__header">
        <h1 ref={headingRef} tabIndex={-1} className="auth-split__title">
          التحقق بخطوتين
        </h1>
        <p className="auth-split__subtitle">
          {usingRecovery
            ? 'أدخل أحد رموز الاسترداد التي حفظتها عند إعداد المصادقة الثنائية.'
            : 'أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة.'}
        </p>
        <p className="mfa-login__timer" aria-live="off">
          <Clock size={14} aria-hidden /> صلاحية الطلب: <span dir="ltr">{formatCountdown(remaining)}</span>
        </p>
      </header>

      <form
        className="auth-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {usingRecovery ? (
          <RecoveryCodeInput
            ref={inputRef}
            value={recoveryCode}
            onChange={(v) => {
              setRecoveryCode(v);
              if (error) setError('');
            }}
            error={error}
            disabled={busy}
          />
        ) : (
          <OtpCodeInput
            ref={inputRef}
            value={code}
            onChange={(v) => {
              setCode(v);
              if (error) setError('');
            }}
            onComplete={(v) => submit(v)}
            error={error}
            disabled={busy}
          />
        )}

        <div className="auth-form__actions">
          <Button
            type="submit"
            variant="primary"
            className="auth-form__submit"
            loading={busy}
            disabled={busy || (usingRecovery ? !isCompleteRecoveryCode(recoveryCode) : !isCompleteOtp(code))}
          >
            تحقق وتسجيل الدخول
          </Button>
        </div>

        <p className="auth-form__sign-up-row">
          <button
            type="button"
            className="mfa-link-btn"
            onClick={() => {
              setMode(usingRecovery ? 'totp' : 'recovery');
              setError('');
            }}
          >
            {usingRecovery ? MFA_TEXT.useAuthenticator : MFA_TEXT.useRecoveryCode}
          </button>
        </p>
        <p className="auth-form__sign-up-row">
          <button type="button" className="mfa-link-btn" onClick={back}>
            العودة إلى تسجيل الدخول
          </button>
        </p>
      </form>
    </div>
  );
}
