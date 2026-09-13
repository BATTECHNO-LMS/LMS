import { useMemo, useState } from 'react';
import { CheckSquare, Square, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../../../../components/common/Button.jsx';
import { FormInput } from '../../../../../components/forms/FormInput.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import {
  importYoutubeRecordedLecture,
  importYoutubeRecordedLecturePlaylist,
  previewYoutubeRecordedLecture,
  previewYoutubeRecordedLecturePlaylist,
} from '../../../../../features/fieldTraining/index.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';
import { formatLectureDuration } from './recordedLectureOrder.js';

export function RecordedLecturesImportPanel({ opportunityId, asInstructor, onImported }) {
  const { t } = useTranslation('fieldTraining');
  const opts = { asInstructor };
  const [mode, setMode] = useState('single');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [singlePreview, setSinglePreview] = useState(null);
  const [playlistPreview, setPlaylistPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [result, setResult] = useState(null);

  const newPlaylistIds = useMemo(
    () =>
      (playlistPreview?.videos || [])
        .filter((video) => video.duplicateStatus === 'NEW')
        .map((video) => video.providerVideoId)
        .filter(Boolean),
    [playlistPreview]
  );

  const previewSingleMut = useMutation({
    mutationFn: () => previewYoutubeRecordedLecture(opportunityId, url.trim(), opts),
    onSuccess: (payload) => {
      setError('');
      setResult(null);
      setPlaylistPreview(null);
      setSinglePreview(payload?.preview || null);
    },
    onError: (err) => {
      setSinglePreview(null);
      setError(getApiErrorMessage(err));
    },
  });

  const importSingleMut = useMutation({
    mutationFn: () => importYoutubeRecordedLecture(opportunityId, url.trim(), opts),
    onSuccess: (payload) => {
      onImported?.();
      setError('');
      setResult({
        imported: payload?.summary?.imported ?? 1,
        alreadyExisting: payload?.summary?.alreadyExisting ?? 0,
        unavailable: payload?.summary?.unavailable ?? 0,
      });
      setSinglePreview(null);
      setUrl('');
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const previewPlaylistMut = useMutation({
    mutationFn: () => previewYoutubeRecordedLecturePlaylist(opportunityId, url.trim(), opts),
    onSuccess: (payload) => {
      setError('');
      setResult(null);
      setSinglePreview(null);
      setPlaylistPreview(payload);
      setSelectedIds(
        new Set(
          (payload?.videos || [])
            .filter((video) => video.duplicateStatus === 'NEW')
            .map((video) => video.providerVideoId)
            .filter(Boolean)
        )
      );
    },
    onError: (err) => {
      setPlaylistPreview(null);
      setError(getApiErrorMessage(err));
    },
  });

  const importPlaylistMut = useMutation({
    mutationFn: ({ importAll, videoIds }) =>
      importYoutubeRecordedLecturePlaylist(
        opportunityId,
        importAll ? { url: url.trim(), import_all: true } : { url: url.trim(), video_ids: videoIds },
        opts
      ),
    onSuccess: (payload) => {
      onImported?.();
      setError('');
      setResult({
        imported: payload?.summary?.imported ?? 0,
        alreadyExisting: payload?.summary?.alreadyExisting ?? payload?.summary?.duplicate ?? 0,
        unavailable: payload?.summary?.unavailable ?? payload?.summary?.skippedUnavailable ?? 0,
      });
      setPlaylistPreview(null);
      setSelectedIds(new Set());
      setUrl('');
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function resetPreview() {
    setSinglePreview(null);
    setPlaylistPreview(null);
    setSelectedIds(new Set());
    setResult(null);
    setError('');
  }

  function handlePreview(e) {
    e.preventDefault();
    setError('');
    if (!url.trim()) {
      setError(t('recordedLectures.urlRequired'));
      return;
    }
    if (mode === 'single') previewSingleMut.mutate();
    else previewPlaylistMut.mutate();
  }

  function toggleVideo(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const busy =
    previewSingleMut.isPending ||
    importSingleMut.isPending ||
    previewPlaylistMut.isPending ||
    importPlaylistMut.isPending;

  return (
    <section className="ft-recorded-import">
      {error ? <p className="form-field__error">{error}</p> : null}
      {result ? (
        <div className="ft-recorded-result" role="status">
          <strong>{t('recordedLectures.importSuccess')}</strong>
          <p>
            {t('recordedLectures.importSummary', {
              imported: result.imported,
              existing: result.alreadyExisting,
              unavailable: result.unavailable,
            })}
          </p>
        </div>
      ) : null}

      <div className="ft-recorded-modes" role="tablist">
        <button
          type="button"
          className={`ft-recorded-mode${mode === 'single' ? ' is-active' : ''}`}
          onClick={() => {
            setMode('single');
            resetPreview();
          }}
        >
          {t('recordedLectures.singleMode')}
        </button>
        <button
          type="button"
          className={`ft-recorded-mode${mode === 'playlist' ? ' is-active' : ''}`}
          onClick={() => {
            setMode('playlist');
            resetPreview();
          }}
        >
          {t('recordedLectures.playlistMode')}
        </button>
      </div>

      <form className="ft-manage-form" onSubmit={handlePreview}>
        <FormInput
          label={mode === 'single' ? t('recordedLectures.videoUrl') : t('recordedLectures.playlistUrl')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={
            mode === 'single'
              ? 'https://www.youtube.com/watch?v=...'
              : 'https://www.youtube.com/playlist?list=...'
          }
          required
        />
        <div className="ft-manage-panel__head-actions">
          <Button type="submit" disabled={busy}>
            {mode === 'single' ? t('recordedLectures.previewVideo') : t('recordedLectures.previewPlaylist')}
          </Button>
        </div>
      </form>

      {singlePreview ? (
        <article className="ft-recorded-preview-card">
          {singlePreview.thumbnailUrl ? (
            <img src={singlePreview.thumbnailUrl} alt="" className="ft-recorded-preview-card__thumb" />
          ) : (
            <div className="ft-recorded-preview-card__thumb ft-recorded-preview-card__thumb--empty">
              <Video size={28} />
            </div>
          )}
          <div>
            <h4>{singlePreview.title}</h4>
            <p>
              {formatLectureDuration(singlePreview.durationSeconds)} · {t('recordedLectures.providerYoutube')}
            </p>
            {singlePreview.duplicateStatus === 'ALREADY_IMPORTED' ? (
              <StatusBadge variant="muted">{t('recordedLectures.alreadyImported')}</StatusBadge>
            ) : (
              <Button
                type="button"
                disabled={busy || singlePreview.duplicateStatus !== 'NEW'}
                onClick={() => importSingleMut.mutate()}
              >
                {t('recordedLectures.importLecture')}
              </Button>
            )}
          </div>
        </article>
      ) : null}

      {playlistPreview ? (
        <section className="ft-recorded-playlist">
          <header className="ft-recorded-playlist__head">
            <div>
              <h3>{playlistPreview.playlist?.title || t('recordedLectures.playlistMode')}</h3>
              <p>
                {t('recordedLectures.videosFound', {
                  count: playlistPreview.counts?.found ?? playlistPreview.videos?.length ?? 0,
                })}
              </p>
            </div>
            <div className="ft-manage-panel__head-actions">
              <Button type="button" variant="secondary" onClick={() => setSelectedIds(new Set(newPlaylistIds))}>
                {t('recordedLectures.selectAll')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setSelectedIds(new Set())}>
                {t('recordedLectures.clearSelection')}
              </Button>
              <Button
                type="button"
                disabled={busy || selectedIds.size === 0}
                onClick={() => importPlaylistMut.mutate({ importAll: false, videoIds: [...selectedIds] })}
              >
                {t('recordedLectures.importSelected')}
              </Button>
              <Button
                type="button"
                disabled={busy || newPlaylistIds.length === 0}
                onClick={() => importPlaylistMut.mutate({ importAll: true })}
              >
                {t('recordedLectures.importAll')}
              </Button>
            </div>
          </header>
          <ul className="ft-recorded-playlist__list">
            {(playlistPreview.videos || []).map((video) => {
              const disabled = video.duplicateStatus !== 'NEW';
              const checked = Boolean(video.providerVideoId && selectedIds.has(video.providerVideoId));
              return (
                <li key={`${video.playlistPosition}-${video.providerVideoId || 'unavailable'}`}>
                  <label className={`ft-recorded-item${disabled ? ' is-disabled' : ''}`}>
                    <button
                      type="button"
                      className="ft-recorded-item__check"
                      disabled={disabled}
                      onClick={() => video.providerVideoId && toggleVideo(video.providerVideoId)}
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
                      <strong>
                        {(video.playlistPosition ?? 0) + 1}. {video.title}
                      </strong>
                      <em>{formatLectureDuration(video.durationSeconds)}</em>
                    </span>
                    {video.duplicateStatus === 'ALREADY_IMPORTED' ? (
                      <StatusBadge variant="muted">{t('recordedLectures.alreadyImported')}</StatusBadge>
                    ) : null}
                    {video.availability === 'UNAVAILABLE' ? (
                      <StatusBadge variant="danger">{t('recordedLectures.unavailable')}</StatusBadge>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
