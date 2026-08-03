import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppModal } from '../../../../components/designSystem/AppModal.jsx';
import { Button } from '../../../../components/common/Button.jsx';
import { FormSelect } from '../../../../components/forms/FormSelect.jsx';
import { FormTextarea } from '../../../../components/forms/FormTextarea.jsx';
import { LoadingSpinner } from '../../../../components/common/LoadingSpinner.jsx';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';
import { getCompletionReadiness, finalizeTraining } from '../../training.service.js';
import { TrainingReadinessCard } from './TrainingReadinessCard.jsx';
import { CompletionStatusBadge } from './CompletionStatusBadge.jsx';

/**
 * Admin/trainer finalization dialog: readiness summary, optional cohort filter,
 * "إنهاء المستوفين فقط" (eligible-only) and — for institution admins — an
 * "إنهاء استثنائي" (exceptional) path that requires a reason and can target
 * specific trainees.
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   programId: string,
 *   cohorts?: { id: string, name: string }[],
 *   canExceptional?: boolean,
 *   onFinalized?: (result: object) => void,
 * }} props
 */
export function TrainingFinalizationModal({ open, onClose, programId, cohorts = [], canExceptional = false, onFinalized }) {
  const [cohortId, setCohortId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [readiness, setReadiness] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // 'ELIGIBLE_ONLY' | 'EXCEPTIONAL' | null
  const [reason, setReason] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [resultSummary, setResultSummary] = useState(null);

  const load = useCallback(async () => {
    if (!open || !programId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getCompletionReadiness(programId, { cohortId: cohortId || undefined });
      setReadiness(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر تحميل جاهزية إنهاء التدريب.'));
      setReadiness(null);
    } finally {
      setLoading(false);
    }
  }, [open, programId, cohortId]);

  useEffect(() => {
    if (open) {
      load();
    } else {
      setPendingAction(null);
      setActionError('');
      setResultSummary(null);
      setReason('');
      setSelectedIds([]);
    }
  }, [open, load]);

  const trainees = readiness?.trainees || [];
  const eligibleList = useMemo(
    () => trainees.filter((t) => t.eligible && t.enrollmentStatus !== 'COMPLETED'),
    [trainees]
  );
  const notEligibleList = useMemo(
    () => trainees.filter((t) => !t.eligible && !['COMPLETED', 'WITHDRAWN'].includes(t.enrollmentStatus)),
    [trainees]
  );

  function toggleSelected(enrollmentId) {
    setSelectedIds((prev) =>
      prev.includes(enrollmentId) ? prev.filter((id) => id !== enrollmentId) : [...prev, enrollmentId]
    );
  }

  async function runFinalize(mode) {
    setBusy(true);
    setActionError('');
    try {
      const body = { mode };
      if (cohortId) body.cohortId = cohortId;
      if (mode === 'EXCEPTIONAL') {
        body.reason = reason.trim();
        if (selectedIds.length) body.enrollmentIds = selectedIds;
      }
      const result = await finalizeTraining(programId, body);
      setResultSummary(result);
      setPendingAction(null);
      setReason('');
      setSelectedIds([]);
      onFinalized?.(result);
      await load();
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'تعذر إنهاء التدريب.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="إنهاء التدريب والتقارير"
      description="راجع جاهزية المتدربين قبل إنهاء الدورة، ثم اختر مسار الإنهاء المناسب."
      size="lg"
      dismissible={!busy}
      closeOnOverlay={!busy}
      footer={
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
          إغلاق
        </Button>
      }
    >
      {cohorts.length ? (
        <FormSelect id="finalize-cohort" label="الدفعة (اختياري)" value={cohortId} onChange={(e) => setCohortId(e.target.value)}>
          <option value="">كل الدفعات</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </FormSelect>
      ) : null}

      {loading ? (
        <LoadingSpinner label="جاري تحميل الجاهزية" />
      ) : error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : readiness ? (
        <>
          <TrainingReadinessCard counts={readiness.counts} />

          {resultSummary ? (
            <div className="eval-finalize-result" role="status">
              <StatusBadge variant="success">تم تنفيذ الإنهاء</StatusBadge>
              <p>
                تم إنهاء {resultSummary.eligibleCompleted?.length || 0} متدرب مؤهل
                {resultSummary.exceptionalCompleted?.length ? ` و${resultSummary.exceptionalCompleted.length} استثنائيًا` : ''}
                {resultSummary.skipped?.length ? ` — تم تخطي ${resultSummary.skipped.length}.` : '.'}
              </p>
            </div>
          ) : null}

          {actionError ? (
            <p className="form-field__error" role="alert">
              {actionError}
            </p>
          ) : null}

          <section className="eval-finalize-section">
            <h4 className="eval-finalize-section__title">إنهاء المستوفين فقط</h4>
            <p className="eval-finalize-section__desc">
              يُنهي تدريب كل متدرب استوفى جميع متطلبات الدورة ({eligibleList.length} متدرب مؤهل حاليًا) ويصدر شهاداتهم
              تلقائيًا إن كانت مفعّلة.
            </p>
            {pendingAction === 'ELIGIBLE_ONLY' ? (
              <div className="eval-finalize-confirm">
                <p>هل تريد إنهاء تدريب {eligibleList.length} متدرب مؤهل؟</p>
                <div className="eval-finalize-confirm__actions">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setPendingAction(null)}>
                    تراجع
                  </Button>
                  <Button type="button" variant="primary" loading={busy} onClick={() => runFinalize('ELIGIBLE_ONLY')}>
                    نعم، تأكيد الإنهاء
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                disabled={busy || !eligibleList.length}
                onClick={() => setPendingAction('ELIGIBLE_ONLY')}
              >
                إنهاء المستوفين فقط
              </Button>
            )}
          </section>

          {canExceptional ? (
            <section className="eval-finalize-section eval-finalize-section--exceptional">
              <h4 className="eval-finalize-section__title">إنهاء استثنائي</h4>
              <p className="eval-finalize-section__desc">
                يُنهي تدريب متدربين لم يستوفوا كل المتطلبات ({notEligibleList.length} متدرب غير مؤهل) مع تسجيل سبب
                الاستثناء في السجل. اختر متدربين محددين، أو اترك التحديد فارغًا لتطبيقه على الجميع ضمن النطاق الحالي.
              </p>
              {notEligibleList.length ? (
                <ul className="eval-finalize-trainee-list">
                  {notEligibleList.map((t) => (
                    <li key={t.enrollmentId}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.enrollmentId)}
                          disabled={busy}
                          onChange={() => toggleSelected(t.enrollmentId)}
                        />
                        <span>{t.fullName}</span>
                      </label>
                      <CompletionStatusBadge status={t.lifecycleStatus} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="eval-finalize-section__empty">لا يوجد متدربون غير مؤهلين ضمن النطاق الحالي.</p>
              )}
              <FormTextarea
                id="finalize-exceptional-reason"
                label="سبب الإنهاء الاستثنائي"
                required
                value={reason}
                disabled={busy}
                onChange={(e) => setReason(e.target.value)}
              />
              {pendingAction === 'EXCEPTIONAL' ? (
                <div className="eval-finalize-confirm">
                  <p>سيتم تسجيل هذا الإجراء في سجل التدقيق. هل تريد المتابعة؟</p>
                  <div className="eval-finalize-confirm__actions">
                    <Button type="button" variant="outline" disabled={busy} onClick={() => setPendingAction(null)}>
                      تراجع
                    </Button>
                    <Button type="button" variant="danger" loading={busy} onClick={() => runFinalize('EXCEPTIONAL')}>
                      نعم، تأكيد الإنهاء الاستثنائي
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy || !reason.trim() || !notEligibleList.length}
                  onClick={() => setPendingAction('EXCEPTIONAL')}
                >
                  إنهاء استثنائي
                </Button>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </AppModal>
  );
}
