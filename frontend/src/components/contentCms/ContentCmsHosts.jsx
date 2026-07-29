import { useCallback, useMemo, useState } from 'react';
import { AnnouncementsHost } from './AnnouncementsHost.jsx';
import { ManagedPopupsHost } from './ManagedPopupsHost.jsx';
import { pickHighestPriorityModal } from './contentCms.shared.js';

/**
 * Mounts managed popups + announcements and ensures POPUP channels
 * share a single priority queue (never stacked).
 */
export function ContentCmsHosts() {
  const [popupCandidates, setPopupCandidates] = useState([]);
  const [announcementPopupCandidates, setAnnouncementPopupCandidates] = useState([]);

  const onPopupCandidatesChange = useCallback((list) => {
    setPopupCandidates(Array.isArray(list) ? list : []);
  }, []);

  const onAnnouncementPopupCandidatesChange = useCallback((list) => {
    setAnnouncementPopupCandidates(Array.isArray(list) ? list : []);
  }, []);

  const winner = useMemo(
    () => pickHighestPriorityModal([...popupCandidates, ...announcementPopupCandidates]),
    [popupCandidates, announcementPopupCandidates]
  );

  return (
    <>
      <AnnouncementsHost
        externalPopupWinner={winner}
        onPopupCandidatesChange={onAnnouncementPopupCandidatesChange}
      />
      <ManagedPopupsHost
        externalWinner={winner}
        onCandidatesChange={onPopupCandidatesChange}
      />
    </>
  );
}
