import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/index.js';
import {
  acknowledgePopup,
  dismissPopup,
  fetchActivePopups,
  viewPopup,
} from '../../features/popups/index.js';
import { ContentCmsModal } from './ContentCmsModal.jsx';
import { normalizePopupsPayload, pickHighestPriorityModal } from './contentCms.shared.js';

const VIEWED_SESSION_KEY = 'cms_popup_viewed_ids';

function loadViewedSet() {
  try {
    const raw = sessionStorage.getItem(VIEWED_SESSION_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveViewedSet(set) {
  try {
    sessionStorage.setItem(VIEWED_SESSION_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

/**
 * Shows the highest-priority managed popup for the authenticated user.
 * @param {{ suppressedIds?: Set<string>|string[], externalWinner?: object|null }} props
 * When `externalWinner` is provided by ContentCmsHosts, only that popup is shown
 * (so announcement POPUPs and managed popups share one queue).
 */
export function ManagedPopupsHost({
  suppressed = false,
  externalWinner = undefined,
  onCandidatesChange,
} = {}) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const qc = useQueryClient();
  const [localDismissed, setLocalDismissed] = useState(() => new Set());
  const viewedRef = useRef(loadViewedSet());
  const viewTimerRef = useRef(null);

  const { data } = useQuery({
    queryKey: ['cms', 'popups', 'active', location.pathname],
    queryFn: () => fetchActivePopups({ route: location.pathname }),
    enabled: Boolean(isAuthenticated),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const popups = useMemo(() => {
    const list = normalizePopupsPayload(data?.popups ?? data);
    return list.filter((p) => p?.id && !localDismissed.has(p.id));
  }, [data, localDismissed]);

  useEffect(() => {
    onCandidatesChange?.(
      popups.map((p) => ({
        ...p,
        _source: 'popup',
        title_ar: p.title_ar,
        body_ar: p.body_ar,
      }))
    );
  }, [popups, onCandidatesChange]);

  const winner =
    externalWinner !== undefined
      ? externalWinner?._source === 'popup'
        ? externalWinner
        : null
      : pickHighestPriorityModal(popups);

  const show = Boolean(winner) && !suppressed;

  useEffect(() => {
    if (!show || !winner?.id) return undefined;
    if (viewedRef.current.has(winner.id)) return undefined;

    if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    viewTimerRef.current = setTimeout(() => {
      if (viewedRef.current.has(winner.id)) return;
      viewedRef.current.add(winner.id);
      saveViewedSet(viewedRef.current);
      viewPopup(winner.id).catch(() => {
        viewedRef.current.delete(winner.id);
        saveViewedSet(viewedRef.current);
      });
    }, 400);

    return () => {
      if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    };
  }, [show, winner?.id]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cms', 'popups', 'active'] });

  const dismissMut = useMutation({
    mutationFn: () => dismissPopup(winner.id),
    onSuccess: () => {
      setLocalDismissed((prev) => new Set(prev).add(winner.id));
      invalidate();
    },
    onError: () => {
      setLocalDismissed((prev) => new Set(prev).add(winner.id));
    },
  });

  const ackMut = useMutation({
    mutationFn: () => acknowledgePopup(winner.id),
    onSuccess: () => {
      setLocalDismissed((prev) => new Set(prev).add(winner.id));
      invalidate();
    },
    onError: () => {
      setLocalDismissed((prev) => new Set(prev).add(winner.id));
    },
  });

  const busy = dismissMut.isPending || ackMut.isPending;

  return (
    <ContentCmsModal
      open={show}
      title={winner?.title_ar}
      body={winner?.body_ar}
      imageUrl={winner?.image_url}
      requiresAcknowledgement={Boolean(winner?.requires_acknowledgement)}
      isDismissible={winner?.is_dismissible !== false}
      ctaLabel={winner?.cta_label}
      ctaUrl={winner?.cta_url}
      busy={busy}
      onDismiss={() => dismissMut.mutate()}
      onAcknowledge={() => ackMut.mutate()}
      onCta={() => {
        if (winner?.requires_acknowledgement) ackMut.mutate();
      }}
    />
  );
}
