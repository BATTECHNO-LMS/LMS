import { useTranslation } from 'react-i18next';
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  CheckSquare,
  CircleDot,
  Copy,
  ListChecks,
  Plus,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { Button } from '../../../../../components/common/Button.jsx';
import { FormTextarea } from '../../../../../components/forms/FormTextarea.jsx';
import { cn } from '../../../../../utils/helpers.js';
import { QUESTION_TYPES, adaptQuestionType, isQuestionIncomplete } from './assessmentQuestionBuilder.utils.js';

const TYPE_ICONS = {
  short_text: Type,
  long_text: AlignLeft,
  multiple_choice: CircleDot,
  multi_select: CheckSquare,
  true_false: ListChecks,
};

/**
 * @param {{
 *   question: object,
 *   index: number,
 *   total: number,
 *   active?: boolean,
 *   disabled?: boolean,
 *   onActivate?: () => void,
 *   onChange: (next: object) => void,
 *   onRemove: () => void,
 *   onDuplicate: () => void,
 *   onMove: (dir: -1 | 1) => void,
 * }} props
 */
export function AssessmentQuestionCard({
  question,
  index,
  total,
  active,
  disabled,
  onActivate,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
}) {
  const { t } = useTranslation('fieldTraining');
  const type = question.question_type;
  const incomplete = isQuestionIncomplete(question);
  const complete = !incomplete;
  const needsManual =
    type === 'long_text' || (type === 'short_text' && question.auto_grade === false);
  const TypeIcon = TYPE_ICONS[type] || ListChecks;

  function patch(partial) {
    onChange({ ...question, ...partial });
  }

  function setType(nextType) {
    onChange(adaptQuestionType(question, nextType));
  }

  function updateOption(optIndex, value) {
    const options = [...(question.options || [])];
    options[optIndex] = value;
    let correct_answer = question.correct_answer;
    if (type === 'multiple_choice' && correct_answer === question.options?.[optIndex]) {
      correct_answer = value;
    }
    if (type === 'multi_select' && Array.isArray(correct_answer)) {
      correct_answer = correct_answer.map((c) => (c === question.options?.[optIndex] ? value : c));
    }
    patch({ options, correct_answer });
  }

  function addOption() {
    patch({ options: [...(question.options || []), ''] });
  }

  function removeOption(optIndex) {
    const removed = question.options?.[optIndex];
    const options = (question.options || []).filter((_, i) => i !== optIndex);
    let correct_answer = question.correct_answer;
    if (type === 'multiple_choice' && correct_answer === removed) correct_answer = '';
    if (type === 'multi_select' && Array.isArray(correct_answer)) {
      correct_answer = correct_answer.filter((c) => c !== removed);
    }
    patch({ options: options.length >= 2 ? options : [...options, ''], correct_answer });
  }

  function handleRemove(e) {
    e.stopPropagation();
    if (!window.confirm(t('manageHub.assessment.confirmDeleteQuestion'))) return;
    onRemove();
  }

  function isCorrectOption(opt) {
    if (!String(opt || '').trim()) return false;
    if (type === 'multiple_choice') return question.correct_answer === opt;
    if (type === 'multi_select') {
      return Array.isArray(question.correct_answer) && question.correct_answer.includes(opt);
    }
    return false;
  }

  return (
    <article
      className={cn(
        'ft-qb-card',
        active && 'ft-qb-card--active',
        incomplete && 'ft-qb-card--incomplete',
        complete && 'ft-qb-card--complete'
      )}
      aria-label={t('manageHub.assessment.questionN', { n: index + 1 })}
      onFocusCapture={onActivate}
      onClick={onActivate}
    >
      <div className="ft-qb-card__accent" aria-hidden />
      <header className="ft-qb-card__head">
        <div className="ft-qb-card__head-main">
          <span className={cn('ft-qb-card__index', complete && 'ft-qb-card__index--ok')}>
            {complete ? <CheckCircle2 size={18} aria-hidden /> : index + 1}
          </span>
          <div className="ft-qb-card__title-wrap">
            <h4 className="ft-qb-card__title">{t('manageHub.assessment.questionN', { n: index + 1 })}</h4>
            <div className="ft-qb-card__badges">
              <span className="ft-qb-chip ft-qb-chip--type">
                <TypeIcon size={13} aria-hidden />
                {t(`manageHub.assessment.types.${type}`)}
              </span>
              {needsManual ? (
                <span className="ft-qb-chip ft-qb-chip--manual">
                  {t('manageHub.assessment.pendingManualBadge')}
                </span>
              ) : null}
              {incomplete ? (
                <span className="ft-qb-chip ft-qb-chip--warn">{t('manageHub.assessment.incompleteBadge')}</span>
              ) : (
                <span className="ft-qb-chip ft-qb-chip--ok">{t('manageHub.assessment.completeBadge')}</span>
              )}
            </div>
          </div>
        </div>

        <div className="ft-qb-card__head-actions">
          <label className="ft-qb-points-mini" title={t('manageHub.assessment.points')}>
            <span>{t('manageHub.assessment.points')}</span>
            <input
              type="number"
              min={0.5}
              step={0.5}
              className="ft-qb-input ft-qb-input--mini"
              value={question.points}
              disabled={disabled}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => patch({ points: e.target.value })}
            />
          </label>
          <label className="ft-qb-toggle" title={t('manageHub.assessment.required')}>
            <input
              type="checkbox"
              checked={question.is_required !== false}
              disabled={disabled}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => patch({ is_required: e.target.checked })}
            />
            <span>{t('manageHub.assessment.required')}</span>
          </label>
          <div className="ft-qb-card__toolbar">
            <button
              type="button"
              className="ft-qb-icon-btn"
              disabled={disabled || index === 0}
              title={t('manageHub.assessment.moveUp')}
              aria-label={t('manageHub.assessment.moveUp')}
              onClick={(e) => {
                e.stopPropagation();
                onMove(-1);
              }}
            >
              <ArrowUp size={16} />
            </button>
            <button
              type="button"
              className="ft-qb-icon-btn"
              disabled={disabled || index >= total - 1}
              title={t('manageHub.assessment.moveDown')}
              aria-label={t('manageHub.assessment.moveDown')}
              onClick={(e) => {
                e.stopPropagation();
                onMove(1);
              }}
            >
              <ArrowDown size={16} />
            </button>
            <button
              type="button"
              className="ft-qb-icon-btn"
              disabled={disabled}
              title={t('manageHub.assessment.duplicate')}
              aria-label={t('manageHub.assessment.duplicate')}
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate();
              }}
            >
              <Copy size={16} />
            </button>
            <button
              type="button"
              className="ft-qb-icon-btn ft-qb-icon-btn--danger"
              disabled={disabled}
              title={t('manageHub.assessment.removeQuestion')}
              aria-label={t('manageHub.assessment.removeQuestion')}
              onClick={handleRemove}
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="ft-qb-card__body">
        <div className="ft-qb-card__grid">
          <FormTextarea
            label={t('manageHub.assessment.questionText')}
            value={question.question_text}
            onChange={(e) => patch({ question_text: e.target.value })}
            rows={3}
            disabled={disabled}
            required
            className="ft-qb-form-control"
          />
          <div className="ft-qb-field">
            <label className="ft-qb-field__label" htmlFor={`q-type-${question.clientKey}`}>
              {t('manageHub.assessment.questionType')}
            </label>
            <div className="ft-qb-select-wrap">
              <TypeIcon className="ft-qb-select-wrap__icon" size={16} aria-hidden />
              <select
                id={`q-type-${question.clientKey}`}
                className="ft-qb-select ft-qb-select--with-icon"
                value={type}
                disabled={disabled}
                onChange={(e) => setType(e.target.value)}
              >
                {QUESTION_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {t(`manageHub.assessment.types.${value}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="ft-qb-type-panel" key={type}>
          {type === 'short_text' ? (
            <div className="ft-qb-block">
              <p className="ft-qb-block__label">{t('manageHub.assessment.acceptedAnswers')}</p>
              {(question.accepted_answers || ['']).map((ans, ai) => (
                <div key={ai} className="ft-qb-option-row">
                  <input
                    className="ft-qb-input"
                    value={ans}
                    disabled={disabled}
                    placeholder={t('manageHub.assessment.acceptedAnswerPh')}
                    onChange={(e) => {
                      const accepted_answers = [...(question.accepted_answers || [''])];
                      accepted_answers[ai] = e.target.value;
                      patch({ accepted_answers });
                    }}
                  />
                  <button
                    type="button"
                    className="ft-qb-icon-btn"
                    disabled={disabled || (question.accepted_answers || []).length <= 1}
                    title={t('manageHub.assessment.removeOption')}
                    aria-label={t('manageHub.assessment.removeOption')}
                    onClick={() =>
                      patch({
                        accepted_answers: (question.accepted_answers || []).filter((_, i) => i !== ai),
                      })
                    }
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                className="ft-qb-add-option"
                disabled={disabled}
                onClick={() => patch({ accepted_answers: [...(question.accepted_answers || []), ''] })}
              >
                <Plus size={16} /> {t('manageHub.assessment.addAcceptedAnswer')}
              </Button>
              <label className="ft-qb-toggle">
                <input
                  type="checkbox"
                  checked={question.auto_grade !== false}
                  disabled={disabled}
                  onChange={(e) => patch({ auto_grade: e.target.checked })}
                />
                <span>{t('manageHub.assessment.autoGrade')}</span>
              </label>
              {question.auto_grade === false ? (
                <p className="ft-qb-hint">{t('manageHub.assessment.manualGradeHint')}</p>
              ) : null}
            </div>
          ) : null}

          {type === 'long_text' ? (
            <div className="ft-qb-block">
              <FormTextarea
                label={t('manageHub.assessment.sampleAnswer')}
                value={question.sample_answer || ''}
                onChange={(e) => patch({ sample_answer: e.target.value })}
                rows={5}
                disabled={disabled}
                className="ft-qb-form-control ft-qb-form-control--tall"
              />
              <p className="ft-qb-hint">{t('manageHub.assessment.longTextManual')}</p>
            </div>
          ) : null}

          {type === 'multiple_choice' || type === 'multi_select' ? (
            <div className="ft-qb-block">
              <p className="ft-qb-block__label">{t('manageHub.assessment.optionsList')}</p>
              {(question.options || []).map((opt, oi) => {
                const correct = isCorrectOption(opt);
                return (
                  <div
                    key={oi}
                    className={cn('ft-qb-option-row', correct && 'ft-qb-option-row--correct')}
                  >
                    {type === 'multiple_choice' ? (
                      <input
                        type="radio"
                        className="ft-qb-option-mark"
                        name={`correct-${question.clientKey}`}
                        checked={correct}
                        disabled={disabled || !String(opt).trim()}
                        onChange={() => patch({ correct_answer: opt })}
                        aria-label={t('manageHub.assessment.markCorrect')}
                      />
                    ) : (
                      <input
                        type="checkbox"
                        className="ft-qb-option-mark"
                        checked={correct}
                        disabled={disabled || !String(opt).trim()}
                        onChange={(e) => {
                          const current = Array.isArray(question.correct_answer)
                            ? [...question.correct_answer]
                            : [];
                          patch({
                            correct_answer: e.target.checked
                              ? [...current.filter((c) => c !== opt), opt]
                              : current.filter((c) => c !== opt),
                          });
                        }}
                        aria-label={t('manageHub.assessment.markCorrect')}
                      />
                    )}
                    <input
                      className="ft-qb-input"
                      value={opt}
                      disabled={disabled}
                      placeholder={t('manageHub.assessment.optionPh', { n: oi + 1 })}
                      onChange={(e) => updateOption(oi, e.target.value)}
                    />
                    {correct ? (
                      <span className="ft-qb-option-correct-tag" aria-hidden>
                        <Check size={12} />
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="ft-qb-icon-btn"
                      disabled={disabled || (question.options || []).length <= 2}
                      title={t('manageHub.assessment.removeOption')}
                      aria-label={t('manageHub.assessment.removeOption')}
                      onClick={() => removeOption(oi)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="secondary"
                className="ft-qb-add-option"
                disabled={disabled}
                onClick={addOption}
              >
                <Plus size={16} /> {t('manageHub.assessment.addOption')}
              </Button>
            </div>
          ) : null}

          {type === 'true_false' ? (
            <div className="ft-qb-block">
              <p className="ft-qb-block__label">{t('manageHub.assessment.correctAnswer')}</p>
              <div className="ft-qb-tf" role="radiogroup">
                {['true', 'false'].map((opt) => {
                  const selected = question.correct_answer === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={disabled}
                      className={cn('ft-qb-tf__option', selected && 'ft-qb-tf__option--active')}
                      onClick={() => patch({ correct_answer: opt })}
                    >
                      <span className="ft-qb-tf__check" aria-hidden>
                        {selected ? <Check size={16} /> : null}
                      </span>
                      <span>
                        {opt === 'true'
                          ? t('manageHub.assessment.trueLabel')
                          : t('manageHub.assessment.falseLabel')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
