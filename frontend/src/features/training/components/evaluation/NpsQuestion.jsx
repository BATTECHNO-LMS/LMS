import { cn } from '../../../../utils/helpers.js';

const OPTIONS = Array.from({ length: 11 }, (_, i) => i);

/**
 * 0-10 net-promoter-score question.
 * @param {{
 *   question: { id: string, prompt: string, isRequired?: boolean },
 *   value?: number|string|null,
 *   onChange: (value: number) => void,
 *   error?: string,
 *   disabled?: boolean,
 * }} props
 */
export function NpsQuestion({ question, value, onChange, error, disabled }) {
  return (
    <fieldset className={cn('eval-question', error && 'eval-question--error')} aria-invalid={Boolean(error)}>
      <legend className="eval-question__prompt">
        {question.prompt}
        {question.isRequired ? (
          <span className="eval-question__required" aria-hidden>
            *
          </span>
        ) : null}
      </legend>
      <div className="eval-nps-row" role="radiogroup" aria-label={question.prompt}>
        {OPTIONS.map((n) => {
          const selected = value != null && String(value) === String(n);
          return (
            <label key={n} className={cn('eval-nps-chip', selected && 'eval-nps-chip--selected')}>
              <input
                type="radio"
                name={`eval-q-${question.id}`}
                value={n}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(n)}
              />
              <span>{n}</span>
            </label>
          );
        })}
      </div>
      <div className="eval-nps-scale-labels">
        <span>غير محتمل إطلاقًا</span>
        <span>محتمل جدًا</span>
      </div>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
