import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, RotateCcw, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PagePermissionGate } from '../../components/permissions/PagePermissionGate.jsx';
import { UI_PERMISSION } from '../../constants/permissions.js';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { useStudentRecordedLecture } from '../../features/fieldTraining/index.js';
import {
  formatClock,
  formatHumanDuration,
  formatLectureDate,
  formatPercentValue,
  watchStatusBadgeVariant,
  watchStatusKey,
} from '../../features/fieldTraining/recordedLectureTime.js';
import { RecordedLecturePlayer } from './fieldTraining/components/RecordedLecturePlayer.jsx';
import { useRecordedLectureWatchTracking } from './fieldTraining/components/useRecordedLectureWatchTracking.js';
import { NAVIGATION_MODULES, useNavigationActivity } from '../../features/activity/navigationActivity.js';

const DESC_LIMIT = 320;

export function StudentRecordedLecturePlayerPage() {
  const { id: opportunityId, lectureId } = useParams();
  useNavigationActivity(NAVIGATION_MODULES.RECORDED_LECTURE, lectureId);
  const { t, i18n } = useTranslation('fieldTraining');
  const { data, isLoading, isError, error } = useStudentRecordedLecture(opportunityId, lectureId);
  const lecture = data?.lecture;
  const seekApiRef = useRef(null);
  const [restarted, setRestarted] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const {
    progress: liveProgress,
    saveWarning,
    accessError,
    playerEnded,
    playerUnavailable,
    handlePlaybackEvent,
  } = useRecordedLectureWatchTracking({
    opportunityId,
    lectureId,
    enabled: Boolean(lecture),
  });
  const progress = liveProgress || lecture?.progress || {};
  const statusKey = watchStatusKey(progress);
  const percent = formatPercentValue(progress.progressPercentage);
  const startSeconds = restarted ? 0 : Number(lecture?.progress?.resumePositionSeconds || 0);
  const resumeHint =
    !restarted &&
    !hasPlayed &&
    Number(lecture?.progress?.resumePositionSeconds || 0) > 0;
  const missingVideo =
    Boolean(lecture) &&
    String(lecture.provider || '').toUpperCase() === 'YOUTUBE' &&
    !lecture.providerVideoId &&
    !lecture.provider_video_id;

  useEffect(() => {
    setRestarted(false);
    setHasPlayed(false);
    setDescOpen(false);
  }, [lectureId]);

  const hiddenByAdmin = accessError === 'unavailable' || error?.response?.status === 404;
  const unavailable = playerUnavailable || hiddenByAdmin || missingVideo;
  const lectureDate = formatLectureDate(lecture?.lectureDate, i18n.language);
  const sessionDate = formatLectureDate(lecture?.sessionDate, i18n.language);
  const longDesc = String(lecture?.description || '').length > DESC_LIMIT;
  const description = useMemo(() => {
    const text = String(lecture?.description || '');
    if (!text) return '';
    if (!longDesc || descOpen) return text;
    return `${text.slice(0, DESC_LIMIT).trim()}…`;
  }, [descOpen, lecture?.description, longDesc]);
  const showNav = Boolean(data?.previous || data?.next);

  function onPlayback(event) {
    const state = event?.playerState || event?.type;
    if (state === 'PLAYING' || event?.type === 'PLAYING') setHasPlayed(true);
    handlePlaybackEvent(event);
  }

  function handleRestart() {
    setRestarted(true);
    seekApiRef.current?.(0);
  }

  const listHref = `/student/field-training/${opportunityId}?tab=recorded_lectures`;

  return (
    <PagePermissionGate permission={UI_PERMISSION.canViewFieldTraining}>
      <div className="ft-student-detail ft-recorded-player-page">
        <Link to={listHref} className="ft-student-detail__back">
          <ArrowRight size={16} aria-hidden /> {t('recordedLectures.studentWatch.back')}
        </Link>

        {isLoading && !lecture ? (
          <div
            className="ft-recorded-player__frame ft-recorded-skel"
            aria-busy="true"
            aria-label={t('recordedLectures.studentWatch.playerLoading')}
          />
        ) : null}

        {isError && !unavailable ? (
          <p className="form-field__error">{t('studentTraining.loadError')}</p>
        ) : null}

        {lecture ? (
          <header className="ft-recorded-player-page__head">
            <div className="ft-recorded-player-page__icon" aria-hidden>
              <Video size={22} />
            </div>
            <div>
              <h1 className="ft-recorded-player-page__title">{lecture.title}</h1>
              <p className="ft-recorded-player-page__meta">
                <span>
                  {t('recordedLectures.studentWatch.duration')}:{' '}
                  <bdi className="ft-ltr-num" dir="ltr">
                    {formatClock(lecture.durationSeconds)}
                  </bdi>
                </span>
                {lectureDate ? <span>{lectureDate}</span> : null}
                {lecture.instructorName ? (
                  <span>
                    {t('recordedLectures.studentWatch.instructor')}: {lecture.instructorName}
                  </span>
                ) : null}
                {sessionDate ? (
                  <span>{t('recordedLectures.studentWatch.linkedSession', { date: sessionDate })}</span>
                ) : null}
              </p>
            </div>
          </header>
        ) : null}

        {unavailable ? (
          <div className="ft-recorded-player__unsupported" role="alert">
            <p>
              {hiddenByAdmin
                ? t('recordedLectures.studentWatch.noLongerAvailable')
                : t('recordedLectures.studentWatch.unavailable')}
            </p>
            <Link className="btn btn--primary" to={listHref}>
              {t('recordedLectures.studentWatch.back')}
            </Link>
          </div>
        ) : null}

        {lecture && unavailable && progress.progressPercentage != null ? (
          <section
            className="ft-recorded-player-page__progress"
            aria-label={t('recordedLectures.studentWatch.progressLabel')}
          >
            <p>
              {t('recordedLectures.studentWatch.progressLabel')}:{' '}
              <bdi className="ft-ltr-num" dir="ltr">
                {percent == null ? '—' : t('recordedLectures.studentWatch.percent', { value: percent })}
              </bdi>
            </p>
            <StatusBadge variant={watchStatusBadgeVariant(statusKey)}>
              {t(`recordedLectures.studentWatch.${statusKey}`)}
            </StatusBadge>
          </section>
        ) : null}

        {lecture && !unavailable ? (
          <>
            {resumeHint ? (
              <p className="ft-recorded-player-page__resume">
                {t('recordedLectures.studentWatch.resumeFrom')}{' '}
                <bdi className="ft-ltr-num" dir="ltr">
                  {formatClock(lecture.progress?.resumePositionSeconds)}
                </bdi>
              </p>
            ) : null}

            <RecordedLecturePlayer
              lecture={lecture}
              startSeconds={startSeconds}
              onPlaybackEvent={onPlayback}
              seekApiRef={seekApiRef}
            />

            {statusKey !== 'notStarted' ? (
              <button
                type="button"
                className="btn btn--outline ft-recorded-player-page__restart"
                onClick={handleRestart}
              >
                <RotateCcw size={14} aria-hidden /> {t('recordedLectures.studentWatch.restartFromStart')}
              </button>
            ) : null}

            {saveWarning ? (
              <p className="ft-recorded-player-page__warn" role="status">
                {t('recordedLectures.studentWatch.progressSaveWarning')}
              </p>
            ) : null}

            {accessError === 'auth' ? (
              <p className="ft-recorded-player-page__warn" role="status">
                {t('recordedLectures.studentWatch.authExpired')}
              </p>
            ) : null}

            <section
              className="ft-recorded-player-page__progress"
              aria-label={t('recordedLectures.studentWatch.progressLabel')}
            >
              {progress.progressPercentage != null ? (
                <div
                  className="ft-recorded-progress"
                  dir="ltr"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(Number(progress.progressPercentage) || 0)}
                >
                  <span
                    style={{
                      width: `${Math.max(0, Math.min(100, Number(progress.progressPercentage) || 0))}%`,
                    }}
                  />
                </div>
              ) : null}
              <p>
                {lecture.durationSeconds != null
                  ? t('recordedLectures.studentWatch.watchedSummary', {
                      watched: formatHumanDuration(progress.uniqueWatchedSeconds || 0, t),
                      total: formatHumanDuration(lecture.durationSeconds, t),
                    })
                  : t('recordedLectures.studentWatch.noDuration')}
              </p>
              <p>
                {t('recordedLectures.studentWatch.progressLabel')}:{' '}
                <bdi className="ft-ltr-num" dir="ltr">
                  {percent == null ? '—' : t('recordedLectures.studentWatch.percent', { value: percent })}
                </bdi>
              </p>
              <StatusBadge variant={watchStatusBadgeVariant(statusKey)}>
                {t(`recordedLectures.studentWatch.${statusKey}`)}
              </StatusBadge>
            </section>

            {statusKey === 'completed' ? (
              <div className="ft-recorded-player-page__end" role="status">
                <p>{t('recordedLectures.studentWatch.lectureCompleted')}</p>
                {lecture.sessionId || lecture.sessionDate ? (
                  <p>{t('recordedLectures.studentWatch.attendanceUpdatedFromLecture')}</p>
                ) : null}
                {data?.next ? (
                  <Link
                    className="btn btn--primary"
                    to={`/student/field-training/${opportunityId}/recorded-lectures/${data.next.id}`}
                  >
                    {t('recordedLectures.studentWatch.goToNext')}
                  </Link>
                ) : null}
              </div>
            ) : null}

            {playerEnded && statusKey !== 'completed' ? (
              <p className="ft-recorded-player-page__end-note" role="status">
                {t('recordedLectures.studentWatch.endNotComplete')}
              </p>
            ) : null}

            {description ? (
              <div className="ft-recorded-player-page__desc">
                <p className="ft-recorded-player-page__desc-text">{description}</p>
                {longDesc ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDescOpen((v) => !v)}>
                    {descOpen
                      ? t('recordedLectures.studentWatch.descriptionLess')
                      : t('recordedLectures.studentWatch.descriptionMore')}
                  </button>
                ) : null}
              </div>
            ) : null}

            {showNav ? (
              <nav className="ft-recorded-player-page__nav" aria-label={t('recordedLectures.title')}>
                {data?.previous ? (
                  <Link
                    className="btn btn--outline"
                    to={`/student/field-training/${opportunityId}/recorded-lectures/${data.previous.id}`}
                  >
                    <ArrowRight size={14} aria-hidden /> {t('recordedLectures.studentWatch.previous')}
                  </Link>
                ) : (
                  <span />
                )}
                {data?.next ? (
                  <Link
                    className="btn btn--outline"
                    to={`/student/field-training/${opportunityId}/recorded-lectures/${data.next.id}`}
                  >
                    {t('recordedLectures.studentWatch.next')} <ArrowLeft size={14} aria-hidden />
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        ) : null}
      </div>
    </PagePermissionGate>
  );
}
