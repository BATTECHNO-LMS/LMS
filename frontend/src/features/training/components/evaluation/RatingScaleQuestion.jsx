import { cn } from '../../../../utils/helpers.js';
import { RATING_LABELS_AR, ratingScaleOptions, resolveRatingLabel } from './ratingLabels.js';

/**
 * Accessible 1-5 (or custom range) Likert rating question with Arabic chip labels.
 * @param {{
 *   question: { id: string, prompt: string, isRequired?: boolean, scaleMin?: number, scaleMax?: number, scaleLabels?: object },
 *   value?: number|string|null,
 *   onChange: (value: number) => void,
 *   error?: string,
 *   disabled?: boolean,
 * }} props
 */
export function RatingScaleQuestion({ question, value, onChange, error, disabled }) {
  const options = ratingScaleOptions(question.scaleMin ?? 1, question.scaleMax ?? 5);
  const labels =
    question.scaleLabels && typeof question.scaleLabels === 'object' ? question.scaleLabels : RATING_LABELS_AR;

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
      <div className="eval-rating-chips" role="radiogroup" aria-label={question.prompt}>
        {options.map((n) => {
          const selected = value != null && String(value) === String(n);
          return (
            <label key={n} className={cn('eval-rating-chip', selected && 'eval-rating-chip--selected')}>
              <input
                type="radio"
                name={`eval-q-${question.id}`}
                value={n}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(n)}
              />
              <span className="eval-rating-chip__value">{n}</span>
              <span className="eval-rating-chip__label">{resolveRatingLabel(n, labels)}</span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
