import { useCallback, useEffect, useState } from 'react';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { FormTextarea } from '../../../components/forms/FormTextarea.jsx';
import { FileUploader } from '../../../components/forms/FileUploader.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { StatusBadge } from '../../../components/admin/StatusBadge.jsx';
import {
  createProgramMaterial,
  deleteProgramMaterial,
  getMaterialPlaybackUrl,
  listProgramMaterials,
  updateProgramMaterial,
} from '../training.service.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const EMPTY = { title: '', description: '', url: '', is_published: true, sort_order: '0' };

/**
 * Educational materials manager (file + description + optional link).
 * Reuses shared FileUploader / files presign pipeline (folder: training).
 */
export function CourseMaterialsManager({ programId, canManage = true }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [upload, setUpload] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const rows = await listProgramMaterials(programId);
    setItems(Array.isArray(rows) ? rows : []);
  }, [programId]);

  useEffect(() => {
    refresh().catch((err) => setError(getApiErrorMessage(err, 'تعذر تحميل المواد.')));
  }, [refresh]);

  function resetForm() {
    setForm(EMPTY);
    setUpload(null);
    setEditingId(null);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!canManage || busy) return;
    if (!form.title.trim()) {
      setError('عنوان المادة مطلوب.');
      return;
    }
    if (!form.url.trim() && !upload?.storageKey && !upload?.id && !editingId) {
      setError('أضف ملفًا أو رابطًا خارجيًا.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = {
        title: form.title.trim(),
        description: form.description || null,
        url: form.url.trim() || null,
        is_published: form.is_published,
        sort_order: Number(form.sort_order || 0),
        material_type: upload ? 'FILE' : form.url.trim() ? 'LINK' : 'FILE',
      };
      if (upload?.id || upload?.storageKey) {
        body.file_id = upload.id || null;
        body.storage_key = upload.storageKey || null;
        body.mime_type = upload.mimeType || null;
      }
      if (editingId) {
        await updateProgramMaterial(editingId, body);
        setMessage('تم تحديث المادة.');
      } else {
        await createProgramMaterial(programId, body);
        setMessage('تم إضافة المادة.');
      }
      resetForm();
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر حفظ المادة.'));
    } finally {
      setBusy(false);
    }
  }

  async function openFile(item) {
    try {
      if (item.url && !item.hasFile) {
        window.open(item.url, '_blank', 'noopener,noreferrer');
        return;
      }
      const data = await getMaterialPlaybackUrl(item.id);
      if (data?.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(getApiErrorMessage(err, 'تعذر فتح الملف.'));
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
              id="mat-title"
              label="عنوان المادة"
              required
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="auth-form__span-full"
            />
            <FormTextarea
              id="mat-desc"
              label="شرح / وصف"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="auth-form__span-full"
            />
            <FormInput
              id="mat-url"
              label="رابط خارجي اختياري"
              value={form.url}
              onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
              className="auth-form__span-full"
              dir="ltr"
            />
            <FormInput
              id="mat-order"
              label="ترتيب العرض"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((p) => ({ ...p, sort_order: e.target.value }))}
            />
            <label className="form-field">
              <span>منشورة</span>
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm((p) => ({ ...p, is_published: e.target.checked }))}
              />
            </label>
          </div>
          <FileUploader
            folder="training"
            visibility="private"
            relatedEntityType="training_program"
            relatedEntityId={programId}
            accept="application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*,.zip"
            maxBytes={50 * 1024 * 1024}
            currentFileName={upload?.originalName}
            onUploaded={(record) => setUpload(record)}
            onError={() =>
              setError('تعذر رفع الملف. تحقق من نوع الملف وحجمه ثم حاول مرة أخرى.')
            }
            hint="PDF، Word، PowerPoint، Excel، صور، أو ZIP"
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <Button type="submit" variant="primary" disabled={busy}>
              {editingId ? 'حفظ التعديل' : 'إضافة مادة'}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={resetForm} disabled={busy}>
                إلغاء
              </Button>
            ) : null}
          </div>
        </form>
      ) : null}

      {items.length ? (
        <ul className="simple-list course-material-list">
          {items.map((m) => (
            <li key={m.id} className="course-material-card">
              <strong>{m.title}</strong>{' '}
              {m.isPublished ? (
                <StatusBadge variant="success">منشورة</StatusBadge>
              ) : (
                <StatusBadge variant="muted">مسودة</StatusBadge>
              )}
              {m.description ? <div className="auth-register__helper">{m.description}</div> : null}
              <div className="course-material-card__actions">
                <Button type="button" variant="outline" onClick={() => openFile(m)}>
                  عرض / تحميل
                </Button>
                {m.url ? (
                  <a className="link" href={m.url} target="_blank" rel="noreferrer" dir="ltr">
                    رابط خارجي
                  </a>
                ) : null}
                {canManage ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingId(m.id);
                        setForm({
                          title: m.title || '',
                          description: m.description || '',
                          url: m.url || '',
                          is_published: m.isPublished !== false,
                          sort_order: String(m.sortOrder ?? 0),
                        });
                        setUpload(null);
                      }}
                    >
                      تعديل
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        if (!window.confirm('حذف هذه المادة؟')) return;
                        setBusy(true);
                        try {
                          await deleteProgramMaterial(m.id);
                          await refresh();
                          setMessage('تم حذف المادة.');
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
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="لم تتم إضافة مواد تعليمية بعد."
          description={canManage ? 'أضف أول مادة بملف أو رابط.' : undefined}
        />
      )}
    </div>
  );
}
