import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, PlayCircle, Search, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import { useStudentRecordedLectures } from '../../../../features/fieldTraining/index.js';
import {
  formatClock,
  formatHumanDuration,
  formatLectureDate,
  formatPercentValue,
  watchStatusBadgeVariant,
  watchStatusKey,
} from '../../../../features/fieldTraining/recordedLectureTime.js';
import {
  LECTURE_FILTERS,
  filterStudentLectures,
  lectureCtaKey,
  summarizeStudentLectures,
} from '../../../../features/fieldTraining/recordedLectureStudentUx.js';

function Thumbnail({ src }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="ft-student-recorded-card__ph" aria-hidden>
        <Video size={28} />
      </span>
    );
  }
  return <img src={src} alt="" onError={() => setFailed(true)} />;
}

function LectureCardSkeleton() {
  return (
    <li className="ft-student-recorded-card ft-student-recorded-card--skeleton" aria-hidden>
      <div className="ft-student-recorded-card__media ft-recorded-skel" />
      <div className="ft-student-recorded-card__body">
        <div className="ft-recorded-skel ft-recorded-skel--title" />
        <div className="ft-recorded-skel ft-recorded-skel--line" />
        <div className="ft-recorded-skel ft-recorded-skel--line" />
      </div>
    </li>
  );
}

export function StudentRecordedLecturesTab({ opportunityId, enabled, opportunityTitle }) {
  const { t, i18n } = useTranslation('fieldTraining');
  const { data, isLoading, isError, isFetching } = useStudentRecordedLectures(opportunityId, {
    enabled,
  });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const lectures = data?.lectures ?? [];
  const summary = data?.summary || summarizeStudentLectures(lectures);
  const visible = useMemo(
    () => filterStudentLectures(lectures, { query, status }),
    [lectures, query, status]
  );
  const showTools = lectures.length >= 4;

  if (!enabled) {
    return <p className="ft-manage-empty">{t('recordedLectures.studentWatch.locked')}</p>;
  }
  if (isLoading && !data) {
    return (
      <ul className="ft-student-recorded-list" aria-busy="true" aria-label={t('recordedLectures.title')}>
        {Array.from({ length: 3 }).map((_, i) => (
          <LectureCardSkeleton key={i} />
        ))}
      </ul>
    );
  }
  if (isError) {
    return <p className="form-field__error">{t('studentTraining.loadError')}</p>;
  }
  if (!lectures.length) {
    return <p className="ft-manage-empty">{t('recordedLectures.studentWatch.emptyAvailable')}</p>;
  }

  return (
    <section className="ft-student-recorded" aria-labelledby="ft-recorded-heading">
      <header className="ft-student-recorded__head">
        <div>
          <h2 id="ft-recorded-heading" className="ft-student-recorded__title">
            {t('recordedLectures.title')}
          </h2>
          {opportunityTitle ? (
            <p className="ft-student-recorded__opp">{opportunityTitle}</p>
          ) : null}
          <p className="ft-student-recorded__counts">
            <span>{t('recordedLectures.studentWatch.countLabel', { count: summary.total })}</span>
            <span>{t('recordedLectures.studentWatch.completedCount', { count: summary.completed })}</span>
          </p>
          <p className="ft-student-recorded__overall">
            {t('recordedLectures.studentWatch.overallProgress', {
              completed: summary.completed,
              total: summary.total,
            })}
          </p>
        </div>
        {isFetching && data ? (
          <span className="ft-student-recorded__quiet" aria-live="polite">
            {t('recordedLectures.studentWatch.updating')}
          </span>
        ) : null}
      </header>

      {showTools ? (
        <div className="ft-student-recorded__tools">
          <label className="ft-student-recorded__search">
            <Search size={16} aria-hidden />
            <span className="sr-only">{t('recordedLectures.studentWatch.searchPlaceholder')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('recordedLectures.studentWatch.searchPlaceholder')}
            />
          </label>
          <div className="ft-student-recorded__filters" role="group" aria-label={t('recordedLectures.studentWatch.statusLabel')}>
            {LECTURE_FILTERS.map((key) => (
              <button
                key={key}
                type="button"
                className={`ft-student-recorded__filter${status === key ? ' is-active' : ''}`}
                aria-pressed={status === key}
                onClick={() => setStatus(key)}
              >
                {t(`recordedLectures.studentWatch.filter.${key}`)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {visible.length ? (
        <ul className="ft-student-recorded-list">
          {visible.map((lecture) => {
            const progress = lecture.progress || {};
            const statusKey = watchStatusKey(progress);
            const percent = formatPercentValue(progress.progressPercentage);
            const ctaKey = lectureCtaKey(progress);
            const lectureDate = formatLectureDate(lecture.lectureDate, i18n.language);
            return (
              <li
                key={lecture.id}
                className={`ft-student-recorded-card${statusKey === 'completed' ? ' ft-student-recorded-card--done' : ''}`}
              >
                <div className="ft-student-recorded-card__media">
                  <Thumbnail src={lecture.thumbnailUrl} />
                  {statusKey === 'completed' ? (
                    <span className="ft-student-recorded-card__done-mark" aria-hidden>
                      <CheckCircle2 size={16} />
                    </span>
                  ) : null}
                </div>
                <div className="ft-student-recorded-card__body">
                  <h3 className="ft-student-recorded-card__title">{lecture.title}</h3>
                  <p className="ft-student-recorded-card__meta">
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
                  </p>
                  {percent != null ? (
                    <div
                      className="ft-recorded-progress"
                      dir="ltr"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(Number(progress.progressPercentage) || 0)}
                      aria-label={t('recordedLectures.studentWatch.progressLabel')}
                    >
                      <span style={{ width: `${Math.max(0, Math.min(100, Number(progress.progressPercentage) || 0))}%` }} />
                    </div>
                  ) : null}
                  <p className="ft-student-recorded-card__watch">
                    {t('recordedLectures.studentWatch.progressLabel')}:{' '}
                    <bdi className="ft-ltr-num" dir="ltr">
                      {percent == null
                        ? '—'
                        : t('recordedLectures.studentWatch.percent', { value: percent })}
                    </bdi>
                  </p>
                  {lecture.durationSeconds != null ? (
                    <p className="ft-student-recorded-card__summary">
                      {t('recordedLectures.studentWatch.watchedSummary', {
                        watched: formatHumanDuration(progress.uniqueWatchedSeconds || 0, t),
                        total: formatHumanDuration(lecture.durationSeconds, t),
                      })}
                    </p>
                  ) : null}
                  <p className="ft-student-recorded-card__status">
                    {t('recordedLectures.studentWatch.statusLabel')}:{' '}
                    <StatusBadge variant={watchStatusBadgeVariant(statusKey)}>
                      {t(`recordedLectures.studentWatch.${statusKey}`)}
                    </StatusBadge>
                  </p>
                  <div className="ft-student-recorded-card__actions">
                    <Link
                      className="btn btn--primary btn--sm"
                      to={`/student/field-training/${opportunityId}/recorded-lectures/${lecture.id}`}
                    >
                      <PlayCircle size={14} aria-hidden /> {t(`recordedLectures.studentWatch.${ctaKey}`)}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="ft-manage-empty">{t('recordedLectures.studentWatch.noFilterResults')}</p>
      )}
    </section>
  );
}
