import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, X } from 'lucide-react';
import { AdminPageHeader, SectionCard } from '../../../components/admin/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { FormInput, FormSelect, FormSwitch, FormTextarea } from '../../../components/forms/index.js';
import { useLocale, useTr } from '../../../features/locale/index.js';
import {
  createAdminHelpArticle,
  fetchAdminHelpArticles,
  fetchAdminHelpCategories,
  updateAdminHelpArticle,
} from '../../../features/help/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { CONTENT_STATUSES, ROLE_LABELS, ROLE_OPTIONS, slugify, statusLabel } from './contentHub.shared.js';

const emptyForm = {
  category_id: '',
  title_ar: '',
  title_en: '',
  slug: '',
  summary_ar: '',
  content_ar: '',
  content_en: '',
  keywords: '',
  status: 'DRAFT',
  target_roles: [],
  related_route: '',
  contextual_key: '',
  show_in_contextual: false,
  is_faq: false,
  sort_order: 0,
};

export function HelpArticleFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const t = useTr();
  const { isArabic } = useLocale();
  const [form, setForm] = useState(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [apiError, setApiError] = useState('');

  const catsQuery = useQuery({
    queryKey: ['admin', 'help', 'categories'],
    queryFn: fetchAdminHelpCategories,
  });
  const articlesQuery = useQuery({
    queryKey: ['admin', 'help', 'articles', 'form'],
    queryFn: () => fetchAdminHelpArticles(),
    enabled: isEdit,
  });

  const article = useMemo(() => {
    if (!isEdit) return null;
    return (articlesQuery.data?.articles || []).find((a) => String(a.id) === String(id)) || null;
  }, [articlesQuery.data, id, isEdit]);

  useEffect(() => {
    if (!article) return;
    setForm({
      category_id: article.category_id || '',
      title_ar: article.title_ar || '',
      title_en: article.title_en || '',
      slug: article.slug || '',
      summary_ar: article.summary_ar || '',
      content_ar: article.content_ar || '',
      content_en: article.content_en || '',
      keywords: Array.isArray(article.keywords) ? article.keywords.join(', ') : '',
      status: article.status || 'DRAFT',
      target_roles: article.target_roles || [],
      related_route: article.related_route || '',
      contextual_key: article.contextual_key || '',
      show_in_contextual: Boolean(article.show_in_contextual),
      is_faq: Boolean(article.is_faq),
      sort_order: article.sort_order ?? 0,
      expected_version: article.version,
      expected_updated_at: article.updated_at,
    });
    setSlugTouched(true);
  }, [article]);

  useEffect(() => {
    const cats = catsQuery.data?.categories || [];
    if (!isEdit && !form.category_id && cats.length) {
      setForm((f) => ({ ...f, category_id: cats[0].id }));
    }
  }, [catsQuery.data, isEdit, form.category_id]);

  const saveMut = useMutation({
    mutationFn: (body) => (isEdit ? updateAdminHelpArticle(id, body) : createAdminHelpArticle(body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'help'] });
      navigate('/admin/content-hub/help');
    },
  });

  function setField(key, value) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === 'title_ar' && !slugTouched && !isEdit) {
        next.slug = slugify(value) || `article-${Date.now()}`;
      }
      return next;
    });
  }

  function toggleRole(code) {
    setForm((f) => {
      const set = new Set(f.target_roles || []);
      if (set.has(code)) set.delete(code);
      else set.add(code);
      return { ...f, target_roles: [...set] };
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setApiError('');
    const keywords = String(form.keywords || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const body = {
      category_id: form.category_id,
      title_ar: form.title_ar.trim(),
      title_en: form.title_en?.trim() || null,
      slug: form.slug.trim(),
      summary_ar: form.summary_ar?.trim() || null,
      content_ar: form.content_ar,
      content_en: form.content_en?.trim() || null,
      keywords,
      status: form.status,
      target_roles: form.target_roles,
      related_route: form.related_route?.trim() || null,
      contextual_key: form.contextual_key?.trim() || null,
      show_in_contextual: Boolean(form.show_in_contextual),
      is_faq: Boolean(form.is_faq),
      sort_order: Number(form.sort_order) || 0,
    };
    if (isEdit) {
      if (form.expected_version != null) body.expected_version = form.expected_version;
      if (form.expected_updated_at) body.expected_updated_at = form.expected_updated_at;
    }
    try {
      await saveMut.mutateAsync(body);
    } catch (err) {
      setApiError(getApiErrorMessage(err, t('تعذر الحفظ', 'Save failed')));
    }
  }

  if (isEdit && articlesQuery.isLoading) {
    return (
      <div className="page page--dashboard page--admin">
        <LoadingSpinner />
      </div>
    );
  }

  if (isEdit && !article && !articlesQuery.isLoading) {
    return (
      <div className="page page--dashboard page--admin">
        <AdminPageHeader title={t('المقال غير موجود', 'Article not found')} description="" />
        <Link className="btn btn--outline" to="/admin/content-hub/help">
          {t('عودة', 'Back')}
        </Link>
      </div>
    );
  }

  const categories = catsQuery.data?.categories ?? [];

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={isEdit ? t('تعديل مقال', 'Edit article') : t('مقال جديد', 'New article')}
        description={t('أدخل محتوى HTML للمقال بالعربية', 'Enter Arabic HTML content for the article')}
      />
      <SectionCard>
        <form className="form-grid" onSubmit={onSubmit}>
          {apiError ? <p className="form-error">{apiError}</p> : null}
          <FormSelect
            id="ha-category"
            label={t('التصنيف', 'Category')}
            value={form.category_id}
            onChange={(e) => setField('category_id', e.target.value)}
            required
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title_ar}
              </option>
            ))}
          </FormSelect>
          <FormInput
            id="ha-title"
            label={t('العنوان (عربي)', 'Title (Arabic)')}
            value={form.title_ar}
            onChange={(e) => setField('title_ar', e.target.value)}
            required
          />
          <FormInput
            id="ha-title-en"
            label={t('العنوان (إنجليزي)', 'Title (English)')}
            value={form.title_en}
            onChange={(e) => setField('title_en', e.target.value)}
          />
          <FormInput
            id="ha-slug"
            label={t('المعرّف (slug)', 'Slug')}
            value={form.slug}
            onChange={(e) => {
              setSlugTouched(true);
              setField('slug', e.target.value);
            }}
            required
          />
          <FormTextarea
            id="ha-summary"
            label={t('الملخص', 'Summary')}
            value={form.summary_ar}
            onChange={(e) => setField('summary_ar', e.target.value)}
            rows={2}
          />
          <FormTextarea
            id="ha-content"
            label={t('المحتوى HTML (عربي)', 'HTML content (Arabic)')}
            value={form.content_ar}
            onChange={(e) => setField('content_ar', e.target.value)}
            rows={12}
            required
          />
          <FormTextarea
            id="ha-content-en"
            label={t('المحتوى HTML (إنجليزي)', 'HTML content (English)')}
            value={form.content_en}
            onChange={(e) => setField('content_en', e.target.value)}
            rows={6}
          />
          <FormInput
            id="ha-keywords"
            label={t('كلمات مفتاحية (مفصولة بفاصلة)', 'Keywords (comma-separated)')}
            value={form.keywords}
            onChange={(e) => setField('keywords', e.target.value)}
          />
          <FormSelect id="ha-status" label={t('الحالة', 'Status')} value={form.status} onChange={(e) => setField('status', e.target.value)}>
            {CONTENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s, isArabic)}
              </option>
            ))}
          </FormSelect>
          <FormInput
            id="ha-route"
            label={t('المسار المرتبط', 'Related route')}
            value={form.related_route}
            onChange={(e) => setField('related_route', e.target.value)}
            placeholder="/student/field-training"
          />
          <FormInput
            id="ha-ctx-key"
            label={t('مفتاح سياقي', 'Contextual key')}
            value={form.contextual_key}
            onChange={(e) => setField('contextual_key', e.target.value)}
          />
          <FormInput
            id="ha-sort"
            type="number"
            label={t('ترتيب العرض', 'Sort order')}
            value={form.sort_order}
            onChange={(e) => setField('sort_order', e.target.value)}
          />
          <div className="form-field">
            <span className="form-field__label">{t('الأدوار المستهدفة', 'Target roles')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              {ROLE_OPTIONS.map((code) => (
                <label key={code} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                  <input type="checkbox" checked={(form.target_roles || []).includes(code)} onChange={() => toggleRole(code)} />
                  {(isArabic ? ROLE_LABELS.ar : ROLE_LABELS.en)[code]}
                </label>
              ))}
            </div>
          </div>
          <FormSwitch
            id="ha-faq"
            label={t('سؤال شائع (FAQ)', 'FAQ')}
            checked={form.is_faq}
            onChange={(e) => setField('is_faq', e.target.checked)}
          />
          <FormSwitch
            id="ha-contextual"
            label={t('إظهار في المساعدة السياقية', 'Show in contextual help')}
            checked={form.show_in_contextual}
            onChange={(e) => setField('show_in_contextual', e.target.checked)}
          />
          <div className="form-actions">
            <Button type="submit" variant="primary" disabled={saveMut.isPending}>
              <Save size={18} aria-hidden /> {t('حفظ', 'Save')}
            </Button>
            <Link className="btn btn--outline" to="/admin/content-hub/help">
              <X size={18} aria-hidden /> {t('إلغاء', 'Cancel')}
            </Link>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
