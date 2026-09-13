import { useEffect, useRef } from 'react';
import { youtubePlayerStateName } from '../../../../features/fieldTraining/recordedLectureWatchTracker.js';

let youtubeApiPromise = null;

function loadYouTubeIframeApi() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve(window.YT);
    };
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => reject(new Error('youtube iframe api failed'));
      document.head.appendChild(tag);
    }
    if (window.YT?.Player) resolve(window.YT);
  });
  return youtubeApiPromise;
}

export function YouTubeRecordedLecturePlayer({
  videoId,
  startSeconds = 0,
  title,
  onPlaybackEvent,
  seekApiRef,
}) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const pollRef = useRef(null);
  const onPlaybackEventRef = useRef(onPlaybackEvent);
  const initialStartRef = useRef(Math.max(0, Math.floor(Number(startSeconds) || 0)));
  onPlaybackEventRef.current = onPlaybackEvent;

  useEffect(() => {
    initialStartRef.current = Math.max(0, Math.floor(Number(startSeconds) || 0));
  }, [videoId]);

  useEffect(() => {
    let cancelled = false;
    if (!hostRef.current || !videoId) return undefined;

    function emit(type, player, extra = {}) {
      const currentTime = typeof player?.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
      const stateCode = typeof player?.getPlayerState === 'function' ? player.getPlayerState() : -1;
      onPlaybackEventRef.current?.({
        type,
        currentTime,
        playerState: youtubePlayerStateName(stateCode),
        ...extra,
      });
    }

    function stopPoll() {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    function startPoll(player) {
      stopPoll();
      pollRef.current = window.setInterval(() => {
        emit('TIME', player);
      }, 1000);
    }

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        playerRef.current = new YT.Player(hostRef.current, {
          videoId,
          host: 'https://www.youtube.com',
          playerVars: {
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            start: initialStartRef.current,
            fs: 1,
          },
          events: {
            onReady(event) {
              const player = event.target;
              const start = initialStartRef.current;
              if (start > 0 && typeof player.seekTo === 'function') {
                player.seekTo(start, true);
              }
              if (seekApiRef) {
                seekApiRef.current = (seconds) => {
                  if (typeof player.seekTo === 'function') player.seekTo(Math.max(0, Number(seconds) || 0), true);
                };
              }
              emit('READY', player);
            },
            onStateChange(event) {
              const player = event.target;
              const playerState = youtubePlayerStateName(event.data);
              emit(playerState, player);
              if (playerState === 'PLAYING') startPoll(player);
              else stopPoll();
            },
            onError() {
              emit('ERROR', null);
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) emit('ERROR', null);
      });

    return () => {
      cancelled = true;
      stopPoll();
      if (seekApiRef) seekApiRef.current = null;
      const player = playerRef.current;
      playerRef.current = null;
      try {
        player?.destroy?.();
      } catch {
        /* player may already be gone */
      }
    };
  }, [videoId, seekApiRef]);

  return (
    <div className="ft-recorded-player__frame">
      <div ref={hostRef} title={title} className="ft-recorded-player__host" />
    </div>
  );
}
