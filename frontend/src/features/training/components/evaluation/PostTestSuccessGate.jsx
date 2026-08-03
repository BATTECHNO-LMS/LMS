import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import { Button } from '../../../../components/common/Button.jsx';

/**
 * Shown right after a POST_TEST submission. Either:
 * - Grading is pending manual review (essay/short-answer questions), or
 * - The final evaluation is now unlocked and the trainee should be nudged to start it.
 *
 * @param {{
 *   result: { pendingManual?: boolean, nextAction?: string|null, finalEvaluationAvailable?: boolean, scorePercent?: number|null, passed?: boolean|null, showResults?: boolean },
 *   evaluationLinkTo?: string,
 *   onContinue?: () => void,
 * }} props
 */
export function PostTestSuccessGate({ result, evaluationLinkTo, onContinue }) {
  const pendingManual = Boolean(result?.pendingManual);
  const evaluationReady = result?.nextAction === 'FINAL_EVALUATION' || result?.finalEvaluationAvailable === true;

  if (pendingManual) {
    return (
      <div className="eval-gate eval-gate--pending" role="status">
        <span className="eval-gate__icon" aria-hidden>
          <Clock3 size={28} />
        </span>
        <StatusBadge variant="warning">بانتظار مراجعة المدرب</StatusBadge>
        <h3 className="eval-gate__title">تم تسليم الاختبار البعدي بنجاح</h3>
        <p className="eval-gate__desc">
          نتيجتك بانتظار مراجعة المدرب ورصد الدرجة. سيصلك إشعار فور اعتماد النتيجة، وقد يُتاح لك عندها استبيان
          التقييم النهائي للدورة.
        </p>
        {onContinue ? (
          <Button type="button" variant="outline" onClick={onContinue}>
            متابعة
          </Button>
        ) : null}
      </div>
    );
  }

  if (evaluationReady) {
    return (
      <div className="eval-gate eval-gate--ready" role="status">
        <span className="eval-gate__icon" aria-hidden>
          <CheckCircle2 size={28} />
        </span>
        <StatusBadge variant="success">تم اجتياز الاختبار البعدي</StatusBadge>
        <h3 className="eval-gate__title">أحسنت! أكملت الاختبار البعدي للدورة</h3>
        <p className="eval-gate__desc">
          بقي عليك تعبئة استبيان التقييم النهائي لإكمال متطلبات الدورة وإصدار الشهادة.
        </p>
        {evaluationLinkTo ? (
          <Link className="btn btn--primary" to={evaluationLinkTo}>
            بدء التقييم النهائي
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="eval-gate" role="status">
      <span className="eval-gate__icon" aria-hidden>
        <CheckCircle2 size={28} />
      </span>
      <h3 className="eval-gate__title">تم تسليم الاختبار البعدي</h3>
      {onContinue ? (
        <Button type="button" variant="outline" onClick={onContinue}>
          متابعة
        </Button>
      ) : null}
    </div>
  );
}
