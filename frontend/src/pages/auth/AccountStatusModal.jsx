import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, TriangleAlert } from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';
import { AppModal } from '../../components/designSystem/index.js';
import { fetchSystemPopupByKey } from '../../features/popups/index.js';

const ICON_BY_VARIANT = {
  success: CheckCircle2,
  pending: Clock3,
  warning: TriangleAlert,
  error: AlertCircle,
};

export function AccountStatusModal({
  open,
  title,
  message,
  note = '',
  variant = 'pending',
  systemKey = null,
  onClose,
  actions = [],
}) {
  const Icon = ICON_BY_VARIANT[variant] || AlertCircle;
  const [apiCopy, setApiCopy] = useState(null);

  const enabledActions = useMemo(() => actions.filter((a) => a && !a.hidden), [actions]);

  useEffect(() => {
    if (!open || !systemKey) {
      setApiCopy(null);
      return undefined;
    }
    let cancelled = false;
    fetchSystemPopupByKey(systemKey)
      .then((popup) => {
        if (cancelled || !popup) return;
        setApiCopy({
          title: popup.title_ar || null,
          message: popup.body_ar || null,
        });
      })
      .catch(() => {
        if (!cancelled) setApiCopy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, systemKey]);

  const displayTitle = apiCopy?.title || title;
  const displayMessage = apiCopy?.message || message;

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={displayTitle}
      description={displayMessage}
      size="sm"
      variant={variant}
      icon={<Icon size={20} aria-hidden />}
      className="app-modal--status"
      footer={
        enabledActions.length ? (
          <>
            {enabledActions.map((action) => (
              <Button
                key={action.key}
                type="button"
                variant={action.variant || 'outline'}
                onClick={action.onClick}
                disabled={Boolean(action.disabled)}
              >
                {action.label}
              </Button>
            ))}
          </>
        ) : null
      }
    >
      {note ? <p className="app-modal__note">{note}</p> : null}
    </AppModal>
  );
}
