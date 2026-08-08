import { CalendarClock, CalendarX2 } from 'lucide-react';

/**
 * Availability window: opens / closes dates in Jordan timezone Arabic format.
 */
export function AssessmentAvailability({ opensAtLabel, closesAtLabel, title = 'فترة إتاحة الاختبار' }) {
  return (
    <section className="ta-availability" aria-labelledby="ta-availability-title">
      <h3 id="ta-availability-title" className="ta-section-title">
        {title}
      </h3>
      <div className="ta-availability__grid">
        <div className="ta-availability__card">
          <span className="ta-availability__icon" aria-hidden>
            <CalendarClock size={18} strokeWidth={2} />
          </span>
          <div>
            <p className="ta-availability__label">يفتح في</p>
            <p className="ta-availability__value" dir="rtl">
              {opensAtLabel || 'غير محدد'}
            </p>
          </div>
        </div>
        <div className="ta-availability__card">
          <span className="ta-availability__icon" aria-hidden>
            <CalendarX2 size={18} strokeWidth={2} />
          </span>
          <div>
            <p className="ta-availability__label">يغلق في</p>
            <p className="ta-availability__value" dir="rtl">
              {closesAtLabel || 'غير محدد'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
