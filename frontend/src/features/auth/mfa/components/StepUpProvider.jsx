import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { AppModal } from '../../../../components/designSystem/AppModal.jsx';
import { Button } from '../../../../components/common/Button.jsx';
import { OtpCodeInput } from './OtpCodeInput.jsx';
import { stepUp } from '../mfaApi.js';
import { setStepUpHandler } from '../../../../services/stepUpBridge.js';
import { isCompleteOtp, mfaErrorCode, mfaErrorMessage } from '../mfaPolicy.js';

/**
 * Mounted once for signed-in users. When the API answers 403 STEP_UP_REQUIRED, the client
 * waits on this modal; after a successful TOTP check the original request is retried once.
 * No new token is issued — the server marks the current session as freshly verified.
 */
export function StepUpProvider({ securityPath }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notEnrolled, setNotEnrolled] = useState(false);
  const [maxAgeMinutes, setMaxAgeMinutes] = useState(null);
  const resolver = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open || busy) return undefined;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, busy]);

  const settle = useCallback((ok) => {
    const resolve = resolver.current;
    resolver.current = null;
    setOpen(false);
    setCode('');
    setError('');
    setBusy(false);
    setNotEnrolled(false);
    resolve?.(ok);
  }, []);

  useEffect(() => {
    setStepUpHandler(
      (details) =>
        new Promise((resolve) => {
          resolver.current = resolve;
          setMaxAgeMinutes(Number(details?.maxAgeMinutes) || null);
          setOpen(true);
        })
    );
    return () => {
      setStepUpHandler(null);
      resolver.current?.(false);
      resolver.current = null;
    };
  }, []);

  async function verify(value = code) {
    if (!isCompleteOtp(value) || busy) return;
    setBusy(true);
    setError('');
    try {
      await stepUp(value);
      settle(true);
    } catch (err) {
      setBusy(false);
      setCode('');
      if (mfaErrorCode(err) === 'MFA_NOT_ENABLED') setNotEnrolled(true);
      setError(mfaErrorMessage(err));
    }
  }

  return (
    <AppModal
      open={open}
      onClose={() => settle(false)}
      dismissible={!busy}
      closeOnOverlay={false}
      size="sm"
      variant="warning"
      icon={<ShieldCheck size={20} aria-hidden />}
      title="تأكيد الهوية"
      description={
        maxAgeMinutes
          ? `هذا إجراء حساس. أدخل رمز تطبيق المصادقة للمتابعة (صالح لمدة ${maxAgeMinutes} دقائق).`
          : 'هذا إجراء حساس. أدخل رمز تطبيق المصادقة للمتابعة.'
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => settle(false)} disabled={busy}>
            إلغاء
          </Button>
          <Button type="submit" form="mfa-step-up-form" variant="primary" loading={busy} disabled={busy || !isCompleteOtp(code)}>
            تأكيد
          </Button>
        </>
      }
    >
      <form
        id="mfa-step-up-form"
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
      >
        <OtpCodeInput
          ref={inputRef}
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError('');
          }}
          onComplete={(v) => verify(v)}
          error={error}
          disabled={busy}
        />
        {notEnrolled && securityPath ? (
          <p className="mfa-otp__hint">
            <Link to={securityPath} onClick={() => settle(false)}>
              الانتقال إلى صفحة الأمان والجلسات لتفعيل المصادقة الثنائية
            </Link>
          </p>
        ) : null}
      </form>
    </AppModal>
  );
}
