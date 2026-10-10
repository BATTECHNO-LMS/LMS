import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Inbox, Loader2, MessageSquareText, Paperclip } from 'lucide-react';
import { SubmissionFileList } from './SubmissionFileList.jsx';
import {
  gradeTaskSubmission,
  listTaskSubmissionsForReview,
  requestTaskSubmissionRevision,
} from '../../taskSubmissions.service.js';
import { trainingTaskStatusLabel } from '../../trainingTaskStatus.js';
import { FileSize } from './FileSize.jsx';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';

function SubmissionReviewCard({ row, maxScore, canGrade, onChanged, onError }) {
  const [score, setScore] = useState(row.score != null ? String(row.score) : '');
  const [feedback, setFeedback] = useState(row.feedback || '');
  const [busy, setBusy] = useState('');
  const files = Array.isArray(row.files) ? row.files : [];
  const totalBytes = files.reduce((s, f) => s + (Number(f.size) || 0), 0);

  async function run(kind, fn) {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
      await onChanged();
    } catch (err) {
      onError(getApiErrorMessage(err, 'تعذّر حفظ المراجعة.'));
    } finally {
      setBusy('');
    }
  }

  const fileCount = files.length + (row.hasLegacyFile ? 1 : 0);
  const name = row.traineeName || 'متدرب';

  return (
    <li className="task-review-card">
      <div className="task-review-card__head">
        <span className="task-review-card__avatar" aria-hidden>
          {name.trim().charAt(0)}
        </span>
        <div className="task-review-card__who">
          <strong className="task-review-card__name">{name}</strong>
          {row.traineeEmail ? (
            <span className="task-review-card__email" dir="ltr">
              {row.traineeEmail}
            </span>
          ) : null}
        </div>
        <span className={`task-review-card__status task-review-card__status--${String(row.status || '').toLowerCase()}`}>
          {trainingTaskStatusLabel(row.status)}
        </span>
      </div>

      <ul className="task-review-card__chips">
        <li>المحاولة {row.attemptNo || 1}</li>
        {row.submittedAt ? (
          <li>
            <CalendarClock size={14} aria-hidden />
            {new Date(row.submittedAt).toLocaleString('ar')}
          </li>
        ) : null}
        {row.score != null ? (
          <li className="task-review-card__chip--score">
            الدرجة: {row.score}
            {maxScore != null ? ` / ${maxScore}` : ''}
          </li>
        ) : null}
      </ul>

      <section className="task-review-card__section">
        <h4 className="task-review-card__section-title">
          <Paperclip size={16} aria-hidden />
          ملفات التسليم
          {fileCount ? (
            <span className="task-review-card__count">
              {fileCount}
              {files.length ? (
                <>
                  {' · '}
                  <FileSize bytes={totalBytes} />
                </>
              ) : null}
            </span>
          ) : null}
        </h4>
        {fileCount ? (
          <SubmissionFileList
            submissionId={row.id}
            files={files}
            hasLegacyFile={row.hasLegacyFile}
            onError={onError}
            hideSummary
          />
        ) : (
          <div className="task-review-card__empty">
            <Inbox size={20} aria-hidden />
            <span>لم يُرفق المتدرب أي ملفات في هذا التسليم.</span>
          </div>
        )}
      </section>

      {row.contentText ? (
        <section className="task-review-card__section">
          <h4 className="task-review-card__section-title">
            <MessageSquareText size={16} aria-hidden />
            تعليق المتدرب
          </h4>
          <p className="task-review-card__text" dir="auto">
            {row.contentText}
          </p>
        </section>
      ) : null}

      {canGrade ? (
        <div className="task-review-card__grade">
          <label className="task-review-card__score">
            <span>الدرجة{maxScore != null ? ` (من ${maxScore})` : ''}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={maxScore != null ? Number(maxScore) : undefined}
              step="0.5"
              value={score}
              onChange={(e) => setScore(e.target.value)}
            />
          </label>
          <label className="task-review-card__feedback">
            <span>ملاحظات للمتدرب</span>
            <textarea
              rows={3}
              value={feedback}
              placeholder="اكتب ملاحظاتك هنا (اختياري)"
              onChange={(e) => setFeedback(e.target.value)}
            />
          </label>
          <div className="task-review-card__actions">
            <button
              type="button"
              className="task-submit__primary"
              disabled={Boolean(busy)}
              onClick={() =>
                run('grade', () =>
                  gradeTaskSubmission(row.id, {
                    score: score !== '' ? Number(score) : null,
                    feedback: feedback || null,
                  })
                )
              }
            >
              {busy === 'grade' ? <Loader2 size={16} className="task-spin" aria-hidden /> : null}
              حفظ التقييم
            </button>
            <button
              type="button"
              className="task-submit__secondary"
              disabled={Boolean(busy)}
              onClick={() => run('revision', () => requestTaskSubmissionRevision(row.id, feedback || null))}
            >
              {busy === 'revision' ? <Loader2 size={16} className="task-spin" aria-hidden /> : null}
              طلب تعديل
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function TaskSubmissionsReviewPanel({ task, canGrade = true }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setRows(await listTaskSubmissionsForReview(task.id));
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذّر تحميل التسليمات.'));
      setRows((prev) => prev || []);
    }
  }, [task.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="task-review" dir="rtl">
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {rows == null ? (
        <p className="auth-register__helper">
          <Loader2 size={16} className="task-spin" aria-hidden /> جارٍ تحميل التسليمات…
        </p>
      ) : rows.length ? (
        <ul className="task-review__list">
          {rows.map((row) => (
            <SubmissionReviewCard
              key={row.id}
              row={row}
              maxScore={task.maxScore}
              canGrade={canGrade}
              onChanged={load}
              onError={setError}
            />
          ))}
        </ul>
      ) : (
        <p className="auth-register__helper">لا توجد تسليمات لهذه المهمة بعد.</p>
      )}
    </div>
  );
}
