import { Check, X, Clock3 } from 'lucide-react';
import { cn } from '../../../../utils/helpers.js';

const REQUIREMENT_LABELS = {
  attendance: 'نسبة الحضور',
  hours: 'الساعات التدريبية',
  tasks: 'المهمات المطلوبة',
  preTest: 'الاختبار القبلي',
  postTest: 'الاختبار البعدي',
  finalTask: 'المهمة النهائية',
  evaluation: 'التقييم النهائي',
};

function requirementIcon(req) {
  if (req.pendingManual) return <Clock3 size={16} />;
  return req.ok ? <Check size={16} /> : <X size={16} />;
}

function requirementDetail(code, req) {
  if (code === 'attendance') return `${req.value ?? 0}% (المطلوب ${req.required ?? 0}%)`;
  if (code === 'hours') return req.required ? `${req.value ?? 0} من ${req.required} ساعة` : `${req.value ?? 0} ساعة`;
  if (code === 'tasks') return req.required ? `${req.value ?? 0} من ${req.required}` : 'غير مطلوبة';
  if (req.pendingManual) return 'بانتظار مراجعة المدرب';
  if (code === 'evaluation') return req.status === 'LOCKED' ? 'مقفل حتى اجتياز الاختبار البعدي' : req.submitted ? 'تم الإرسال' : 'لم يُرسل بعد';
  return req.ok ? 'مكتمل' : 'غير مكتمل';
}

/**
 * Renders the per-requirement completion checklist (attendance, hours, tasks,
 * pre/post test, final task, evaluation) from the requirements snapshot
 * produced by the backend eligibility/progress computation.
 * @param {{ requirements: Record<string, object> }} props
 */
export function CompletionRequirementList({ requirements }) {
  const entries = Object.entries(requirements || {}).filter(([, req]) => req && req.required !== false);
  if (!entries.length) {
    return <p className="eval-req-list__empty">لا توجد متطلبات محددة لهذه الدورة.</p>;
  }
  return (
    <ul className="eval-req-list">
      {entries.map(([code, req]) => (
        <li
          key={code}
          className={cn(
            'eval-req-list__item',
            req.ok ? 'eval-req-list__item--ok' : req.pendingManual ? 'eval-req-list__item--pending' : 'eval-req-list__item--missing'
          )}
        >
          <span className="eval-req-list__icon" aria-hidden>
            {requirementIcon(req)}
          </span>
          <span className="eval-req-list__label">{REQUIREMENT_LABELS[code] || code}</span>
          <span className="eval-req-list__detail">{requirementDetail(code, req)}</span>
        </li>
      ))}
    </ul>
  );
}
