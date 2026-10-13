import { useState } from 'react';
import { StatusBadge } from '../admin/StatusBadge.jsx';
import { outcomeVariant } from '../../features/auditLogs/auditPresentation.js';

const PAGE = 50;

function actorText(ev) {
  if (ev.actor?.is_self) return 'الطالب';
  return [ev.actor?.name, ev.actor?.role].filter(Boolean).join(' · ') || 'النظام';
}

/**
 * "سجل نشاط الطالب" — chronological, human-readable student activity inside a report.
 * Events come from the canonical backend timeline (no IPs, user agents, ids or raw JSON).
 */
export function StudentActivityTable({ events = [] }) {
  const [visible, setVisible] = useState(PAGE);
  if (!events.length) return <p className="crud-muted">لا يوجد نشاط مسجّل ضمن نطاق هذا التدريب.</p>;
  const shown = events.slice(0, visible);
  return (
    <div className="student-activity">
      <div className="activity-log__table-wrap">
        <table className="activity-log__table">
          <caption className="sr-only">سجل نشاط الطالب</caption>
          <thead>
            <tr>
              <th scope="col">التاريخ والوقت</th>
              <th scope="col">العملية</th>
              <th scope="col">القسم</th>
              <th scope="col">بواسطة</th>
              <th scope="col">النتيجة</th>
              <th scope="col">التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((ev) => (
              <tr key={ev.id}>
                <td className="activity-log__time">{ev.at_label}</td>
                <td>{ev.action_label}</td>
                <td>{ev.category_label}</td>
                <td>{actorText(ev)}</td>
                <td>
                  <StatusBadge variant={outcomeVariant(ev.outcome)}>{ev.outcome_label}</StatusBadge>
                </td>
                <td>{ev.details || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="activity-log__cards">
        {shown.map((ev) => (
          <li key={ev.id} className="activity-card activity-card--static">
            <span className="activity-card__top">
              <span className="activity-card__action">{ev.action_label}</span>
              <StatusBadge variant={outcomeVariant(ev.outcome)}>{ev.outcome_label}</StatusBadge>
            </span>
            <span className="activity-card__meta">
              {ev.category_label} · {ev.at_label}
            </span>
            <span className="activity-card__who">بواسطة: {actorText(ev)}</span>
            {ev.details ? <span className="activity-card__who">{ev.details}</span> : null}
          </li>
        ))}
      </ul>
      {visible < events.length ? (
        <div className="student-activity__more">
          <button type="button" className="btn btn--outline btn--sm" onClick={() => setVisible((v) => v + PAGE)}>
            عرض المزيد ({events.length - visible})
          </button>
        </div>
      ) : null}
    </div>
  );
}
