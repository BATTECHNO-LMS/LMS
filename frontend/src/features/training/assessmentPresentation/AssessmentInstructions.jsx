import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Expandable assessment instructions — Backend text only, no invented rules.
 */
export function AssessmentInstructions({ instructions, title = 'تعليمات الاختبار' }) {
  const [open, setOpen] = useState(Boolean(instructions));

  if (!instructions) return null;

  return (
    <section className="ta-instructions">
      <button
        type="button"
        className="ta-instructions__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        {open ? <ChevronUp size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
      </button>
      {open ? (
        <div className="ta-instructions__body">
          <p className="ta-instructions__text">{instructions}</p>
        </div>
      ) : null}
    </section>
  );
}
