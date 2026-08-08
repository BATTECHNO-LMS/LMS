import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button.jsx';
import { FormInput } from '../forms/FormInput.jsx';
import { confirmAttendanceWindow } from '../../features/fieldTraining/fieldTraining.service.js';
import {
  ACTIVE_ATTENDANCE_WINDOW_KEY,
  useActiveAttendanceWindows,
} from '../../features/fieldTraining/hooks/useActiveAttendanceWindows.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

const NOTIFIED_KEY = 'ft_attendance_window_notified';

function loadNotifiedSet() {
  try {
    const raw = sessionStorage.getItem(NOTIFIED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveNotifiedSet(set) {
  try {
    sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function playSoftChime(enabled) {
  if (!enabled) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 180);
  } catch {
    /* browser blocked autoplay */
  }
}

/**
 * Global student popup for open electronic attendance windows.
 * Uses lightweight adaptive polling (no WebSocket in this codebase).
 */
export function StudentAttendanceWindowPopup() {
  const { t } = useTranslation('fieldTraining');
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dismissed, setDismissed] = useState(() => new Set());
  const [soundEnabled] = useState(true);
  const notifiedRef = useRef(loadNotifiedSet());

  const { data, refetch } = useActiveAttendanceWindows();

  const windows = data?.windows ?? [];
  const active = useMemo(
    () => windows.find((w) => !dismissed.has(w.id)) || null,
    [windows, dismissed]
  );

  useEffect(() => {
    if (!active?.id) return;
    if (notifiedRef.current.has(active.id)) return;
    notifiedRef.current.add(active.id);
    saveNotifiedSet(notifiedRef.current);
    playSoftChime(soundEnabled);
  }, [active?.id, soundEnabled]);

  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!active?.expires_at) {
      setRemaining(null);
      return undefined;
    }
    const tick = () => {
      const left = Math.max(
        0,
        Math.floor((new Date(active.expires_at).getTime() - Date.now()) / 1000)
      );
      setRemaining(left);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active?.expires_at, active?.id]);

  const confirmMut = useMutation({
    mutationFn: () => confirmAttendanceWindow({ windowId: active.id, code }),
    onSuccess: (res) => {
      setSuccess(res.message || t('attendance.confirmSuccess'));
      setError('');
      setCode('');
      qc.invalidateQueries({ queryKey: ['fieldTraining'] });
      qc.invalidateQueries({ queryKey: ACTIVE_ATTENDANCE_WINDOW_KEY });
      setTimeout(() => {
        setDismissed((prev) => new Set([...prev, active.id]));
        setSuccess('');
        refetch();
      }, 1500);
    },
    onError: (err) => {
      const codeErr = err?.response?.data?.code;
      if (codeErr === 'ATTENDANCE_CODE_INVALID') {
        setError(t('attendance.codeInvalid'));
      } else if (
        codeErr === 'ATTENDANCE_WINDOW_EXPIRED' ||
        codeErr === 'ATTENDANCE_WINDOW_CLOSED'
      ) {
        setError(t('attendance.windowExpired'));
      } else {
        setError(getApiErrorMessage(err, t('attendance.confirmError')));
      }
    },
  });

  if (!active) return null;

  const expiredLocally = remaining === 0;

  return (
    <div className="ft-modal-backdrop ft-attendance-popup" role="presentation">
      <div
        className="ft-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ft-att-window-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ft-modal__header">
          <h2 id="ft-att-window-title" className="ft-modal__title">
            {active.mode === 'late' ? t('attendance.latePopupTitle') : t('attendance.popupTitle')}
          </h2>
          <p className="ft-modal__subtitle">
            {active.opportunity?.title} · {active.session?.title}
          </p>
        </header>
        <div className="ft-modal__body">
          {success ? (
            <p className="ft-student-task-list__success" role="status">
              {success}
            </p>
          ) : expiredLocally ? (
            <p className="form-field__error" role="alert">
              {t('attendance.windowExpired')}
            </p>
          ) : (
            <>
              <p>{t('attendance.popupHint')}</p>
              <p role="timer">
                {t('attendance.remaining', {
                  seconds: remaining ?? active.remaining_seconds ?? '—',
                })}
              </p>
              <FormInput
                label={t('attendance.codeLabel')}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoComplete="one-time-code"
                disabled={confirmMut.isPending}
              />
              {error ? (
                <p className="form-field__error" role="alert">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </div>
        <footer className="ft-modal__footer">
          {!success && !expiredLocally ? (
            <Button
              type="button"
              variant="primary"
              disabled={confirmMut.isPending || code.trim().length < 4}
              onClick={() => confirmMut.mutate()}
            >
              {confirmMut.isPending ? t('saving') : t('attendance.confirm')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDismissed((prev) => new Set([...prev, active.id]))}
            >
              {t('close')}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
