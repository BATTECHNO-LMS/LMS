import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Video } from 'lucide-react';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormSelect } from '../../../components/forms/FormSelect.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import { FileUploader } from '../../../components/forms/FileUploader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import {
  createRecordedLecture,
  deleteRecordedLecture,
  listRecordedLectures,
  publishRecordedLecture,
  updateRecordedLecture,
} from '../training.service.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const EMPTY = {
  title: '',
  description: '',
  external_url: '',
  session_id: '',
  sort_order: '0',
  is_published: false,
  duration_seconds: '',
};

function formatDuration(sec) {
  if (sec == null || sec === '') return '—';
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return '—';
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = Math.floor(n % 60);
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/**
 * Recorded lectures manager — reuses FileUploader (folder: training) + files API.
 */
export function RecordedLecturesManager({
  programId,
  sessions = [],
  canManage = true,
  viewBasePath,
}) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [upload, setUpload] = useState(null);
  const [uploadState, setUploadState] = useState('جاهز للرفع');
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  const refresh = useCallback(async () => {
    const rows = await listRecordedLectures(programId);
    setItems(Array.isArray(rows) ? rows : []);
  }, [programId]);

  useEffect(() => {
    refresh().catch((err) => setError(getApiErrorMessage(err, 'تعذر تحميل المحاضرات.')));
  }, [refresh]);

  function resetForm() {
    setForm(EMPTY);
    setUpload(null);
    setEditingId(null);
    setUploadState('جاهز للرفع');
    setShowForm(false);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!canManage || busy) return;
    if (!form.title.trim()) {
      setError('عنوان المحاضرة مطلوب.');
      return;
    }
    if (!editingId && !upload?.id && !upload?.storageKey && !form.external_url.trim()) {
      setError('ارفع ملف المحاضرة أو أضف رابطًا.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = {
        title: form.title.trim(),
        description: form.description || null,
        external_url: form.external_url.trim() || null,
        session_id: form.session_id || null,
        sort_order: Number(form.sort_order || 0),
        is_published: form.is_published,
        duration_seconds: form.duration_seconds !== '' ? Number(form.duration_seconds) : null,
      };
      if (upload?.id || upload?.storageKey) {
        body.file_id = upload.id || null;
        body.storage_key = upload.storageKey || null;
        body.mime_type = upload.mimeType || null;
      }
      if (editingId) {
        await updateRecordedLecture(editingId, body);
        setMessage('تم تحديث المحاضرة.');
      } else {
        await createRecordedLecture(programId, body);
        setMessage('تم إضافة المحاضرة المسجلة.');
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر حفظ المحاضرة.'));
    } finally {
      setBusy(false);
    }
  }

  const sessionLabel = (sessionId) =>
    sessions.find((s) => s.id === sessionId)?.title || null;

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
        <div style={{ marginBottom: '1rem' }}>
          {!showForm ? (
            <Button type="button" variant="primary" onClick={() => setShowForm(true)}>
              إضافة محاضرة مسجلة
            </Button>
          ) : null}
        </div>
      ) : null}

      {canManage && showForm ? (
        <form className="crud-form course-lecture-form" onSubmit={onSubmit}>
          <div className="auth-form__fields-grid">
            <FormInput
              id="lec-title"
              label="عنوان المحاضرة"
              required
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="auth-form__span-full"
            />
            <FormTextarea
              id="lec-desc"
              label="وصف المحاضرة"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="auth-form__span-full"
            />
            <FormInput
              id="lec-url"
              label="رابط إضافي اختياري"
              value={form.external_url}
              onChange={(e) => setForm((p) => ({ ...p, external_url: e.target.value }))}
              className="auth-form__span-full"
              dir="ltr"
            />
            <FormSelect
              id="lec-session"
              label="ربط بجلسة تدريبية (اختياري)"
              value={form.session_id}
              onChange={(e) => setForm((p) => ({ ...p, session_id: e.target.value }))}
            >
              <option value="">بدون ربط</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </FormSelect>
            <FormInput
              id="lec-order"
              label="ترتيب العرض"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
            />
            <FormInput
              id="lec-duration"
              label="المدة (ثوانٍ)"
              type="number"
              value={form.duration_seconds}
              onChange={(e) => setForm((p) => ({ ...p, duration_seconds: e.target.value }))}
            />
            <label className="form-field">
              <span>نشر فوري</span>
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
              />
            </label>
          </div>
          <p className="auth-register__helper">حالة الرفع: {uploadState}</p>
          <FileUploader
            folder="training"
            visibility="private"
            relatedEntityType="training_program"
            relatedEntityId={programId}
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska"
            maxBytes={100 * 1024 * 1024}
            currentFileName={upload?.originalName}
            disabled={busy}
            onUploaded={(record) => {
              setUpload(record);
              setUploadState('تم الرفع');
            }}
            onError={() => {
              setUploadState('فشل الرفع');
              setError('تعذر رفع الملف. تحقق من نوع الملف وحجمه ثم حاول مرة أخرى.');
            }}
            hint="ملفات فيديو مدعومة عبر نظام رفع الدورات الحالي (حتى 100MB)"
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'جاري الحفظ...' : editingId ? 'حفظ التعديل' : 'حفظ المحاضرة'}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} disabled={busy}>
              إلغاء
            </Button>
          </div>
        </form>
      ) : null}

      {items.length ? (
        <ul className="simple-list course-lecture-list">
          {items.map((lec) => (
            <li key={lec.id} className="course-lecture-card">
              <div className="course-lecture-card__icon" aria-hidden>
                <Video size={22} />
              </div>
              <div className="course-lecture-card__body">
                <strong>{lec.title}</strong>{' '}
                {lec.isPublished ? (
                  <StatusBadge variant="success">منشورة</StatusBadge>
                ) : (
                  <StatusBadge variant="muted">مسودة</StatusBadge>
                )}
                {lec.description ? (
                  <div className="auth-register__helper">
                    {String(lec.description).slice(0, 140)}
                    {String(lec.description).length > 140 ? '…' : ''}
                  </div>
                ) : null}
                <div className="auth-register__helper">
                  المدة: {formatDuration(lec.durationSeconds)} — الترتيب: {lec.sortOrder ?? 0}
                  {lec.sessionId ? ` — الجلسة: ${sessionLabel(lec.sessionId) || lec.sessionId}` : ''}
                </div>
                <div className="course-lecture-card__actions">
                  {viewBasePath ? (
                    <Link className="btn btn--outline btn--sm" to={`${viewBasePath}/${lec.id}`}>
                      مشاهدة
                    </Link>
                  ) : null}
                  {canManage ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowForm(true);
                          setEditingId(lec.id);
                          setForm({
                            title: lec.title || '',
                            description: lec.description || '',
                            external_url: lec.url || '',
                            session_id: lec.sessionId || '',
                            sort_order: String(lec.sortOrder ?? 0),
                            is_published: Boolean(lec.isPublished),
                            duration_seconds:
                              lec.durationSeconds != null ? String(lec.durationSeconds) : '',
                          });
                          setUpload(null);
                          setUploadState(lec.hasFile ? 'تم الرفع' : 'جاهز للرفع');
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
                            await publishRecordedLecture(lec.id, {
                              publish: !lec.isPublished,
                              unpublish: Boolean(lec.isPublished),
                            });
                            await refresh();
                          } catch (err) {
                            setError(getApiErrorMessage(err, 'تعذر تغيير حالة النشر.'));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {lec.isPublished ? 'إلغاء النشر' : 'نشر'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={async () => {
                          if (!window.confirm('حذف هذه المحاضرة؟')) return;
                          setBusy(true);
                          try {
                            await deleteRecordedLecture(lec.id);
                            await refresh();
                          } catch (err) {
                            setError(getApiErrorMessage(err, 'تعذر الحذف.'));
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        حذف
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="لا توجد محاضرات مسجلة حتى الآن."
          description={canManage ? 'أضف أول محاضرة مسجلة.' : undefined}
        />
      )}
    </div>
  );
}

export { formatDuration };
