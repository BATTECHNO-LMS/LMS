import { cn } from '../../../../utils/helpers.js';

/**
 * @param {{
 *   question: { id: string, prompt: string, isRequired?: boolean, maxLength?: number },
 *   value?: string|null,
 *   onChange: (value: string) => void,
 *   error?: string,
 *   disabled?: boolean,
 * }} props
 */
export function OpenTextQuestion({ question, value, onChange, error, disabled }) {
  const maxLength = question.maxLength || 2000;
  const text = value || '';

  return (
    <div className={cn('eval-question', error && 'eval-question--error')}>
      <label className="eval-question__prompt" htmlFor={`eval-q-${question.id}`}>
        {question.prompt}
        {question.isRequired ? (
          <span className="eval-question__required" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <textarea
        id={`eval-q-${question.id}`}
        className="eval-question__textarea"
        rows={4}
        maxLength={maxLength}
        value={text}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="eval-question__counter">
        {text.length}/{maxLength}
      </div>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
