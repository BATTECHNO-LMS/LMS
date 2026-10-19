import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../../components/common/Button.jsx';
import { StatusBadge } from '../../../../../components/admin/StatusBadge.jsx';
import { StudentProgressBar } from '../../../../../components/student/StudentProgressBar.jsx';
import { useRecordedLectureStudentProgress } from '../../../../../features/fieldTraining/hooks/useAdminFieldTraining.js';
import { getApiErrorMessage } from '../../../../../services/apiHelpers.js';

const FILTERS = [
  'all',
  'completed',
  'in_progress',
  'not_started',
  'present',
  'not_present',
  'needs_sync',
];
const SORTS = [
  'progress_desc',
  'progress_asc',
  'name_asc',
  'name_desc',
  'completed_at_desc',
  'completed_at_asc',
  'last_activity_desc',
  'last_activity_asc',
];

function formatWhen(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale?.startsWith('ar') ? 'ar-JO' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function watchVariant(status) {
  if (status === 'completed') return 'success';
  if (status === 'in_progress') return 'info';
  return 'muted';
}

function attendanceVariant(status) {
  if (status === 'present') return 'success';
  if (status === 'late') return 'warning';
  if (status === 'excused') return 'info';
  if (status === 'absent') return 'danger';
  return 'muted';
}

function KpiCard({ label, value }) {
  return (
    <article className="ft-rl-progress__kpi">
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
    </article>
  );
}

export function ManageRecordedLectureProgressPanel({
  lecture,
  apiScope = 'admin',
  onClose,
}) {
  const { t, i18n } = useTranslation('fieldTraining');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('progress_desc');
  const [page, setPage] = useState(1);
  const [refreshedAt, setRefreshedAt] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [filter, sort, lecture?.id]);

  const query = useRecordedLectureStudentProgress(
    lecture?.id,
    { page, pageSize: 25, search, filter, sort },
    { scope: apiScope }
  );

  useEffect(() => {
    if (query.isSuccess) setRefreshedAt(new Date());
  }, [query.dataUpdatedAt, query.isSuccess]);

  const summary = query.data?.summary;
  const students = query.data?.students ?? [];
  const pagination = query.data?.pagination;
  const linkedSession = query.data?.linkedSession;
  const errorMessage = query.isError ? getApiErrorMessage(query.error) : '';

  const pageLabel = useMemo(() => {
    if (!pagination) return '';
    return t('recordedLectures.progressRoster.pageOf', {
      page: pagination.page,
      total: pagination.totalPages,
    });
  }, [pagination, t]);

  return (
    <section className="ft-rl-progress" aria-labelledby="ft-rl-progress-title">
      <header className="ft-rl-progress__head">
        <div>
          <h3 id="ft-rl-progress-title">{t('recordedLectures.progressRoster.title')}</h3>
          <p>
            {lecture?.title}
            {linkedSession?.title
              ? ` · ${linkedSession.title}`
              : ` · ${t('recordedLectures.progressRoster.noLinkedSession')}`}
            {linkedSession?.sessionDate ? ` · ${linkedSession.sessionDate}` : ''}
          </p>
        </div>
        <div className="ft-rl-progress__head-actions">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw size={14} aria-hidden /> {t('recordedLectures.progressRoster.refresh')}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onClose}>
            <X size={14} aria-hidden /> {t('close')}
          </Button>
        </div>
      </header>

      {refreshedAt ? (
        <p className="ft-rl-progress__meta" role="status">
          {t('recordedLectures.progressRoster.lastUpdated', {
            time: formatWhen(refreshedAt.toISOString(), i18n.language),
          })}
        </p>
      ) : null}

      {errorMessage ? <p className="form-field__error">{errorMessage}</p> : null}

      <div className="ft-rl-progress__kpis" aria-label={t('recordedLectures.progressRoster.summary')}>
        <KpiCard label={t('recordedLectures.progressRoster.totalStudents')} value={summary?.totalStudents} />
        <KpiCard label={t('recordedLectures.progressRoster.completed')} value={summary?.completed} />
        <KpiCard label={t('recordedLectures.progressRoster.notCompleted')} value={(summary?.inProgress || 0) + (summary?.notStarted || 0)} />
        <KpiCard
          label={t('recordedLectures.progressRoster.averageProgress')}
          value={summary ? `${summary.averageProgress}%` : '—'}
        />
        <KpiCard
          label={t('recordedLectures.progressRoster.linkedPresent')}
          value={summary?.linkedSessionPresent == null ? t('recordedLectures.progressRoster.na') : summary.linkedSessionPresent}
        />
        {(summary?.needsSync || 0) > 0 ? (
          <KpiCard label={t('recordedLectures.progressRoster.needsSync')} value={summary.needsSync} />
        ) : null}
      </div>

      <div className="ft-rl-progress__toolbar admin-filter-bar">
        <label className="ft-rl-progress__search">
          <span className="sr-only">{t('recordedLectures.progressRoster.search')}</span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('recordedLectures.progressRoster.searchPlaceholder')}
          />
        </label>
        <div className="ft-rl-progress__filters" role="tablist" aria-label={t('recordedLectures.progressRoster.filters')}>
          {FILTERS.map((key) => (
            <button
              key={key}
              type="button"
              className={`ft-recorded-mode${filter === key ? ' is-active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {t(`recordedLectures.progressRoster.filter.${key}`)}
            </button>
          ))}
        </div>
        <label className="ft-rl-progress__sort">
          <span>{t('recordedLectures.progressRoster.sort')}</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((key) => (
              <option key={key} value={key}>
                {t(`recordedLectures.progressRoster.sortOptions.${key}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {query.isLoading ? (
        <p className="ft-rl-progress__empty">{t('recordedLectures.progressRoster.loading')}</p>
      ) : students.length === 0 ? (
        <p className="ft-rl-progress__empty" role="status">
          {summary?.totalStudents === 0
            ? t('recordedLectures.progressRoster.emptyStudents')
            : t('recordedLectures.progressRoster.emptyFilter')}
        </p>
      ) : (
        <>
          <div className="data-table__desktop ft-rl-progress__table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">{t('recordedLectures.progressRoster.colStudent')}</th>
                  <th scope="col">{t('recordedLectures.progressRoster.colProgress')}</th>
                  <th scope="col">{t('recordedLectures.progressRoster.colLectureStatus')}</th>
                  <th scope="col">{t('recordedLectures.progressRoster.colAttendance')}</th>
                  <th scope="col">{t('recordedLectures.progressRoster.colCompletedAt')}</th>
                  <th scope="col">{t('recordedLectures.progressRoster.colLastActivity')}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((row) => (
                  <tr key={row.applicationId}>
                    <td>
                      <div className="ft-rl-progress__student">
                        <strong>{row.name || '—'}</strong>
                        {row.studentNumber ? <span>{row.studentNumber}</span> : null}
                      </div>
                    </td>
                    <td>
                      <StudentProgressBar value={row.progressPercent} showLabel />
                    </td>
                    <td>
                      <StatusBadge variant={watchVariant(row.completionStatus)}>
                        {t(`recordedLectures.progressRoster.watchStatus.${row.completionStatus}`)}
                      </StatusBadge>
                      {row.needsSync ? (
                        <span className="ft-rl-progress__sync">{t('recordedLectures.progressRoster.needsSync')}</span>
                      ) : null}
                    </td>
                    <td>
                      {!row.attendanceAvailable ? (
                        <StatusBadge variant="muted">{t('recordedLectures.progressRoster.na')}</StatusBadge>
                      ) : (
                        <StatusBadge variant={attendanceVariant(row.attendanceStatus)}>
                          {t(
                            `recordedLectures.progressRoster.attendance.${row.attendanceStatus || 'unconfirmed'}`
                          )}
                        </StatusBadge>
                      )}
                    </td>
                    <td>{formatWhen(row.completedAt, i18n.language)}</td>
                    <td>{formatWhen(row.lastProgressAt, i18n.language)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="data-table__mobile ft-rl-progress__cards">
            {students.map((row) => (
              <li key={row.applicationId} className="data-table-card">
                <div className="data-table-card__header">
                  <Users size={16} aria-hidden />
                  <div>
                    <p className="data-table-card__title">{row.name || '—'}</p>
                    {row.studentNumber ? (
                      <p className="data-table-card__subtitle">{row.studentNumber}</p>
                    ) : null}
                  </div>
                </div>
                <dl className="data-table-card__body">
                  <div className="data-table-card__row">
                    <dt>{t('recordedLectures.progressRoster.colProgress')}</dt>
                    <dd>
                      <StudentProgressBar value={row.progressPercent} showLabel />
                    </dd>
                  </div>
                  <div className="data-table-card__row">
                    <dt>{t('recordedLectures.progressRoster.colLectureStatus')}</dt>
                    <dd>
                      <StatusBadge variant={watchVariant(row.completionStatus)}>
                        {t(`recordedLectures.progressRoster.watchStatus.${row.completionStatus}`)}
                      </StatusBadge>
                    </dd>
                  </div>
                  <div className="data-table-card__row">
                    <dt>{t('recordedLectures.progressRoster.colAttendance')}</dt>
                    <dd>
                      {!row.attendanceAvailable ? (
                        t('recordedLectures.progressRoster.na')
                      ) : (
                        <StatusBadge variant={attendanceVariant(row.attendanceStatus)}>
                          {t(
                            `recordedLectures.progressRoster.attendance.${row.attendanceStatus || 'unconfirmed'}`
                          )}
                        </StatusBadge>
                      )}
                    </dd>
                  </div>
                  <div className="data-table-card__row">
                    <dt>{t('recordedLectures.progressRoster.colCompletedAt')}</dt>
                    <dd>{formatWhen(row.completedAt, i18n.language)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          {pagination && pagination.totalPages > 1 ? (
            <div className="data-table__footer ft-rl-progress__pager">
              <span>{pageLabel}</span>
              <div className="data-table__pagination">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('recordedLectures.progressRoster.prev')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('recordedLectures.progressRoster.next')}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
