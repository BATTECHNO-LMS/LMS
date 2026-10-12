import { useEffect, useRef } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function StageDetailsModal({ stage, onClose, returnFocusTo }) {
  const backRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !backRef.current) return;
      const focusable = [...backRef.current.querySelectorAll(FOCUSABLE)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocusTo?.focus?.();
    };
  }, [onClose, returnFocusTo]);

  return (
    <div
      ref={backRef}
      className="ij-modal-back"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ij-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ij-modal">
        <button ref={closeRef} type="button" className="ij-close" aria-label="إغلاق" onClick={onClose}>
          ×
        </button>
        <div className="ij-eyebrow">MISSION DETAILS</div>
        <h2 id="ij-modal-title">
          {stage.name} — {stage.title}
        </h2>
        <div>
          <p className="ij-modal-desc">{stage.desc}</p>
          <h3>🎯 التحديات العملية والإثباتات المطلوبة</h3>
          <ol>
            {stage.tasks.map((task) => (
              <li key={task}>{task}</li>
            ))}
          </ol>
          <p className="ij-highlight">
            {stage.hours
              ? `الساعات المخططة لهذه المحطة: ${stage.hours} ساعة`
              : 'المراجعة والتقييم محسوبان ضمن ساعات المراحل السابقة؛ لا توجد ساعات مضافة.'}
          </p>
        </div>
        <button type="button" className="ij-btn" onClick={onClose}>
          تمام، فهمت! 🌟
        </button>
      </div>
    </div>
  );
}
