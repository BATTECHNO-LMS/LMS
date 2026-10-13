import { StatusBadge } from '../admin/StatusBadge.jsx';
import {
  actionLabel,
  actorLabel,
  describeValueChanges,
  formatAuditDateTime,
  outcomeVariant,
  subjectLabel,
} from '../../features/auditLogs/auditPresentation.js';

function Row({ label, children }) {
  if (children == null || children === '') return null;
  return (
    <div className="audit-detail__row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function RawJson({ value }) {
  if (value == null) return <p className="crud-muted">—</p>;
  let text;
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  return (
    <pre className="audit-detail__json" dir="ltr">
      {text}
    </pre>
  );
}

/**
 * Human-readable audit event. Raw codes, ids and request metadata are shown only to
 * system-wide administrators (`showTechnical`), and only when the backend included them.
 */
export function AuditEventDetails({ row, showTechnical = false, onFilterSession }) {
  if (!row) return null;
  const changes = describeValueChanges(row.old_values, row.new_values);
  const subject = subjectLabel(row);
  return (
    <div className="audit-detail">
      <div className="audit-detail__hero">
        <StatusBadge variant={outcomeVariant(row.outcome)}>{row.outcome_label || 'ناجحة'}</StatusBadge>
        <h3 className="audit-detail__action">{actionLabel(row, { showRaw: showTechnical })}</h3>
        <p className="audit-detail__time">{formatAuditDateTime(row.created_at)}</p>
      </div>

      <dl className="audit-detail__grid">
        <Row label="القسم">{row.category_label}</Row>
        <Row label="بواسطة">{actorLabel(row)}</Row>
        <Row label="المستخدم المتأثر">{subject}</Row>
        <Row label="الجامعة">{row.university?.name}</Row>
        <Row label="الجهة">{row.organization?.name}</Row>
      </dl>

      {changes.length ? (
        <section className="audit-detail__section">
          <h4>التفاصيل</h4>
          <table className="audit-detail__changes">
            <thead>
              <tr>
                <th scope="col">الحقل</th>
                <th scope="col">قبل</th>
                <th scope="col">بعد</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.key}>
                  <th scope="row">{c.label}</th>
                  <td>{c.before ?? '—'}</td>
                  <td>{c.after ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {showTechnical ? (
        <section className="audit-detail__section audit-detail__section--technical">
          <h4>بيانات تقنية (لمدير النظام فقط)</h4>
          <dl className="audit-detail__grid audit-detail__grid--mono">
            <Row label="رمز العملية">
              <code dir="ltr">{row.action_type}</code>
            </Row>
            <Row label="نوع الكيان">
              {row.entity_type ? <code dir="ltr">{row.entity_type}</code> : null}
            </Row>
            <Row label="معرّف الكيان">
              {row.entity_id ? <code dir="ltr">{row.entity_id}</code> : null}
            </Row>
            <Row label="معرّف الطلب">
              {row.request_id ? <code dir="ltr">{row.request_id}</code> : null}
            </Row>
            <Row label="معرّف الجلسة">
              {row.session_id ? (
                <span className="audit-detail__inline">
                  <code dir="ltr">{row.session_id}</code>
                  {onFilterSession ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => onFilterSession(row.session_id)}>
                      أحداث هذه الجلسة
                    </button>
                  ) : null}
                </span>
              ) : null}
            </Row>
            <Row label="عنوان IP">{row.ip_address ? <code dir="ltr">{row.ip_address}</code> : null}</Row>
            <Row label="المتصفح">{row.user_agent ? <span dir="ltr">{row.user_agent}</span> : null}</Row>
          </dl>
          <h5>القيم السابقة</h5>
          <RawJson value={row.old_values} />
          <h5>القيم الجديدة</h5>
          <RawJson value={row.new_values} />
        </section>
      ) : null}
    </div>
  );
}
