import { useState } from 'react';
import { CheckSquare, Square, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import {
  applyRecordedLecturePlaylistSync,
  hideRecordedLecture,
  previewRecordedLecturePlaylistSync,
} from '../../../../../features/fieldTraining/index.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { formatLectureDuration } from './recordedLectureOrder.js';

function syncLabel(t, status) {
  if (status === 'NEW') return t('recordedLectures.syncNew');
  if (status === 'EXISTING') return t('recordedLectures.syncExisting');
  if (status === 'REMOVED_FROM_SOURCE') return t('recordedLectures.syncRemoved');
  return t('recordedLectures.unavailable');
}

export function RecordedLecturesSyncPanel({
  opportunityId,
  source,
  asInstructor,
  canManage,
  onImported,
}) {
  const { t } = useTranslation('fieldTraining');
  const opts = { asInstructor };
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [result, setResult] = useState(null);

  const previewMut = useMutation({
    mutationFn: () => previewRecordedLecturePlaylistSync(opportunityId, source.playlistId, opts),
    onSuccess: (payload) => {
      setError('');
      setResult(null);
      setPreview(payload);
      setSelectedIds(
        new Set(
          (payload?.videos || [])
            .filter((video) => video.syncStatus === 'NEW')
            .map((video) => video.providerVideoId)
            .filter(Boolean)
        )
      );
    },
    onError: (err) => {
      setPreview(null);
      setError(getApiErrorMessage(err));
    },
  });

  const applyMut = useMutation({
    mutationFn: ({ importAll, videoIds }) =>
      applyRecordedLecturePlaylistSync(
        opportunityId,
        importAll
          ? { playlist_id: source.playlistId, import_all: true }
          : { playlist_id: source.playlistId, video_ids: videoIds },
        opts
      ),
    onSuccess: (payload) => {
      onImported?.();
      setError('');
      setResult(payload?.summary || null);
      setPreview(null);
      setSelectedIds(new Set());
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const hideMut = useMutation({
    mutationFn: (lectureId) => hideRecordedLecture(lectureId, opts),
    onSuccess: () => {
      onImported?.();
      if (source.playlistId) previewMut.mutate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const newIds = (preview?.videos || [])
    .filter((video) => video.syncStatus === 'NEW')
    .map((video) => video.providerVideoId)
    .filter(Boolean);
  const busy = previewMut.isPending || applyMut.isPending || hideMut.isPending;

  return (
    <section className="ft-recorded-source">
      <div className="ft-recorded-source__head">
        <div>
          <h3>{t('recordedLectures.playlistSource')}</h3>
          <p>
            {preview?.playlist?.title || t('recordedLectures.playlistMode')} · {t('recordedLectures.lectureCount', { count: source.lectureCount })}
          </p>
        </div>
        {canManage ? (
          <Button type="button" disabled={busy} onClick={() => previewMut.mutate()}>
            {t('recordedLectures.syncPlaylist')}
          </Button>
        ) : null}
      </div>

      {error ? <p className="form-field__error">{error}</p> : null}

      {result ? (
        <div className="ft-recorded-result" role="status">
          <strong>{t('recordedLectures.importSuccess')}</strong>
          <p>
            {t('recordedLectures.syncSummary', {
              imported: result.imported ?? 0,
              existing: result.existing ?? 0,
              unavailable: result.unavailable ?? 0,
              removed: result.removedFromSource ?? 0,
            })}
          </p>
        </div>
      ) : null}

      {preview ? (
        <div className="ft-recorded-sync">
          <p className="ft-recorded-sync__counts">
            {t('recordedLectures.syncFoundTitle')}
            <br />
            {t('recordedLectures.syncCounts', {
              newCount: preview.counts?.newCount ?? 0,
              existing: preview.counts?.existing ?? 0,
              unavailable: preview.counts?.unavailable ?? 0,
              removed: preview.counts?.removedFromSource ?? 0,
            })}
          </p>
          {canManage && newIds.length ? (
            <div className="ft-manage-panel__head-actions">
              <Button type="button" variant="secondary" onClick={() => setSelectedIds(new Set(newIds))}>
                {t('recordedLectures.selectAll')}
              </Button>
              <Button
                type="button"
                disabled={busy || selectedIds.size === 0}
                onClick={() => applyMut.mutate({ importAll: false, videoIds: [...selectedIds] })}
              >
                {t('recordedLectures.importSelected')}
              </Button>
              <Button type="button" disabled={busy} onClick={() => applyMut.mutate({ importAll: true })}>
                {t('recordedLectures.importAllNew')}
              </Button>
            </div>
          ) : null}

          <ul className="ft-recorded-playlist__list">
            {(preview.videos || []).map((video) => {
              const isNew = video.syncStatus === 'NEW';
              const checked = Boolean(video.providerVideoId && selectedIds.has(video.providerVideoId));
              return (
                <li key={`${video.playlistPosition}-${video.providerVideoId || 'unavailable'}`}>
                  <label className={`ft-recorded-item${!isNew ? ' is-disabled' : ''}`}>
                    <button
                      type="button"
                      className="ft-recorded-item__check"
                      disabled={!canManage || !isNew}
                      onClick={() => {
                        if (!video.providerVideoId) return;
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(video.providerVideoId)) next.delete(video.providerVideoId);
                          else next.add(video.providerVideoId);
                          return next;
                        });
                      }}
                      aria-pressed={checked}
                    >
                      {checked ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" /> : (
                      <span className="ft-recorded-item__thumb-empty">
                        <Video size={18} />
                      </span>
                    )}
                    <span className="ft-recorded-item__body">
                      <strong>{video.title}</strong>
                      <em>{formatLectureDuration(video.durationSeconds)}</em>
                      {video.warning ? <em>{video.warning}</em> : null}
                    </span>
                    <StatusBadge variant={isNew ? 'success' : video.syncStatus === 'UNAVAILABLE' ? 'danger' : 'muted'}>
                      {syncLabel(t, video.syncStatus)}
                    </StatusBadge>
                  </label>
                </li>
              );
            })}
          </ul>

          {(preview.removedFromSource || []).length ? (
            <div className="ft-recorded-removed">
              <h4>{t('recordedLectures.removedTitle')}</h4>
              <ul className="ft-recorded-playlist__list">
                {preview.removedFromSource.map((item) => (
                  <li key={item.lectureId}>
                    <div className="ft-recorded-item">
                      <span className="ft-recorded-item__thumb-empty">
                        <Video size={18} />
                      </span>
                      <span className="ft-recorded-item__body">
                        <strong>{item.title}</strong>
                        <em>{t('recordedLectures.removedHint')}</em>
                      </span>
                      {canManage ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => hideMut.mutate(item.lectureId)}
                        >
                          {t('recordedLectures.hide')}
                        </Button>
                      ) : (
                        <StatusBadge variant="muted">{t('recordedLectures.syncRemoved')}</StatusBadge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
