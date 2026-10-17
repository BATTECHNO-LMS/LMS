import { forwardRef, useId } from 'react';
import { formatRecoveryCodeInput } from '../mfaPolicy.js';

export const RecoveryCodeInput = forwardRef(function RecoveryCodeInput(
  { value, onChange, error, disabled = false, autoFocus = true },
  ref
) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={`mfa-otp${error ? ' mfa-otp--error' : ''}`}>
      <label className="mfa-otp__label" htmlFor={id}>
        رمز الاسترداد
      </label>
      <input
        ref={ref}
        id={id}
        className="mfa-otp__input mfa-otp__input--recovery"
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        dir="ltr"
        placeholder="XXXX-XXXX-XXXX"
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(formatRecoveryCodeInput(e.target.value))}
      />
      <p className="mfa-otp__hint">كل رمز استرداد يعمل مرة واحدة فقط.</p>
      {error ? (
        <p id={errorId} className="mfa-otp__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
