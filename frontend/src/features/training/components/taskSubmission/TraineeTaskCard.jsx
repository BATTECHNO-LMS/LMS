import { CalendarClock, FileDown, MessageSquareQuote, Paperclip } from 'lucide-react';
import { StatusBadge } from '../../../../components/admin/StatusBadge.jsx';
import { AssignmentSubmissionForm } from './AssignmentSubmissionForm.jsx';
import { SubmissionFileList } from './SubmissionFileList.jsx';
import { FileSize } from './FileSize.jsx';
import { trainingTaskStatusLabel } from '../../trainingTaskStatus.js';

const STATUS_VARIANT = {
  GRADED: 'success',
  ACCEPTED: 'success',
  SUBMITTED: 'info',
  RESUBMITTED: 'info',
  REVISION_REQUESTED: 'warning',
  REOPENED: 'warning',
  RETURNED: 'warning',
  REJECTED: 'danger',
};

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('ar') : '—';
}

/**
 * Trainee-facing course task: summary, instructions, latest submission, trainer feedback
 * and the submission form. Layout only — submission rules stay on the server.
 */
export function TraineeTaskCard({ task, onDownloadInstructions, onSubmitted, onError }) {
  const submission = task.submission || null;
  const files = Array.isArray(submission?.files) ? submission.files : [];
  const fileCount = files.length + (submission?.hasLegacyFile ? 1 : 0);
  const filesBytes = files.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
  const isOverdue =
    Boolean(task.dueAt) && new Date(task.dueAt).getTime() < Date.now() && (task.canSubmit || !submission);
  const statusLabel = submission ? trainingTaskStatusLabel(submission.status) : 'لم تُسلَّم بعد';
  const statusVariant = submission ? STATUS_VARIANT[submission.status] || 'info' : 'muted';
  const titleId = `task-title-${task.id}`;

  return (
    <article className="assign-card" aria-labelledby={titleId}>
      <header className="assign-card__header">
        <h3 id={titleId} className="assign-card__title" dir="auto">
          {task.title}
        </h3>
        <div className="assign-card__badges">
          <StatusBadge variant={statusVariant}>{statusLabel}</StatusBadge>
          {isOverdue ? <StatusBadge variant="danger">انتهى الموعد</StatusBadge> : null}
          {task.isRequired === false ? <StatusBadge variant="muted">اختيارية</StatusBadge> : null}
        </div>
      </header>

      <div className="assign-card__layout">
        <aside className="assign-summary" aria-label="ملخص المهمة">
          <dl className="assign-summary__grid">
            <div className="assign-summary__item">
              <dt>الحالة</dt>
              <dd>{statusLabel}</dd>
            </div>
            <div className={`assign-summary__item${isOverdue ? ' assign-summary__item--late' : ''}`}>
              <dt>آخر موعد</dt>
              <dd>{formatDateTime(task.dueAt)}</dd>
            </div>
            <div className="assign-summary__item">
              <dt>الدرجة</dt>
              <dd>
                {submission?.score != null ? `${submission.score} / ${task.maxScore ?? '—'}` : `من ${task.maxScore ?? '—'}`}
              </dd>
            </div>
            {task.maxAttempts != null ? (
              <div className="assign-summary__item">
                <dt>المحاولات</dt>
                <dd>
                  {Number(task.attemptCount || 0)} من {task.maxAttempts}
                </dd>
              </div>
            ) : null}
            {submission?.submittedAt ? (
              <div className="assign-summary__item">
                <dt>تاريخ التسليم</dt>
                <dd>{formatDateTime(submission.submittedAt)}</dd>
              </div>
            ) : null}
            {submission ? (
              <div className="assign-summary__item">
                <dt>الملفات المسلّمة</dt>
                <dd>{fileCount}</dd>
              </div>
            ) : null}
          </dl>
        </aside>

        <div className="assign-card__main">
          {task.instructions || task.hasAttachment || task.attachmentUrl ? (
            <section className="assign-section">
              <h4 className="assign-section__title">التعليمات</h4>
              {task.instructions ? (
                <div className="assign-instructions" dir="auto">
                  {task.instructions}
                </div>
              ) : null}
              {task.hasAttachment || task.attachmentUrl ? (
                <button type="button" className="task-submit__secondary assign-section__btn" onClick={onDownloadInstructions}>
                  <FileDown size={16} aria-hidden />
                  تحميل ملف التعليمات
                </button>
              ) : null}
            </section>
          ) : null}

          {submission ? (
            <section className="assign-section assign-previous">
              <h4 className="assign-section__title">
                {task.canSubmit ? 'التسليم السابق' : 'تسليمك'}
              </h4>
              <ul className="assign-previous__chips">
                <li>المحاولة {submission.attemptNo || 1}</li>
                {submission.submittedAt ? (
                  <li>
                    <CalendarClock size={14} aria-hidden />
                    {formatDateTime(submission.submittedAt)}
                  </li>
                ) : null}
                {submission.score != null ? (
                  <li className="assign-previous__score">
                    الدرجة: {submission.score}
                    {task.maxScore != null ? ` / ${task.maxScore}` : ''}
                  </li>
                ) : null}
              </ul>
              {fileCount ? (
                <>
                  <p className="assign-previous__files-title">
                    <Paperclip size={14} aria-hidden />
                    <span>الملفات</span>
                    <span className="assign-previous__count">
                      {fileCount}
                      {files.length ? (
                        <>
                          {' · '}
                          <FileSize bytes={filesBytes} />
                        </>
                      ) : null}
                    </span>
                  </p>
                  <SubmissionFileList
                    submissionId={submission.id}
                    files={files}
                    hasLegacyFile={submission.hasLegacyFile}
                    onError={onError}
                    hideSummary
                  />
                </>
              ) : (
                <p className="assign-previous__empty">لا توجد ملفات مرفقة في هذا التسليم.</p>
              )}
              {submission.contentText ? (
                <p className="assign-previous__text" dir="auto">
                  {submission.contentText}
                </p>
              ) : null}
            </section>
          ) : null}

          {submission?.feedback ? (
            <section className="assign-feedback" aria-label="ملاحظات المدرب">
              <h4 className="assign-feedback__title">
                <MessageSquareQuote size={16} aria-hidden />
                ملاحظات المدرب
              </h4>
              <p className="assign-feedback__text" dir="auto">
                {submission.feedback}
              </p>
            </section>
          ) : null}

          {task.canSubmit ? (
            <AssignmentSubmissionForm
              task={task}
              title={submission ? 'إعادة تسليم المهمة' : 'تسليم المهمة'}
              onSubmitted={onSubmitted}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}
