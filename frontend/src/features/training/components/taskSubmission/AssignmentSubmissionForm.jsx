import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudUpload,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { SubmissionFileIcon } from './SubmissionFileIcon.jsx';
import { FileExtLabel, FileSize, displayFileName } from './FileSize.jsx';
import {
  TASK_UPLOAD_ERROR_MESSAGES,
  fileFingerprint,
  precheckTaskFile,
  resolveTaskSubmissionLimits,
} from '../../taskSubmissionLimits.js';
import {
  deleteTaskSubmissionDraft,
  listTaskSubmissionDrafts,
  submitTaskWithFiles,
  uploadTaskSubmissionFile,
} from '../../taskSubmissions.service.js';
import { getApiErrorMessage } from '../../../../services/apiHelpers.js';

const NON_RETRYABLE = new Set(['FILE_TYPE_BLOCKED', 'FILE_EMPTY', 'FILE_TOO_LARGE', 'TOTAL_SIZE_EXCEEDED']);
const MAX_CONCURRENT_UPLOADS = 2;

let keySeq = 0;
const nextKey = () => `f${Date.now().toString(36)}${(keySeq += 1)}`;

function errorText(code, fallback) {
  return TASK_UPLOAD_ERROR_MESSAGES[code] || fallback || TASK_UPLOAD_ERROR_MESSAGES.UPLOAD_FAILED;
}

/**
 * Multi-file assignment submission: drag & drop, real per-file progress, remove/retry,
 * optional comment and an explicit confirmation step. Files are uploaded as drafts; the
 * submission is created atomically on confirm with the uploaded file ids.
 */
export function AssignmentSubmissionForm({ task, onSubmitted, disabled = false, title = 'تسليم المهمة' }) {
  const limits = useMemo(() => resolveTaskSubmissionLimits(task?.submissionLimits), [task?.submissionLimits]);
  const [items, setItems] = useState([]);
  const [comment, setComment] = useState('');
  const [step, setStep] = useState('edit');
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const abortersRef = useRef(new Map());
  const mountedRef = useRef(true);
  const taskId = task?.id;

  useEffect(() => {
    mountedRef.current = true;
    const aborters = abortersRef.current;
    return () => {
      mountedRef.current = false;
      aborters.forEach((abort) => abort());
      aborters.clear();
    };
  }, []);

  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    listTaskSubmissionDrafts(taskId)
      .then((drafts) => {
        if (cancelled || !drafts.length) return;
        setItems((prev) => {
          const known = new Set(prev.map((i) => i.fileId).filter(Boolean));
          const restored = drafts
            .filter((d) => !known.has(d.id))
            .map((d) => ({
              key: nextKey(),
              file: null,
              fingerprint: `draft::${d.id}`,
              name: d.originalName,
              size: d.size,
              mimeType: d.mimeType,
              status: 'done',
              progress: 100,
              fileId: d.id,
              errorCode: null,
              errorMessage: '',
            }));
          return [...prev, ...restored];
        });
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const patch = useCallback((key, changes) => {
    if (!mountedRef.current) return;
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...changes } : i)));
  }, []);

  const activeItems = items.filter((i) => i.status !== 'error');
  const totalBytes = activeItems.reduce((s, i) => s + (Number(i.size) || 0), 0);
  const uploadingCount = items.filter((i) => i.status === 'uploading').length;
  const queuedCount = items.filter((i) => i.status === 'queued').length;
  const failedCount = items.filter((i) => i.status === 'error').length;
  const doneItems = items.filter((i) => i.status === 'done' && i.fileId);
  const busyUploading = uploadingCount > 0 || queuedCount > 0;

  useEffect(() => {
    if (!taskId || uploadingCount >= MAX_CONCURRENT_UPLOADS) return;
    const next = items.find((i) => i.status === 'queued');
    if (!next) return;
    patch(next.key, { status: 'uploading', progress: 0, errorCode: null, errorMessage: '' });
    const { promise, abort } = uploadTaskSubmissionFile(taskId, next.file, {
      onProgress: (p) => patch(next.key, { progress: p }),
    });
    abortersRef.current.set(next.key, abort);
    promise
      .then((record) => {
        patch(next.key, {
          status: 'done',
          progress: 100,
          fileId: record.id,
          name: record.originalName || next.name,
          size: record.size ?? next.size,
        });
      })
      .catch((err) => {
        if (err?.code === 'ABORTED') return;
        patch(next.key, {
          status: 'error',
          errorCode: err?.code || 'UPLOAD_FAILED',
          errorMessage: err?.message || errorText(err?.code),
        });
      })
      .finally(() => abortersRef.current.delete(next.key));
  }, [items, uploadingCount, taskId, patch]);

  function addFiles(fileList) {
    if (disabled || submitting) return;
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    setNotice('');
    setFormError('');
    setStep('edit');
    setItems((prev) => {
      const next = [...prev];
      const fingerprints = new Set(next.map((i) => i.fingerprint));
      let count = next.filter((i) => i.status !== 'error').length;
      let bytes = next.filter((i) => i.status !== 'error').reduce((s, i) => s + (Number(i.size) || 0), 0);
      const skipped = [];
      for (const file of incoming) {
        const fp = fileFingerprint(file);
        if (fingerprints.has(fp)) {
          skipped.push(`${file.name}: ${TASK_UPLOAD_ERROR_MESSAGES.DUPLICATE}`);
          continue;
        }
        if (count >= limits.maxFiles) {
          skipped.push(`${file.name}: ${TASK_UPLOAD_ERROR_MESSAGES.TOO_MANY_FILES}`);
          continue;
        }
        const check = precheckTaskFile(file, limits);
        let errorCode = check.valid ? null : check.code;
        if (!errorCode && bytes + file.size > limits.maxTotalBytes) errorCode = 'TOTAL_SIZE_EXCEEDED';
        fingerprints.add(fp);
        next.push({
          key: nextKey(),
          file,
          fingerprint: fp,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          status: errorCode ? 'error' : 'queued',
          progress: 0,
          fileId: null,
          errorCode,
          errorMessage: errorCode ? errorText(errorCode) : '',
        });
        if (!errorCode) {
          count += 1;
          bytes += file.size;
        }
      }
      if (skipped.length) setNotice(skipped.join(' — '));
      return next;
    });
  }

  async function removeItem(item) {
    setItems((prev) => prev.filter((i) => i.key !== item.key));
    const abort = abortersRef.current.get(item.key);
    if (abort) abort();
    if (item.fileId) {
      deleteTaskSubmissionDraft(taskId, item.fileId).catch(() => null);
    }
  }

  function retryItem(item) {
    if (!item.file || NON_RETRYABLE.has(item.errorCode)) return;
    if (activeItems.length >= limits.maxFiles) {
      setNotice(TASK_UPLOAD_ERROR_MESSAGES.TOO_MANY_FILES);
      return;
    }
    patch(item.key, { status: 'queued', progress: 0, errorCode: null, errorMessage: '' });
  }

  function goToConfirm(e) {
    e.preventDefault();
    setFormError('');
    if (busyUploading) {
      setFormError('انتظر حتى يكتمل رفع جميع الملفات.');
      return;
    }
    if (failedCount) {
      setFormError('أزل الملفات التي فشل رفعها أو أعد محاولة رفعها قبل التسليم.');
      return;
    }
    if (!doneItems.length && !comment.trim()) {
      setFormError('أضف ملفاً واحداً على الأقل أو اكتب نص التسليم.');
      return;
    }
    setStep('confirm');
  }

  async function confirmSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setFormError('');
    try {
      const result = await submitTaskWithFiles(taskId, {
        contentText: comment.trim(),
        fileIds: doneItems.map((i) => i.fileId),
      });
      if (!mountedRef.current) return;
      setItems([]);
      setComment('');
      setStep('edit');
      onSubmitted?.(result);
    } catch (err) {
      if (!mountedRef.current) return;
      setFormError(getApiErrorMessage(err, 'تعذّر تسليم المهمة. لم يتم حفظ التسليم، حاول مرة أخرى.'));
      setStep('edit');
      listTaskSubmissionDrafts(taskId)
        .then((drafts) => {
          const alive = new Set(drafts.map((d) => d.id));
          setItems((prev) =>
            prev.map((i) =>
              i.status === 'done' && i.fileId && !alive.has(i.fileId)
                ? { ...i, status: 'error', errorCode: 'UPLOAD_FAILED', errorMessage: 'الملف لم يعد متاحاً. أزله وأعد رفعه.' }
                : i
            )
          );
        })
        .catch(() => null);
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  const inputId = `task-files-${taskId}`;
  const dueText = task?.dueAt ? new Date(task.dueAt).toLocaleString('ar') : null;
  const attemptsLeft =
    task?.maxAttempts != null ? Math.max(0, Number(task.maxAttempts) - Number(task.attemptCount || 0)) : null;

  return (
    <form className="task-submit" dir="rtl" onSubmit={goToConfirm} noValidate>
      <div className="task-submit__head">
        <h4 className="task-submit__title">{title}</h4>
        <ul className="task-submit__limits" aria-label="حدود الرفع">
          <li>حتى {limits.maxFiles} ملفات</li>
          <li>
            <FileSize bytes={limits.maxFileBytes} /> للملف
          </li>
          <li>
            <FileSize bytes={limits.maxTotalBytes} /> للمجموع
          </li>
        </ul>
      </div>

      {step === 'edit' ? (
        <>
          <div
            className={`task-dropzone${dragOver ? ' task-dropzone--active' : ''}${disabled || submitting ? ' task-dropzone--disabled' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!disabled && !submitting) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer?.files);
            }}
          >
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              multiple
              className="task-dropzone__input"
              disabled={disabled || submitting}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <CloudUpload className="task-dropzone__icon" aria-hidden />
            <div className="task-dropzone__text">
              <p className="task-dropzone__lead">اسحب الملفات وأفلتها هنا</p>
              <p className="task-dropzone__sub">يدعم جميع أنواع الملفات، بما فيها الملفات المضغوطة</p>
              <p className="task-dropzone__meta">
                <ShieldCheck size={14} aria-hidden />
                <span>باستثناء الملفات التنفيذية مثل exe وbat وmsi</span>
              </p>
            </div>
            <label htmlFor={inputId} className="task-dropzone__btn">
              اختيار الملفات
            </label>
          </div>

          {notice ? (
            <p className="task-submit__notice" role="status">
              {notice}
            </p>
          ) : null}

          {items.length ? (
            <div className="task-file-list">
              <p className="task-file-list__summary" aria-live="polite">
                {activeItems.length} / {limits.maxFiles} ملفات · <FileSize bytes={totalBytes} /> من{' '}
                <FileSize bytes={limits.maxTotalBytes} />
                {busyUploading ? ' · جارٍ الرفع…' : ''}
              </p>
              <ul className="task-file-list__items">
                {items.map((item) => (
                  <li key={item.key} className={`task-file-row task-file-row--${item.status}`}>
                    <SubmissionFileIcon name={item.name} mimeType={item.mimeType} />
                    <div className="task-file-row__meta">
                      <span className="task-file-row__name" title={item.name} dir="auto">
                        {displayFileName(item.name)}
                      </span>
                      <span className="task-file-row__sub">
                        <FileSize bytes={item.size} />
                        <FileExtLabel name={item.name} />
                        {item.status === 'queued' ? <span>بانتظار الرفع</span> : null}
                        {item.status === 'uploading' ? <span dir="ltr">{item.progress}%</span> : null}
                        {item.status === 'done' ? <span className="task-file-row__done">تم الرفع</span> : null}
                      </span>
                      {item.status === 'uploading' || item.status === 'queued' ? (
                        <div
                          className="task-file-row__bar"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={item.progress}
                          aria-label={`تقدم رفع ${item.name}`}
                        >
                          <div className="task-file-row__bar-fill" style={{ width: `${item.progress}%` }} />
                        </div>
                      ) : null}
                      {item.status === 'error' ? (
                        <span className="task-file-row__error" role="alert">
                          <AlertTriangle size={14} aria-hidden /> {item.errorMessage}
                        </span>
                      ) : null}
                    </div>
                    <div className="task-file-row__actions">
                      {item.status === 'done' ? (
                        <CheckCircle2 size={18} className="task-file-row__ok" aria-label="تم الرفع" />
                      ) : null}
                      {item.status === 'uploading' ? (
                        <Loader2 size={18} className="task-spin" aria-hidden />
                      ) : null}
                      {item.status === 'error' && item.file && !NON_RETRYABLE.has(item.errorCode) ? (
                        <button
                          type="button"
                          className="task-file-row__icon-btn"
                          onClick={() => retryItem(item)}
                          aria-label={`إعادة رفع ${item.name}`}
                          title="إعادة المحاولة"
                        >
                          <RotateCcw size={16} aria-hidden />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="task-file-row__icon-btn task-file-row__icon-btn--danger"
                        onClick={() => removeItem(item)}
                        disabled={submitting}
                        aria-label={`إزالة ${item.name}`}
                        title="إزالة"
                      >
                        <X size={16} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="task-submit__comment" htmlFor={`task-comment-${taskId}`}>
            <span>ملاحظة أو نص التسليم (اختياري)</span>
            <textarea
              id={`task-comment-${taskId}`}
              rows={3}
              value={comment}
              maxLength={20000}
              onChange={(e) => setComment(e.target.value)}
              disabled={disabled || submitting}
              placeholder="اكتب وصفاً مختصراً لعملك أو أي ملاحظة للمدرب…"
            />
          </label>

          {formError ? (
            <p className="form-field__error" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="task-submit__actions">
            <button
              type="submit"
              className="task-submit__primary"
              disabled={disabled || submitting || busyUploading}
            >
              {busyUploading ? <Loader2 size={16} className="task-spin" aria-hidden /> : <ArrowRight size={16} aria-hidden />}
              {busyUploading ? 'جارٍ رفع الملفات…' : 'مراجعة وتسليم'}
            </button>
          </div>
        </>
      ) : (
        <div className="task-confirm" role="group" aria-label="تأكيد التسليم">
          <p className="task-confirm__lead">راجع تسليمك قبل الإرسال:</p>
          <ul className="task-confirm__facts">
            <li>
              عدد الملفات: <strong>{doneItems.length}</strong> (<FileSize bytes={totalBytes} />)
            </li>
            {dueText ? <li>آخر موعد للتسليم: {dueText}</li> : null}
            {attemptsLeft != null ? <li>المحاولات المتبقية بعد هذا التسليم: {Math.max(0, attemptsLeft - 1)}</li> : null}
          </ul>
          {doneItems.length ? (
            <ul className="task-file-list__items task-file-list__items--compact">
              {doneItems.map((i) => (
                <li key={i.key} className="task-file-row task-file-row--done">
                  <SubmissionFileIcon name={i.name} mimeType={i.mimeType} size={18} />
                  <div className="task-file-row__meta">
                    <span className="task-file-row__name" title={i.name} dir="auto">
                      {displayFileName(i.name)}
                    </span>
                    <span className="task-file-row__sub">
                      <FileSize bytes={i.size} />
                      <FileExtLabel name={i.name} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {comment.trim() ? <blockquote className="task-confirm__comment">{comment.trim()}</blockquote> : null}
          {formError ? (
            <p className="form-field__error" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="task-submit__actions">
            <button type="button" className="task-submit__secondary" onClick={() => setStep('edit')} disabled={submitting}>
              رجوع للتعديل
            </button>
            <button type="button" className="task-submit__primary" onClick={confirmSubmit} disabled={submitting}>
              {submitting ? <Loader2 size={16} className="task-spin" aria-hidden /> : <Send size={16} aria-hidden />}
              {submitting ? 'جارٍ التسليم…' : 'تأكيد التسليم'}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
