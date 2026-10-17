import { forwardRef, useId } from 'react';
import { OTP_LENGTH, extractOtpFromPaste, normalizeOtpInput } from '../mfaPolicy.js';

/**
 * Single accessible 6-digit field: numeric keypad on mobile, OS/password-manager one-time-code
 * autofill, paste of "123 456" / "123-456". Calls onComplete once 6 digits are present.
 */
export const OtpCodeInput = forwardRef(function OtpCodeInput(
  { value, onChange, onComplete, label = 'رمز التحقق', hint, error, disabled = false, autoFocus = true, id },
  ref
) {
  const autoId = useId();
  const inputId = id || `otp-${autoId}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  function update(next) {
    onChange(next);
    if (next.length === OTP_LENGTH) onComplete?.(next);
  }

  return (
    <div className={`mfa-otp${error ? ' mfa-otp--error' : ''}`}>
      <label className="mfa-otp__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className="mfa-otp__input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        enterKeyHint="done"
        dir="ltr"
        maxLength={OTP_LENGTH + 2}
        placeholder="••••••"
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined}
        onChange={(e) => update(normalizeOtpInput(e.target.value))}
        onPaste={(e) => {
          const code = extractOtpFromPaste(e.clipboardData?.getData('text'));
          if (code) {
            e.preventDefault();
            update(code);
          }
        }}
      />
      {hint ? (
        <p id={hintId} className="mfa-otp__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mfa-otp__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
