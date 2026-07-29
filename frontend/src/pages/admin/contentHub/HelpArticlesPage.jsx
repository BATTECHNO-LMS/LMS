import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Eye, History, Pencil, Plus, Send } from 'lucide-react';
import {
  AdminPageHeader,
  AdminActionBar,
  AdminFilterBar,
  SectionCard,
  SearchInput,
  SelectField,
  StatusBadge,
} from '../../../components/admin/index.js';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { useTr } from '../../../features/locale/index.js';
import { useLocale } from '../../../features/locale/index.js';
import {
  archiveAdminHelpArticle,
  fetchAdminHelpArticleVersions,
  fetchAdminHelpArticles,
  fetchAdminHelpCategories,
  publishAdminHelpArticle,
  restoreAdminHelpArticleVersion,
} from '../../../features/help/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import {
  CONTENT_STATUSES,
  ROLE_LABELS,
  ROLE_OPTIONS,
  contentStatusVariant,
  formatDate,
  statusLabel,
} from './contentHub.shared.js';

export function HelpArticlesPage() {
  const t = useTr();
  const { locale, isArabic } = useLocale();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [versionsFor, setVersionsFor] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const catsQuery = useQuery({
    queryKey: ['admin', 'help', 'categories'],
    queryFn: fetchAdminHelpCategories,
  });
  const articlesQuery = useQuery({
    queryKey: ['admin', 'help', 'articles', categoryId || 'all'],
    queryFn: () => fetchAdminHelpArticles(categoryId ? { categoryId } : {}),
  });
  const versionsQuery = useQuery({
    queryKey: ['admin', 'help', 'versions', versionsFor?.id],
    queryFn: () => fetchAdminHelpArticleVersions(versionsFor.id),
    enabled: Boolean(versionsFor?.id),
  });

  const publishMut = useMutation({
    mutationFn: ({ id, publish }) => publishAdminHelpArticle(id, publish),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'help', 'articles'] }),
  });
  const archiveMut = useMutation({
    mutationFn: (id) => archiveAdminHelpArticle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'help', 'articles'] }),
  });
  const restoreMut = useMutation({
    mutationFn: ({ id, version }) => restoreAdminHelpArticleVersion(id, version),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'help'] });
      setVersionsFor(null);
    },
  });

  const categories = catsQuery.data?.categories ?? [];
  const rows = useMemo(() => {
    let list = articlesQuery.data?.articles ?? [];
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (a) =>
          String(a.title_ar || '').toLowerCase().includes(term) ||
          String(a.slug || '').toLowerCase().includes(term) ||
          String(a.category_title_ar || '').toLowerCase().includes(term)
      );
    }
    if (status) list = list.filter((a) => String(a.status || '').toUpperCase() === status);
    if (role) list = list.filter((a) => (a.target_roles || []).includes(role));
    return list;
  }, [articlesQuery.data, q, status, role]);

  async function runAction(fn) {
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(getApiErrorMessage(err, t('تعذر إكمال العملية', 'Action failed')));
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={t('دليل المستخدم', 'User guide')}
        description={t('إدارة مقالات المساعدة والأسئلة الشائعة', 'Manage help articles and FAQs')}
      />
      <AdminActionBar>
        <Link className="btn btn--primary" to="/admin/content-hub/help/create">
          <Plus size={18} aria-hidden /> {t('مقال جديد', 'New article')}
        </Link>
      </AdminActionBar>
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('بحث في العنوان أو التصنيف…', 'Search title or category…')}
          aria-label={t('بحث', 'Search')}
        />
        <SelectField id="help-cat" label={t('التصنيف', 'Category')} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">{t('كل التصنيفات', 'All categories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title_ar}
            </option>
          ))}
        </SelectField>
        <SelectField id="help-role" label={t('الدور', 'Role')} value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">{t('كل الأدوار', 'All roles')}</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {(isArabic ? ROLE_LABELS.ar : ROLE_LABELS.en)[r]}
            </option>
          ))}
        </SelectField>
        <SelectField id="help-status" label={t('الحالة', 'Status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('كل الحالات', 'All statuses')}</option>
          {CONTENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s, isArabic)}
            </option>
          ))}
        </SelectField>
      </AdminFilterBar>

      {error ? <p className="form-error">{error}</p> : null}

      <SectionCard title={t('المقالات', 'Articles')}>
        {articlesQuery.isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={t('لا توجد مقالات', 'No articles')}
            emptyDescription={
              articlesQuery.isError
                ? getApiErrorMessage(articlesQuery.error)
                : t('جرّب تغيير عوامل التصفية أو أنشئ مقالاً جديداً', 'Try different filters or create an article')
            }
            columns={[
              { key: 'title_ar', label: t('العنوان', 'Title') },
              {
                key: 'category_title_ar',
                label: t('التصنيف', 'Category'),
                render: (r) => r.category_title_ar || '—',
              },
              {
                key: 'target_roles',
                label: t('الأدوار', 'Roles'),
                render: (r) =>
                  (r.target_roles || []).length
                    ? (r.target_roles || [])
                        .map((code) => (isArabic ? ROLE_LABELS.ar : ROLE_LABELS.en)[code] || code)
                        .join('، ')
                    : t('الكل', 'All'),
              },
              {
                key: 'status',
                label: t('الحالة', 'Status'),
                render: (r) => (
                  <StatusBadge variant={contentStatusVariant(r.status)}>{statusLabel(r.status, isArabic)}</StatusBadge>
                ),
              },
              { key: 'version', label: t('الإصدار', 'Version'), render: (r) => r.version ?? '—' },
              {
                key: 'updated_at',
                label: t('آخر تحديث', 'Updated'),
                render: (r) => formatDate(r.updated_at, locale),
              },
              { key: 'view_count', label: t('المشاهدات', 'Views'), render: (r) => r.view_count ?? 0 },
              {
                key: 'actions',
                label: t('الإجراءات', 'Actions'),
                render: (r) => (
                  <div className="table-icon-actions" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <Button type="button" variant="outline" className="btn--sm" onClick={() => setPreview(r)} title={t('معاينة', 'Preview')}>
                      <Eye size={16} aria-hidden />
                    </Button>
                    <Link className="btn btn--outline btn--sm" to={`/admin/content-hub/help/${r.id}/edit`} title={t('تعديل', 'Edit')}>
                      <Pencil size={16} aria-hidden />
                    </Link>
                    {String(r.status).toUpperCase() !== 'PUBLISHED' ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="btn--sm"
                        disabled={publishMut.isPending}
                        onClick={() => runAction(() => publishMut.mutateAsync({ id: r.id, publish: true }))}
                        title={t('نشر', 'Publish')}
                      >
                        <Send size={16} aria-hidden />
                      </Button>
                    ) : null}
                    {String(r.status).toUpperCase() !== 'ARCHIVED' ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="btn--sm"
                        disabled={archiveMut.isPending}
                        onClick={() => runAction(() => archiveMut.mutateAsync(r.id))}
                        title={t('أرشفة', 'Archive')}
                      >
                        <Archive size={16} aria-hidden />
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" className="btn--sm" onClick={() => setVersionsFor(r)} title={t('الإصدارات', 'Versions')}>
                      <History size={16} aria-hidden />
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>

      {preview ? (
        <div className="modal-overlay" role="presentation" onMouseDown={() => setPreview(null)}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 720 }} onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="modal__title">{preview.title_ar}</h2>
            <p className="modal__message">{preview.summary_ar || '—'}</p>
            <div
              className="ug-article-body"
              style={{ maxHeight: 360, overflow: 'auto', textAlign: 'start' }}
              dangerouslySetInnerHTML={{ __html: preview.content_ar || '' }}
            />
            <div className="modal__actions">
              <Button type="button" variant="outline" onClick={() => setPreview(null)}>
                {t('إغلاق', 'Close')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {versionsFor ? (
        <div className="modal-overlay" role="presentation" onMouseDown={() => setVersionsFor(null)}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 640 }} onMouseDown={(e) => e.stopPropagation()}>
            <h2 className="modal__title">
              {t('إصدارات', 'Versions')}: {versionsFor.title_ar}
            </h2>
            {versionsQuery.isLoading ? (
              <LoadingSpinner />
            ) : (
              <ul className="ug-article-list">
                {(versionsQuery.data?.versions || []).map((v) => (
                  <li key={v.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                    <span>
                      v{v.version} — {formatDate(v.created_at, locale)}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      className="btn--sm"
                      disabled={restoreMut.isPending}
                      onClick={() =>
                        runAction(() => restoreMut.mutateAsync({ id: versionsFor.id, version: v.version }))
                      }
                    >
                      {t('استعادة', 'Restore')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="modal__actions">
              <Button type="button" variant="outline" onClick={() => setVersionsFor(null)}>
                {t('إغلاق', 'Close')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
