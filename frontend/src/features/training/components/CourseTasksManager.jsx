import { useCallback, useEffect, useState } from 'react';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import { FileUploader } from '../../../components/forms/FileUploader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import {
  createTask,
  listProgramTasksDetailed,
  updateTask,
} from '../training.service.js';
import { toDatetimeLocalValue } from '../assessmentPresentation/assessmentDate.js';

const EMPTY = {
  title: '',
  instructions: '',
  due_at: '',
  max_score: '',
  max_attempts: '3',
  external_link: '',
  publish: true,
  is_required: true,
};

function toLocalInput(value) {
  return toDatetimeLocalValue(value);
}

export function CourseTasksManager({ programId, canManage = true }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [attachment, setAttachment] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const rows = await listProgramTasksDetailed(programId);
    setItems(Array.isArray(rows) ? rows : []);
  }, [programId]);

  useEffect(() => {
    refresh().catch((err) => setError(getApiErrorMessage(err, 'تعذر تحميل المهمات.')));
  }, [refresh]);

  function resetForm() {
    setForm(EMPTY);
    setAttachment(null);
    setEditingId(null);
  }

  async function save(body, { acknowledge = false } = {}) {
    const payload = { ...body };
    if (acknowledge) payload.acknowledge_submissions_impact = true;
    if (editingId) {
      return updateTask(editingId, payload);
    }
    return createTask(programId, payload);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!canManage || busy) return;
    if (!form.title.trim()) {
      setError('عنوان المهمة مطلوب.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    const body = {
      title: form.title.trim(),
      instructions: form.instructions || null,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      max_score: form.max_score !== '' ? Number(form.max_score) : null,
      max_attempts: form.max_attempts !== '' ? Number(form.max_attempts) : 3,
      is_required: form.is_required,
      publish: form.publish,
      external_links: form.external_link.trim() ? [form.external_link.trim()] : [],
    };
    if (attachment?.id || attachment?.storageKey) {
      body.attachment_file_id = attachment.id || null;
      body.attachment_storage_key = attachment.storageKey || null;
    }
    try {
      await save(body);
      setMessage(editingId ? 'تم تحديث المهمة.' : 'تم إنشاء المهمة.');
      resetForm();
      await refresh();
    } catch (err) {
      if (err?.response?.data?.code === 'TASK_HAS_SUBMISSIONS' || err?.code === 'TASK_HAS_SUBMISSIONS') {
        const ok = window.confirm(
          'توجد تسليمات سابقة لهذه المهمة. التعديل لن يحذف التسليمات. هل تريد المتابعة؟'
        );
        if (ok) {
          try {
            await save(body, { acknowledge: true });
            setMessage('تم تحديث المهمة مع الإبقاء على التسليمات التاريخية.');
            resetForm();
            await refresh();
          } catch (err2) {
            setError(getApiErrorMessage(err2, 'تعذر حفظ المهمة.'));
          }
        }
      } else {
        setError(getApiErrorMessage(err, 'تعذر حفظ المهمة.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="course-content-panel course-content-fade">
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="auth-register__helper" role="status">
          {message}
        </p>
      ) : null}

      {canManage ? (
        <form className="crud-form" onSubmit={onSubmit}>
          <div className="auth-form__fields-grid">
            <FormInput
              id="task-title"
              label="عنوان المهمة"
              required
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="auth-form__span-full"
            />
            <FormTextarea
              id="task-instructions"
              label="التعليمات"
              value={form.instructions}
              onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
              className="auth-form__span-full"
            />
            <FormInput
              id="task-due"
              label="الموعد"
              type="datetime-local"
              value={form.due_at}
              onChange={(e) => setForm((p) => ({ ...p, due_at: e.target.value }))}
            />
            <FormInput
              id="task-score"
              label="الدرجة"
              type="number"
              value={form.max_score}
              onChange={(e) => setForm((p) => ({ ...p, max_score: e.target.value }))}
            />
            <FormInput
              id="task-attempts"
              label="أقصى محاولات"
              type="number"
              value={form.max_attempts}
              onChange={(e) => setForm((p) => ({ ...p, max_attempts: e.target.value }))}
            />
            <FormInput
              id="task-link"
              label="رابط اختياري"
              value={form.external_link}
              onChange={(e) => setForm((p) => ({ ...p, external_link: e.target.value }))}
              dir="ltr"
              className="auth-form__span-full"
            />
            <label className="form-field">
              <span>نشر</span>
              <input
                type="checkbox"
                checked={form.publish}
                onChange={(e) => setForm((p) => ({ ...p, publish: e.target.checked }))}
              />
            </label>
            <label className="form-field">
              <span>مطلوبة</span>
              <input
                type="checkbox"
                checked={form.is_required}
                onChange={(e) => setForm((p) => ({ ...p, is_required: e.target.checked }))}
              />
            </label>
          </div>
          <FileUploader
            folder="training"
            visibility="private"
            relatedEntityType="training_program"
            relatedEntityId={programId}
            accept="application/pdf,.doc,.docx,.ppt,.pptx,image/*,.zip"
            maxBytes={50 * 1024 * 1024}
            currentFileName={attachment?.originalName}
            onUploaded={(record) => setAttachment(record)}
            hint="مرفق اختياري للمهمة"
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <Button type="submit" variant="primary" disabled={busy}>
              {editingId ? 'حفظ التعديل' : 'إنشاء مهمة'}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={resetForm}>
                إلغاء
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      {items.length ? (
        <ul className="simple-list" style={{ marginTop: '1rem' }}>
          {items.map((task) => (
            <li key={task.id}>
              <strong>{task.title}</strong>{' '}
              {task.isPublished ? (
                <StatusBadge variant="success">منشورة</StatusBadge>
              ) : (
                <StatusBadge variant="muted">مسودة</StatusBadge>
              )}
              {task.submissionCount > 0 ? (
                <StatusBadge variant="warning">{task.submissionCount} تسليم</StatusBadge>
              ) : null}
              <div className="auth-register__helper">
                الموعد: {task.dueAt ? new Date(task.dueAt).toLocaleString('ar') : '—'} — الدرجة:{' '}
                {task.maxScore ?? '—'}
              </div>
              {canManage ? (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(task.id);
                      setForm({
                        title: task.title || '',
                        instructions: task.instructions || '',
                        due_at: toLocalInput(task.dueAt),
                        max_score: task.maxScore != null ? String(task.maxScore) : '',
                        max_attempts: String(task.maxAttempts ?? 3),
                        external_link: task.externalLinks?.[0] || '',
                        publish: Boolean(task.isPublished),
                        is_required: task.isRequired !== false,
                      });
                      setAttachment(null);
                    }}
                  >
                    تعديل
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await updateTask(task.id, {
                          publish: !task.isPublished,
                          unpublish: Boolean(task.isPublished),
                        });
                        await refresh();
                      } catch (err) {
                        setError(getApiErrorMessage(err, 'تعذر تغيير النشر.'));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {task.isPublished ? 'إلغاء النشر' : 'نشر'}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="لا توجد مهمات" description={canManage ? 'أنشئ مهمة للمتدربين.' : undefined} />
      )}
    </div>
  );
}
