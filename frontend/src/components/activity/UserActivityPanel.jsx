import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, History, MonitorSmartphone } from 'lucide-react';
import { StatusBadge } from '../admin/StatusBadge.jsx';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal.jsx';
import {
  fetchUserActivityTimeline,
  fetchUserSessions,
  revokeUserSession,
} from '../../features/auditLogs/auditLogs.service.js';
import {
  formatAuditDateTime,
  outcomeVariant,
  sessionStatusLabel,
} from '../../features/auditLogs/auditPresentation.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

const PAGE_SIZE = 25;

/**
 * Human-readable activity history for one user: what they did and what was done to them,
 * newest first. No IPs, user agents, session ids, raw JSON or UUIDs are rendered.
 */
export function UserActivityTimeline({ userId, opportunityId, courseId, title = 'سجل النشاط' }) {
  const [page, setPage] = useState(1);
  const params = {
    page,
    page_size: PAGE_SIZE,
    ...(opportunityId ? { opportunity_id: opportunityId } : {}),
    ...(courseId ? { course_id: courseId } : {}),
  };
  const q = useQuery({
    queryKey: ['audit-logs', 'timeline', userId, params],
    queryFn: () => fetchUserActivityTimeline(userId, params),
    enabled: Boolean(userId),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const events = q.data?.events ?? [];
  const totalPages = q.data?.meta?.total_pages ?? 1;

  return (
    <section className="activity-timeline" aria-labelledby={`timeline-${userId}`}>
      <header className="activity-timeline__head">
        <h3 id={`timeline-${userId}`}>
          <History size={18} aria-hidden /> {title}
        </h3>
        {q.data?.meta?.total != null ? (
          <span className="activity-log__count">{q.data.meta.total}</span>
        ) : null}
      </header>
      {q.isLoading ? <p className="crud-muted">جارٍ التحميل…</p> : null}
      {q.isError ? (
        <p className="activity-log__state--error" role="alert">
          {getApiErrorMessage(q.error, 'تعذر تحميل سجل النشاط.')}
        </p>
      ) : null}
      {!q.isLoading && !q.isError && !events.length ? <p className="crud-muted">لا يوجد نشاط مسجّل.</p> : null}
      {events.length ? (
        <ol className="activity-timeline__list">
          {events.map((ev) => (
            <li key={ev.id} className="activity-timeline__item">
              <span className={`activity-timeline__dot activity-timeline__dot--${outcomeVariant(ev.outcome)}`} aria-hidden />
              <div className="activity-timeline__body">
                <div className="activity-timeline__top">
                  <strong>{ev.action_label}</strong>
                  <StatusBadge variant={outcomeVariant(ev.outcome)}>{ev.outcome_label}</StatusBadge>
                </div>
                <p className="activity-timeline__meta">
                  <time dateTime={ev.at}>{ev.at_label || formatAuditDateTime(ev.at)}</time>
                  <span> · {ev.category_label}</span>
                  <span>
                    {' '}
                    · بواسطة: {ev.actor?.is_self ? 'المستخدم نفسه' : [ev.actor?.name, ev.actor?.role].filter(Boolean).join(' · ')}
                  </span>
                </p>
                {ev.details ? <p className="activity-timeline__details">{ev.details}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {totalPages > 1 ? (
        <nav className="activity-log__pager" aria-label="ترقيم صفحات سجل النشاط">
          <button
            type="button"
            className="btn btn--outline btn--sm"
            disabled={page <= 1 || q.isFetching}
            onClick={() => setPage((p) => p - 1)}
            aria-label="الصفحة السابقة"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
          <span>
            صفحة {page} من {totalPages}
          </span>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            disabled={page >= totalPages || q.isFetching}
            onClick={() => setPage((p) => p + 1)}
            aria-label="الصفحة التالية"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
        </nav>
      ) : null}
    </section>
  );
}

/** Per-device sessions of one user. Admins can end one specific session; there is no "end all". */
export function UserSessionsList({ userId, canRevoke = false }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState(null);
  const q = useQuery({
    queryKey: ['audit-logs', 'sessions', userId],
    queryFn: () => fetchUserSessions(userId),
    enabled: Boolean(userId),
    staleTime: 15_000,
  });
  const revoke = useMutation({
    mutationFn: (sessionId) => revokeUserSession(sessionId),
    onSuccess: () => {
      setTarget(null);
      qc.invalidateQueries({ queryKey: ['audit-logs', 'sessions', userId] });
      qc.invalidateQueries({ queryKey: ['audit-logs', 'timeline', userId] });
    },
  });
  const sessions = q.data?.sessions ?? [];

  return (
    <section className="activity-sessions" aria-labelledby={`sessions-${userId}`}>
      <header className="activity-timeline__head">
        <h3 id={`sessions-${userId}`}>
          <MonitorSmartphone size={18} aria-hidden /> الجلسات
        </h3>
        <Link className="btn btn--ghost btn--sm" to={`/admin/audit-logs?involvingUserId=${userId}&category=AUTH`}>
          عرض في سجل النشاط
        </Link>
      </header>
      {q.isLoading ? <p className="crud-muted">جارٍ التحميل…</p> : null}
      {q.isError ? (
        <p className="activity-log__state--error" role="alert">
          {getApiErrorMessage(q.error, 'تعذر تحميل الجلسات.')}
        </p>
      ) : null}
      {!q.isLoading && !q.isError && !sessions.length ? <p className="crud-muted">لا توجد جلسات مسجّلة.</p> : null}
      {sessions.length ? (
        <div className="activity-log__table-wrap activity-log__table-wrap--always">
          <table className="activity-log__table activity-sessions__table">
            <thead>
              <tr>
                <th scope="col">بدأت</th>
                <th scope="col">آخر نشاط</th>
                <th scope="col">انتهت</th>
                <th scope="col">الحالة</th>
                {canRevoke ? (
                  <th scope="col">
                    <span className="sr-only">إجراء</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{formatAuditDateTime(s.created_at)}</td>
                  <td>{formatAuditDateTime(s.last_activity_at)}</td>
                  <td>{s.ended_at ? formatAuditDateTime(s.ended_at) : '—'}</td>
                  <td>
                    <StatusBadge variant={s.is_active ? 'success' : 'muted'}>{sessionStatusLabel(s)}</StatusBadge>
                  </td>
                  {canRevoke ? (
                    <td>
                      {s.is_active ? (
                        <button type="button" className="btn btn--outline btn--sm" onClick={() => setTarget(s)}>
                          إنهاء هذه الجلسة
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <ConfirmDeleteModal
        open={Boolean(target)}
        title="إنهاء الجلسة"
        message="سيتم تسجيل خروج المستخدم من هذا الجهاز فقط. هل تريد المتابعة؟"
        confirmLabel="إنهاء الجلسة"
        cancelLabel="إلغاء"
        busy={revoke.isPending}
        onClose={() => setTarget(null)}
        onConfirm={() => target && revoke.mutate(target.id)}
      />
    </section>
  );
}
