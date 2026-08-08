import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useAuth } from '../../features/auth/index.js';
import {
  acknowledgeAnnouncement,
  clickAnnouncement,
  dismissAnnouncement,
  fetchActiveAnnouncements,
  viewAnnouncement,
} from '../../features/announcements/index.js';
import { Button } from '../common/Button.jsx';
import { ContentCmsModal } from './ContentCmsModal.jsx';
import {
  announcementHasChannel,
  isDashboardPath,
  normalizeAnnouncementsPayload,
  pickHighestPriorityModal,
} from './contentCms.shared.js';

const VIEWED_SESSION_KEY = 'cms_announcement_viewed_ids';

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

function typeClass(type) {
  const t = String(type || 'INFORMATION').toUpperCase();
  if (t === 'URGENT') return 'cms-banner--urgent ds-alert--urgent';
  if (t === 'IMPORTANT') return 'cms-banner--urgent ds-alert--important';
  if (t === 'WARNING') return 'cms-banner--warning ds-alert--warning';
  if (t === 'SUCCESS') return 'cms-banner--success ds-alert--success';
  if (t === 'MAINTENANCE') return 'cms-banner--maintenance ds-alert--maintenance';
  return 'cms-banner--info ds-alert--info';
}

/**
 * Renders TOP_BANNER, DASHBOARD_CARD, and POPUP announcement channels.
 */
export function AnnouncementsHost({
  suppressedPopup = false,
  externalPopupWinner = undefined,
  onPopupCandidatesChange,
} = {}) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const viewedRef = useRef(loadViewedSet());
  const viewTimers = useRef(new Map());

  const { data } = useQuery({
    queryKey: ['cms', 'announcements', 'active'],
    queryFn: fetchActiveAnnouncements,
    enabled: Boolean(isAuthenticated),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const items = useMemo(() => {
    return normalizeAnnouncementsPayload(data).filter((a) => a?.id && !hiddenIds.has(a.id));
  }, [data, hiddenIds]);

  const banners = useMemo(
    () => items.filter((a) => announcementHasChannel(a, 'TOP_BANNER')),
    [items]
  );
  const cards = useMemo(
    () =>
      isDashboardPath(location.pathname)
        ? items.filter((a) => announcementHasChannel(a, 'DASHBOARD_CARD'))
        : [],
    [items, location.pathname]
  );
  const popupCandidates = useMemo(
    () =>
      items
        .filter((a) => announcementHasChannel(a, 'POPUP'))
        .map((a) => ({
          ...a,
          _source: 'announcement',
          body_ar: a.content_ar || a.summary_ar,
        })),
    [items]
  );

  useEffect(() => {
    onPopupCandidatesChange?.(popupCandidates);
  }, [popupCandidates, onPopupCandidatesChange]);

  const popupWinner =
    externalPopupWinner !== undefined
      ? externalPopupWinner?._source === 'announcement'
        ? externalPopupWinner
        : null
      : pickHighestPriorityModal(popupCandidates);

  const showPopup = Boolean(popupWinner) && !suppressedPopup;

  const markViewed = (id, channel) => {
    if (!id || viewedRef.current.has(`${id}:${channel}`)) return;
    viewedRef.current.add(`${id}:${channel}`);
    saveViewedSet(viewedRef.current);
    viewAnnouncement(id, { channel }).catch(() => {
      viewedRef.current.delete(`${id}:${channel}`);
      saveViewedSet(viewedRef.current);
    });
  };

  useEffect(() => {
    for (const a of banners) {
      const key = a.id;
      if (viewTimers.current.has(`banner:${key}`)) continue;
      const timer = setTimeout(() => markViewed(a.id, 'TOP_BANNER'), 350);
      viewTimers.current.set(`banner:${key}`, timer);
    }
    for (const a of cards) {
      const key = a.id;
      if (viewTimers.current.has(`card:${key}`)) continue;
      const timer = setTimeout(() => markViewed(a.id, 'DASHBOARD_CARD'), 350);
      viewTimers.current.set(`card:${key}`, timer);
    }
    return () => {
      /* keep timers for session */
    };
  }, [banners, cards]);

  useEffect(() => {
    if (!showPopup || !popupWinner?.id) return undefined;
    const timer = setTimeout(() => markViewed(popupWinner.id, 'POPUP'), 400);
    return () => clearTimeout(timer);
  }, [showPopup, popupWinner?.id]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['cms', 'announcements', 'active'] });

  const hideLocal = (id) => setHiddenIds((prev) => new Set(prev).add(id));

  const dismissMut = useMutation({
    mutationFn: ({ id, channel }) => dismissAnnouncement(id, { channel }),
    onSuccess: (_d, vars) => {
      hideLocal(vars.id);
      invalidate();
    },
    onError: (_e, vars) => hideLocal(vars.id),
  });

  const ackMut = useMutation({
    mutationFn: ({ id, channel }) => acknowledgeAnnouncement(id, { channel }),
    onSuccess: (_d, vars) => {
      hideLocal(vars.id);
      invalidate();
    },
    onError: (_e, vars) => hideLocal(vars.id),
  });

  const clickMut = useMutation({
    mutationFn: ({ id, channel }) => clickAnnouncement(id, { channel }),
  });

  const handleCta = (item, channel) => {
    clickMut.mutate({ id: item.id, channel });
    const url = item.cta_url;
    if (!url) return;
    if (/^https?:\/\//i.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigate(url);
    }
  };

  const renderActions = (item, channel) => (
    <div className="cms-announcement__actions">
      {item.cta_label && item.cta_url ? (
        <Button type="button" variant="outline" className="btn--sm" onClick={() => handleCta(item, channel)}>
          {item.cta_label}
        </Button>
      ) : null}
      {item.requires_acknowledgement ? (
        <Button
          type="button"
          variant="primary"
          className="btn--sm"
          onClick={() => ackMut.mutate({ id: item.id, channel })}
        >
          تم الاطلاع
        </Button>
      ) : null}
      {item.is_dismissible !== false && !item.requires_acknowledgement ? (
        <button
          type="button"
          className="cms-announcement__dismiss"
          aria-label="إغلاق"
          onClick={() => dismissMut.mutate({ id: item.id, channel })}
        >
          <X size={16} />
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      {banners.length ? (
        <div className="cms-banner-stack" role="region" aria-label="إعلانات">
          {banners.map((a) => (
            <div key={a.id} className={`cms-banner ds-alert ${typeClass(a.announcement_type)}`}>
              <div className="cms-banner__text ds-alert__body">
                <strong className="ds-alert__title">{a.title_ar}</strong>
                {a.summary_ar ? <span className="ds-alert__message">{a.summary_ar}</span> : null}
              </div>
              {renderActions(a, 'TOP_BANNER')}
            </div>
          ))}
        </div>
      ) : null}

      {cards.length ? (
        <section className="cms-dashboard-cards" aria-label="بطاقات الإعلانات">
          {cards.map((a) => (
            <article key={a.id} className={`cms-dashboard-card ${typeClass(a.announcement_type)}`}>
              <div className="cms-dashboard-card__body">
                <h3>{a.title_ar}</h3>
                {a.summary_ar || a.content_ar ? <p>{a.summary_ar || a.content_ar}</p> : null}
                {a.cta_label && a.cta_url ? (
                  <Link
                    className="btn btn--outline btn--sm"
                    to={/^https?:\/\//i.test(a.cta_url) ? '#' : a.cta_url}
                    onClick={(e) => {
                      if (/^https?:\/\//i.test(a.cta_url)) {
                        e.preventDefault();
                        handleCta(a, 'DASHBOARD_CARD');
                      } else {
                        clickMut.mutate({ id: a.id, channel: 'DASHBOARD_CARD' });
                      }
                    }}
                  >
                    {a.cta_label}
                  </Link>
                ) : null}
              </div>
              {renderActions(a, 'DASHBOARD_CARD')}
            </article>
          ))}
        </section>
      ) : null}

      <ContentCmsModal
        open={showPopup}
        title={popupWinner?.title_ar}
        body={popupWinner?.body_ar || popupWinner?.content_ar || popupWinner?.summary_ar}
        imageUrl={popupWinner?.image_url}
        requiresAcknowledgement={Boolean(popupWinner?.requires_acknowledgement)}
        isDismissible={popupWinner?.is_dismissible !== false}
        ctaLabel={popupWinner?.cta_label}
        ctaUrl={popupWinner?.cta_url}
        busy={dismissMut.isPending || ackMut.isPending}
        onDismiss={() => dismissMut.mutate({ id: popupWinner.id, channel: 'POPUP' })}
        onAcknowledge={() => ackMut.mutate({ id: popupWinner.id, channel: 'POPUP' })}
        onCta={() => {
          clickMut.mutate({ id: popupWinner.id, channel: 'POPUP' });
          if (popupWinner?.requires_acknowledgement) {
            ackMut.mutate({ id: popupWinner.id, channel: 'POPUP' });
          }
        }}
      />
    </>
  );
}
