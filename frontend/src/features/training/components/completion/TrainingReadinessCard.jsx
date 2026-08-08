import { CheckCircle2, Users, Hourglass, XCircle } from 'lucide-react';

/**
 * Compact stat grid summarizing program completion readiness counts.
 * @param {{ counts: { total?: number, completed?: number, eligible?: number, notCompleted?: number, pending?: number } }} props
 */
export function TrainingReadinessCard({ counts }) {
  const c = counts || {};
  const items = [
    { key: 'total', label: 'إجمالي المتدربين', value: c.total ?? 0, icon: Users },
    { key: 'eligible', label: 'مؤهلون للإنهاء', value: c.eligible ?? 0, icon: CheckCircle2 },
    { key: 'pending', label: 'بانتظار استكمال المتطلبات', value: c.pending ?? 0, icon: Hourglass },
    { key: 'completed', label: 'أُنهيت دورتهم', value: c.completed ?? 0, icon: CheckCircle2 },
    { key: 'notCompleted', label: 'لم يُكملوا', value: c.notCompleted ?? 0, icon: XCircle },
  ];
  return (
    <div className="eval-metrics-grid">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.key} className="eval-metric-card">
            <span className="eval-metric-card__icon" aria-hidden>
              <Icon size={18} />
            </span>
            <div className="eval-metric-card__text">
              <p className="eval-metric-card__label">{item.label}</p>
              <p className="eval-metric-card__value">{item.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
