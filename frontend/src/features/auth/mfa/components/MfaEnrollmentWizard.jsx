import { useEffect, useRef, useState } from 'react';
import { Smartphone, QrCode, KeyRound, ShieldCheck, Copy, Check } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { FormInput } from '../../../../components/forms/FormInput.jsx';
import { OtpCodeInput } from './OtpCodeInput.jsx';
import { RecoveryCodesPanel } from './RecoveryCodesPanel.jsx';
import { isCompleteOtp, mfaErrorMessage, isTerminalChallengeError } from '../mfaPolicy.js';

const STEPS = [
  { key: 'intro', label: 'التطبيق', Icon: Smartphone },
  { key: 'scan', label: 'المسح', Icon: QrCode },
  { key: 'verify', label: 'التحقق', Icon: KeyRound },
  { key: 'codes', label: 'رموز الاسترداد', Icon: ShieldCheck },
];

/**
 * 4-step TOTP enrollment. Provisioning data (QR / manual key) lives only in component state
 * and is dropped as soon as the first code is verified; it is never persisted client-side.
 *
 * @param {{
 *   startSetup: (password?: string) => Promise<object>,
 *   verifyCode: (code: string) => Promise<{ recoveryCodes: string[] }>,
 *   onFinished: () => Promise<void> | void,
 *   onTerminalError?: (message: string) => void,
 *   requiresPassword?: boolean,
 *   finishLabel?: string,
 *   onCancel?: () => void,
 * }} props
 */
export function MfaEnrollmentWizard({
  startSetup,
  verifyCode,
  onFinished,
  onTerminalError,
  requiresPassword = false,
  finishLabel = 'إنهاء الإعداد',
  onCancel,
}) {
  const [step, setStep] = useState('intro');
  const [setup, setSetup] = useState(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const headingRef = useRef(null);
  const otpRef = useRef(null);
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  useEffect(() => {
    if (step !== 'verify') headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step === 'verify' && !busy) otpRef.current?.focus();
  }, [step, busy]);

  function fail(err) {
    if (isTerminalChallengeError(err) && onTerminalError) {
      onTerminalError(mfaErrorMessage(err));
      return;
    }
    setError(mfaErrorMessage(err));
  }

  async function begin() {
    setError('');
    setBusy(true);
    try {
      const data = await startSetup(requiresPassword ? password : undefined);
      setPassword('');
      setSetup(data);
      setStep('scan');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function verify(value = code) {
    if (!isCompleteOtp(value) || busy) return;
    setError('');
    setBusy(true);
    try {
      const { recoveryCodes: issued } = await verifyCode(value);
      setSetup(null);
      setRecoveryCodes(issued);
      setStep('codes');
    } catch (err) {
      setCode('');
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    try {
      await onFinished();
      setRecoveryCodes(null);
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(setup.manualEntryKey.replace(/\s/g, ''));
      setKeyCopied(true);
      window.setTimeout(() => setKeyCopied(false), 2500);
    } catch {
      setKeyCopied(false);
    }
  }

  return (
    <div className="mfa-wizard">
      <ol className="mfa-stepper" aria-label="خطوات إعداد المصادقة الثنائية">
        {STEPS.map(({ key, label, Icon }, i) => (
          <li
            key={key}
            className={`mfa-stepper__item${i < stepIndex ? ' is-done' : ''}${i === stepIndex ? ' is-current' : ''}`}
            aria-current={i === stepIndex ? 'step' : undefined}
          >
            <span className="mfa-stepper__dot" aria-hidden>
              <Icon size={16} />
            </span>
            <span className="mfa-stepper__label">{label}</span>
          </li>
        ))}
      </ol>

      {step === 'intro' ? (
        <section className="mfa-wizard__panel">
          <h2 ref={headingRef} tabIndex={-1} className="mfa-wizard__title">
            ثبّت تطبيق مصادقة على هاتفك
          </h2>
          <p className="mfa-wizard__text">
            استخدم أي تطبيق يدعم رموز TOTP، مثل Google Authenticator أو Microsoft Authenticator أو 1Password. لا
            نستخدم الرسائل النصية.
          </p>
          {requiresPassword ? (
            <FormInput
              id="mfa-setup-password"
              type="password"
              label="كلمة المرور الحالية"
              autoComplete="current-password"
              passwordToggle
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : null}
          {error ? (
            <p className="mfa-otp__error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mfa-wizard__actions">
            <Button
              type="button"
              variant="primary"
              className="mfa-wide-btn"
              loading={busy}
              disabled={busy || (requiresPassword && !password)}
              onClick={begin}
            >
              لدي تطبيق مصادقة — متابعة
            </Button>
            {onCancel ? (
              <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
                إلغاء
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === 'scan' && setup ? (
        <section className="mfa-wizard__panel">
          <h2 ref={headingRef} tabIndex={-1} className="mfa-wizard__title">
            امسح رمز QR
          </h2>
          <p className="mfa-wizard__text">افتح تطبيق المصادقة واختر إضافة حساب، ثم امسح الرمز.</p>
          <div className="mfa-qr">
            <img
              className="mfa-qr__image"
              src={setup.qrCodeDataUrl}
              alt="رمز QR لإضافة الحساب إلى تطبيق المصادقة"
              width={200}
              height={200}
            />
            <div className="mfa-qr__manual">
              <p className="mfa-qr__manual-label">لا يمكنك المسح؟ أدخل هذا المفتاح يدويًا:</p>
              <code className="mfa-qr__key" dir="ltr">
                {setup.manualEntryKey}
              </code>
              <div className="mfa-qr__manual-actions">
                <Button type="button" variant="outline" size="sm" onClick={copyKey}>
                  {keyCopied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                  <span>{keyCopied ? 'تم النسخ' : 'نسخ المفتاح'}</span>
                </Button>
                <a className="btn btn--ghost btn--sm mfa-qr__open" href={setup.otpauthUri}>
                  فتح في تطبيق المصادقة
                </a>
              </div>
              <p className="mfa-qr__meta" dir="ltr">
                {setup.issuer} · {setup.accountLabel}
              </p>
            </div>
          </div>
          <div className="mfa-wizard__actions">
            <Button type="button" variant="primary" className="mfa-wide-btn" onClick={() => setStep('verify')}>
              أضفت الحساب — متابعة
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'verify' ? (
        <section className="mfa-wizard__panel">
          <h2 ref={headingRef} tabIndex={-1} className="mfa-wizard__title">
            أدخل الرمز الظاهر في التطبيق
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verify();
            }}
          >
            <OtpCodeInput
              ref={otpRef}
              value={code}
              onChange={(v) => {
                setCode(v);
                if (error) setError('');
              }}
              onComplete={(v) => verify(v)}
              hint="الرمز مكوّن من 6 أرقام ويتجدد كل 30 ثانية."
              error={error}
              disabled={busy}
            />
            <div className="mfa-wizard__actions">
              <Button type="submit" variant="primary" className="mfa-wide-btn" loading={busy} disabled={busy || !isCompleteOtp(code)}>
                تحقق وفعّل
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep('scan')} disabled={busy || !setup}>
                الرجوع إلى رمز QR
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      {step === 'codes' && recoveryCodes ? (
        <section className="mfa-wizard__panel">
          <h2 ref={headingRef} tabIndex={-1} className="mfa-wizard__title">
            رموز الاسترداد
          </h2>
          <p className="mfa-wizard__text">
            استخدم أحد هذه الرموز لتسجيل الدخول إذا فقدت الوصول إلى هاتفك. كل رمز يعمل مرة واحدة.
          </p>
          <RecoveryCodesPanel codes={recoveryCodes} onAcknowledge={finish} continueLabel={finishLabel} busy={busy} />
          {error ? (
            <p className="mfa-otp__error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
