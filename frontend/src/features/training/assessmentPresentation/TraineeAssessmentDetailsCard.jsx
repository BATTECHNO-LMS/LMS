import { Clock, HelpCircle, RotateCcw, Target } from 'lucide-react';
import { AssessmentHeader } from './AssessmentHeader.jsx';
import { AssessmentMetricCard } from './AssessmentMetricCard.jsx';
import { AssessmentAvailability } from './AssessmentAvailability.jsx';
import { AssessmentResultCard } from './AssessmentResultCard.jsx';
import { AssessmentPrimaryAction } from './AssessmentPrimaryAction.jsx';
import { AssessmentInstructions } from './AssessmentInstructions.jsx';
import { buildAssessmentMetrics, mapTraineeAssessment } from './mapTraineeAssessment.js';

const METRIC_ICONS = {
  duration: Clock,
  questions: HelpCircle,
  attempts: RotateCcw,
  passScore: Target,
};

/**
 * Shared trainee assessment details presentation.
 * Accepts raw Backend assessment-status item + optional course context.
 * Compatible with TRAINING_COURSE (and future FIELD_TRAINING via programType context only).
 */
export function TraineeAssessmentDetailsCard({
  item,
  courseTitle,
  programType = 'TRAINING_COURSE',
  onStart,
  busy = false,
}) {
  const mapped = mapTraineeAssessment(item, { courseTitle, programType });
  if (!mapped) return null;

  const metrics = buildAssessmentMetrics(mapped);

  return (
    <article className="ta-assessment-card" dir="rtl" data-program-type={mapped.programType}>
      <AssessmentHeader
        title={mapped.title}
        typeBadgeLabel={mapped.typeBadgeLabel}
        statusBadge={mapped.statusBadge}
        description={mapped.description}
        courseTitle={mapped.courseTitle}
      />

      <div className="ta-metrics-grid" role="group" aria-label="ملخص الاختبار">
        {metrics.map((m) => (
          <AssessmentMetricCard
            key={m.key}
            label={m.label}
            value={m.value}
            icon={METRIC_ICONS[m.key]}
          />
        ))}
      </div>

      <AssessmentAvailability
        opensAtLabel={mapped.opensAtLabel}
        closesAtLabel={mapped.closesAtLabel}
      />

      <AssessmentResultCard
        resultMode={mapped.resultMode}
        score={mapped.score}
        passScore={mapped.passScore}
        passed={mapped.passed}
        showResults={mapped.showResults}
        exhausted={mapped.exhausted}
      />

      <AssessmentPrimaryAction
        action={mapped.action}
        busy={busy}
        onStart={() => onStart?.(item)}
      />

      <AssessmentInstructions instructions={mapped.instructions} />
    </article>
  );
}

/**
 * Loading skeleton matching header + metrics + availability + action layout.
 */
export function TraineeAssessmentDetailsSkeleton() {
  return (
    <div className="ta-assessment-skeleton" dir="rtl" aria-busy="true" aria-label="جاري التحميل">
      <div className="ta-skel ta-skel--title" />
      <div className="ta-skel ta-skel--badges" />
      <div className="ta-metrics-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="ta-skel ta-skel--metric" />
        ))}
      </div>
      <div className="ta-skel ta-skel--block" />
      <div className="ta-skel ta-skel--block ta-skel--short" />
    </div>
  );
}
