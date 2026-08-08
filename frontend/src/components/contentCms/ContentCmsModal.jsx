import { useNavigate } from 'react-router-dom';
import { Button } from '../common/Button.jsx';
import { AppModal } from '../designSystem/index.js';

/**
 * Shared modal shell for managed popups and announcement POPUP channel.
 */
export function ContentCmsModal({
  open,
  title,
  body,
  imageUrl,
  requiresAcknowledgement = false,
  isDismissible = true,
  ctaLabel,
  ctaUrl,
  busy = false,
  onDismiss,
  onAcknowledge,
  onCta,
  onClose,
}) {
  const navigate = useNavigate();

  const canDismiss = isDismissible !== false && !requiresAcknowledgement;

  const handleClose = () => {
    if (!canDismiss || busy) return;
    onDismiss?.() || onClose?.();
  };

  const handleCta = () => {
    onCta?.();
    if (ctaUrl) {
      if (/^https?:\/\//i.test(ctaUrl)) {
        window.open(ctaUrl, '_blank', 'noopener,noreferrer');
      } else {
        navigate(ctaUrl);
      }
    }
  };

  const hasFooter =
    canDismiss || requiresAcknowledgement || Boolean(ctaLabel && ctaUrl);

  const footer = hasFooter ? (
    <>
      {canDismiss ? (
        <Button type="button" variant="ghost" disabled={busy} onClick={() => onDismiss?.()}>
          إغلاق
        </Button>
      ) : null}
      {requiresAcknowledgement ? (
        <Button type="button" variant="primary" disabled={busy} onClick={() => onAcknowledge?.()}>
          تم الاطلاع
        </Button>
      ) : null}
      {ctaLabel && ctaUrl ? (
        <Button
          type="button"
          variant={requiresAcknowledgement ? 'outline' : 'primary'}
          disabled={busy}
          onClick={handleCta}
        >
          {ctaLabel}
        </Button>
      ) : null}
    </>
  ) : null;

  return (
    <AppModal
      open={open}
      onClose={handleClose}
      title={title}
      size="md"
      className="cms-modal"
      dismissible={canDismiss}
      closeOnOverlay={canDismiss}
      footer={footer}
    >
      {imageUrl ? <img className="cms-modal__image" src={imageUrl} alt="" /> : null}
      {body ? (
        <div className="cms-modal__body">
          {String(body)
            .split(/\n+/)
            .filter(Boolean)
            .map((para) => (
              <p key={para.slice(0, 32)}>{para}</p>
            ))}
        </div>
      ) : null}
    </AppModal>
  );
}
