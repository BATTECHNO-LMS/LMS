import { useState } from 'react';
import { Copy, Download, ShieldAlert, Check } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { MFA_TEXT, recoveryCodesText } from '../mfaPolicy.js';

/**
 * Shows freshly issued recovery codes exactly once (kept only in component state).
 * The parent decides what "continue" does once the user confirms they saved them.
 */
export function RecoveryCodesPanel({ codes, accountLabel, onAcknowledge, continueLabel = 'متابعة', busy = false }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const blob = new Blob([recoveryCodesText(codes, { accountLabel })], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eprojecto-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="mfa-recovery">
      <div className="mfa-recovery__warning" role="note">
        <ShieldAlert size={20} aria-hidden />
        <div>
          <p className="mfa-recovery__warning-title">{MFA_TEXT.saveRecoveryCodes}</p>
          <p>{MFA_TEXT.recoveryCodesOnce}</p>
        </div>
      </div>

      <ol className="mfa-recovery__grid" dir="ltr" aria-label="رموز الاسترداد">
        {codes.map((code) => (
          <li key={code} className="mfa-recovery__code">
            <code>{code}</code>
          </li>
        ))}
      </ol>

      <div className="mfa-recovery__actions">
        <Button type="button" variant="outline" size="sm" onClick={copyAll}>
          {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          <span>{copied ? 'تم النسخ' : 'نسخ الرموز'}</span>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <Download size={16} aria-hidden />
          <span>تنزيل كملف نصي</span>
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? 'تم نسخ رموز الاسترداد' : ''}
      </span>

      <label className="mfa-recovery__ack">
        <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
        <span>حفظت رموز الاسترداد في مكان آمن.</span>
      </label>

      <Button
        type="button"
        variant="primary"
        className="mfa-wide-btn"
        disabled={!acknowledged || busy}
        loading={busy}
        onClick={onAcknowledge}
      >
        {continueLabel}
      </Button>
    </div>
  );
}
