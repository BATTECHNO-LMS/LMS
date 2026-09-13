import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getStorageItem, storageKeys } from '../../../../utils/storage.js';
import {
  recordedLectureHeartbeatUrl,
  sendStudentRecordedLectureHeartbeat,
  sendStudentRecordedLecturePlayerEvent,
  startStudentRecordedLectureWatchSession,
} from '../../../../features/fieldTraining/fieldTraining.service.js';
import {
  patchRecordedLectureProgressCache,
  removeStudentLectureFromCache,
} from '../../../../features/fieldTraining/recordedLectureStudentUx.js';
import { apiClient } from '../../../../services/apiClient.js';
import {
  MAX_HEARTBEAT_RETRIES,
  createWatchTracker,
} from '../../../../features/fieldTraining/recordedLectureWatchTracker.js';

function authHeaders() {
  const token = getStorageItem(storageKeys.authToken);
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token && typeof token === 'string') headers.Authorization = `Bearer ${token}`;
  return headers;
}

function resolveUrl(path) {
  const base = apiClient.defaults.baseURL || '';
  if (!base) return path;
  return `${String(base).replace(/\/$/, '')}${path}`;
}

export function useRecordedLectureWatchTracking({ opportunityId, lectureId, enabled = true }) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(null);
  const [saveWarning, setSaveWarning] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [playerEnded, setPlayerEnded] = useState(false);
  const [playerUnavailable, setPlayerUnavailable] = useState(false);
  const sessionIdRef = useRef(null);
  const failuresRef = useRef(0);
  const pendingRef = useRef(null);
  const trackerRef = useRef(null);

  const applyProgress = useCallback(
    (next) => {
      if (!next) return;
      setProgress(next);
      patchRecordedLectureProgressCache(queryClient, opportunityId, lectureId, next);
    },
    [lectureId, opportunityId, queryClient]
  );

  const persist = useCallback(
    async (payload, { beacon = false, event = false } = {}) => {
      if (!enabled || !opportunityId || !lectureId || !payload?.watchSessionId) return null;
      pendingRef.current = payload;
      try {
        if (beacon && typeof navigator !== 'undefined' && typeof fetch === 'function') {
          await fetch(resolveUrl(recordedLectureHeartbeatUrl(opportunityId, lectureId)), {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: authHeaders(),
            keepalive: true,
            credentials: 'include',
          });
          pendingRef.current = null;
          failuresRef.current = 0;
          setSaveWarning(false);
          return payload;
        }
        const data = event
          ? await sendStudentRecordedLecturePlayerEvent(opportunityId, lectureId, payload)
          : await sendStudentRecordedLectureHeartbeat(opportunityId, lectureId, payload);
        pendingRef.current = null;
        failuresRef.current = 0;
        setSaveWarning(false);
        if (data?.progress) applyProgress(data.progress);
        return data;
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) {
          setAccessError('unavailable');
          removeStudentLectureFromCache(queryClient, opportunityId, lectureId);
        } else if (status === 401 || status === 403) setAccessError('auth');
        failuresRef.current += 1;
        if (failuresRef.current >= MAX_HEARTBEAT_RETRIES) setSaveWarning(true);
        return null;
      }
    },
    [applyProgress, enabled, lectureId, opportunityId, queryClient]
  );

  useEffect(() => {
    if (!enabled || !opportunityId || !lectureId) return undefined;
    let cancelled = false;
    setPlayerEnded(false);
    setPlayerUnavailable(false);
    setAccessError('');
    trackerRef.current = createWatchTracker({
      onFlush: (payload) => {
        persist(payload);
      },
    });
    startStudentRecordedLectureWatchSession(opportunityId, lectureId)
      .then((data) => {
        if (cancelled) return;
        sessionIdRef.current = data.watchSessionId;
        trackerRef.current?.setSessionId(data.watchSessionId);
        if (data.progress) applyProgress(data.progress);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 404) {
          setAccessError('unavailable');
          removeStudentLectureFromCache(queryClient, opportunityId, lectureId);
        } else if (status === 401 || status === 403) setAccessError('auth');
        else setSaveWarning(true);
      });

    function flushExit() {
      const lastTime = trackerRef.current?.getLastTime?.();
      const current = trackerRef.current?.flush('PAUSED', lastTime ?? 0);
      const payload = current || pendingRef.current;
      if (!payload) return;
      persist({ ...payload, watchSessionId: sessionIdRef.current || payload.watchSessionId }, { beacon: true });
    }

    function onHidden() {
      if (document.visibilityState === 'hidden') flushExit();
    }

    window.addEventListener('pagehide', flushExit);
    window.addEventListener('beforeunload', flushExit);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      cancelled = true;
      flushExit();
      trackerRef.current = null;
      window.removeEventListener('pagehide', flushExit);
      window.removeEventListener('beforeunload', flushExit);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, [applyProgress, enabled, lectureId, opportunityId, persist, queryClient]);

  const handlePlaybackEvent = useCallback((event) => {
    const tracker = trackerRef.current;
    const state = event?.playerState || event?.type;
    if (event?.type === 'ERROR' || state === 'ERROR') {
      setPlayerUnavailable(true);
      return;
    }
    if (state === 'ENDED') setPlayerEnded(true);
    if (state === 'PLAYING') setPlayerEnded(false);
    if (!tracker) return;
    const currentTime = event?.currentTime;
    if (state === 'PLAYING' || event?.type === 'TIME') {
      tracker.handleTick(currentTime, state === 'TIME' ? 'PLAYING' : state);
      return;
    }
    if (state === 'BUFFERING') {
      tracker.flush('BUFFERING', currentTime);
      return;
    }
    if (state === 'PAUSED' || state === 'ENDED' || state === 'SEEKING') {
      tracker.flush(state, currentTime);
    }
  }, []);

  return {
    progress,
    saveWarning,
    accessError,
    playerEnded,
    playerUnavailable,
    handlePlaybackEvent,
  };
}
