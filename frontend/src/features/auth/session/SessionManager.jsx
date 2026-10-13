import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Clock3 } from 'lucide-react';
import { AppModal } from '../../../components/designSystem/AppModal.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { endCurrentSession, sendActivityPing, sendPresencePing } from './sessionApi.js';
import {
  ACTIVITY_EVENTS,
  ACTIVITY_PING_THROTTLE_MS,
  ACTIVITY_STORAGE_THROTTLE_MS,
  IDLE_CHECK_INTERVAL_MS,
  IDLE_WARNING_MESSAGE_AR,
  LAST_ACTIVITY_PING_STORAGE_KEY,
  LAST_ACTIVITY_STORAGE_KEY,
  PRESENCE_INTERVAL_MS,
  computeIdleState,
  isHumanActivityEvent,
  planActivityPing,
  remainingIdleMs,
} from './sessionPolicy.js';

function readNumber(key) {
  try {
    const n = Number(window.localStorage.getItem(key));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeNumber(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Client half of the 30-minute idle policy. Shares the last human-activity timestamp
 * across tabs via localStorage, so activity in any tab keeps every tab alive and the
 * timeout fires everywhere together. Only the event *type* is observed; no keys,
 * coordinates, or text are read or stored.
 *
 * @param {{ onExpire: (code: string) => void, onLogout: () => Promise<void> | void }} props
 */
export function SessionManager({ onExpire, onLogout }) {
  const location = useLocation();
  const lastActivityRef = useRef(Date.now());
  const lastStoredRef = useRef(0);
  const trailingTimerRef = useRef(null);
  const pingInFlightRef = useRef(false);
  const expiredRef = useRef(false);
  const [warning, setWarning] = useState(false);
  const [remaining, setRemaining] = useState(0);

  const sharedLastActivity = useCallback(
    () => Math.max(lastActivityRef.current, readNumber(LAST_ACTIVITY_STORAGE_KEY)),
    []
  );

  const flushPing = useCallback(async () => {
    if (pingInFlightRef.current || expiredRef.current) return;
    const now = Date.now();
    const plan = planActivityPing({
      now,
      lastPingAt: readNumber(LAST_ACTIVITY_PING_STORAGE_KEY),
      lastActivityAt: sharedLastActivity(),
      throttleMs: ACTIVITY_PING_THROTTLE_MS,
    });
    if (!plan.send) {
      if (plan.delayMs > 0 && !trailingTimerRef.current) {
        trailingTimerRef.current = window.setTimeout(() => {
          trailingTimerRef.current = null;
          flushPing();
        }, plan.delayMs + 50);
      }
      return;
    }
    pingInFlightRef.current = true;
    writeNumber(LAST_ACTIVITY_PING_STORAGE_KEY, now);
    try {
      await sendActivityPing();
    } catch {
      /* 401 session codes are handled by the API client interceptor */
    } finally {
      pingInFlightRef.current = false;
    }
  }, [sharedLastActivity]);

  const markActivity = useCallback(
    ({ force = false } = {}) => {
      if (expiredRef.current) return;
      const now = Date.now();
      lastActivityRef.current = now;
      if (force || now - lastStoredRef.current >= ACTIVITY_STORAGE_THROTTLE_MS) {
        lastStoredRef.current = now;
        writeNumber(LAST_ACTIVITY_STORAGE_KEY, now);
      }
      if (force) writeNumber(LAST_ACTIVITY_PING_STORAGE_KEY, 0);
      flushPing();
    },
    [flushPing]
  );

  const expireForIdle = useCallback(async () => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    setWarning(false);
    try {
      await endCurrentSession('IDLE_TIMEOUT');
    } catch {
      /* already ended server-side (or offline): the server sweeper records the timeout */
    }
    onExpire('SESSION_IDLE_TIMEOUT');
  }, [onExpire]);

  const checkIdle = useCallback(() => {
    if (expiredRef.current) return;
    const now = Date.now();
    const last = sharedLastActivity();
    const state = computeIdleState({ now, lastActivityAt: last });
    if (state === 'expired') {
      expireForIdle();
      return;
    }
    setWarning(state === 'warning');
    setRemaining(remainingIdleMs({ now, lastActivityAt: last }));
  }, [expireForIdle, sharedLastActivity]);

  useEffect(() => {
    markActivity({ force: true });
    const handler = (event) => {
      if (!isHumanActivityEvent(event)) return;
      markActivity();
    };
    const opts = { passive: true, capture: true };
    ACTIVITY_EVENTS.forEach((type) => window.addEventListener(type, handler, opts));
    return () => {
      ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, handler, opts));
      if (trailingTimerRef.current) window.clearTimeout(trailingTimerRef.current);
      trailingTimerRef.current = null;
    };
  }, [markActivity]);

  useEffect(() => {
    markActivity();
  }, [location.pathname, markActivity]);

  useEffect(() => {
    const id = window.setInterval(checkIdle, IDLE_CHECK_INTERVAL_MS);
    function onVisibility() {
      if (document.visibilityState === 'visible') checkIdle();
    }
    function onStorage(event) {
      if (event.key === LAST_ACTIVITY_STORAGE_KEY) checkIdle();
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('storage', onStorage);
    };
  }, [checkIdle]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (expiredRef.current || document.visibilityState !== 'visible') return;
      sendPresencePing().catch(() => {});
    }, PRESENCE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!warning) return undefined;
    const id = window.setInterval(() => {
      setRemaining(remainingIdleMs({ now: Date.now(), lastActivityAt: sharedLastActivity() }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [warning, sharedLastActivity]);

  return (
    <AppModal
      open={warning}
      onClose={() => {
        markActivity({ force: true });
        setWarning(false);
      }}
      size="sm"
      variant="warning"
      icon={<Clock3 size={20} />}
      title="تنبيه انتهاء الجلسة"
      description={IDLE_WARNING_MESSAGE_AR}
      closeOnOverlay={false}
      footer={
        <div className="session-timeout__actions">
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              markActivity({ force: true });
              setWarning(false);
            }}
          >
            البقاء مسجلاً
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              expiredRef.current = true;
              setWarning(false);
              onLogout();
            }}
          >
            تسجيل الخروج
          </Button>
        </div>
      }
    >
      <p className="session-timeout__countdown" role="timer" aria-live="polite">
        الوقت المتبقي: <strong dir="ltr">{formatRemaining(remaining)}</strong>
      </p>
    </AppModal>
  );
}
