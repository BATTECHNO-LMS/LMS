/**
 * @param {{ title?: string, description?: string, action?: React.ReactNode }} props
 */
export function EvaluationSuccessState({
  title = 'تم إرسال التقييم النهائي بنجاح',
  description = 'شكرًا لمشاركتنا رأيك. ساعدتنا ملاحظاتك على تحسين جودة الدورات التدريبية القادمة.',
  action,
}) {
  return (
    <div className="eval-success" role="status">
      <span className="eval-success__check" aria-hidden>
        <svg viewBox="0 0 52 52" className="eval-success__check-svg">
          <circle className="eval-success__check-circle" cx="26" cy="26" r="24" fill="none" />
          <path className="eval-success__check-mark" fill="none" d="M14 27l7 7 16-16" />
        </svg>
      </span>
      <h3 className="eval-success__title">{title}</h3>
      {description ? <p className="eval-success__desc">{description}</p> : null}
      {action ? <div className="eval-success__action">{action}</div> : null}
    </div>
  );
}
