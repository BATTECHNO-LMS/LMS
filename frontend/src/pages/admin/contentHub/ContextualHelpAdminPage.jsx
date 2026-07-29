import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Save } from 'lucide-react';
import {
  AdminPageHeader,
  AdminFilterBar,
  SectionCard,
  SearchInput,
  StatusBadge,
} from '../../../components/admin/index.js';
import { Button } from '../../../components/common/Button.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { DataTable } from '../../../components/tables/DataTable.jsx';
import { FormInput, FormSwitch } from '../../../components/forms/index.js';
import { useLocale, useTr } from '../../../features/locale/index.js';
import { fetchAdminHelpArticles, updateAdminHelpArticle } from '../../../features/help/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';
import { contentStatusVariant, formatDate, statusLabel } from './contentHub.shared.js';

export function ContextualHelpAdminPage() {
  const t = useTr();
  const { locale, isArabic } = useLocale();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [route, setRoute] = useState('');
  const [key, setKey] = useState('');
  const [show, setShow] = useState(true);
  const [error, setError] = useState('');

  const articlesQuery = useQuery({
    queryKey: ['admin', 'help', 'articles', 'contextual'],
    queryFn: () => fetchAdminHelpArticles(),
  });

  const saveMut = useMutation({
    mutationFn: ({ id, body }) => updateAdminHelpArticle(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'help', 'articles'] });
      setEditing(null);
    },
  });

  const rows = useMemo(() => {
    let list = (articlesQuery.data?.articles || []).filter(
      (a) => a.show_in_contextual || a.related_route || a.contextual_key
    );
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (a) =>
          String(a.title_ar || '').toLowerCase().includes(term) ||
          String(a.related_route || '').toLowerCase().includes(term) ||
          String(a.contextual_key || '').toLowerCase().includes(term)
      );
    }
    return list;
  }, [articlesQuery.data, q]);

  function openEdit(row) {
    setEditing(row);
    setRoute(row.related_route || '');
    setKey(row.contextual_key || '');
    setShow(Boolean(row.show_in_contextual));
    setError('');
  }

  async function onSave() {
    setError('');
    try {
      await saveMut.mutateAsync({
        id: editing.id,
        body: {
          related_route: route.trim() || null,
          contextual_key: key.trim() || null,
          show_in_contextual: Boolean(show),
          expected_version: editing.version,
          expected_updated_at: editing.updated_at,
        },
      });
    } catch (err) {
      setError(getApiErrorMessage(err, t('تعذر الحفظ', 'Save failed')));
    }
  }

  return (
    <div className="page page--dashboard page--admin crud-page">
      <AdminPageHeader
        title={t('المساعدة السياقية', 'Contextual help')}
        description={t(
          'مقالات مرتبطة بمسارات أو مفاتيح سياقية داخل المنصة',
          'Articles linked to routes or contextual keys in the platform'
        )}
      />
      <AdminFilterBar>
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('بحث في العنوان أو المسار…', 'Search title or route…')}
          aria-label={t('بحث', 'Search')}
        />
      </AdminFilterBar>
      {error ? <p className="form-error">{error}</p> : null}

      <SectionCard title={t('المقالات السياقية', 'Contextual articles')}>
        {articlesQuery.isLoading ? (
          <LoadingSpinner />
        ) : (
          <DataTable
            emptyTitle={t('لا توجد مقالات سياقية', 'No contextual articles')}
            emptyDescription={
              articlesQuery.isError
                ? getApiErrorMessage(articlesQuery.error)
                : t('فعّل «إظهار في المساعدة السياقية» من صفحة المقال', 'Enable “show in contextual help” on an article')
            }
            columns={[
              { key: 'title_ar', label: t('العنوان', 'Title') },
              {
                key: 'related_route',
                label: t('المسار المرتبط', 'Related route'),
                render: (r) => r.related_route || '—',
              },
              {
                key: 'contextual_key',
                label: t('المفتاح السياقي', 'Contextual key'),
                render: (r) => r.contextual_key || '—',
              },
              {
                key: 'show_in_contextual',
                label: t('مفعّل', 'Enabled'),
                render: (r) => (r.show_in_contextual ? t('نعم', 'Yes') : t('لا', 'No')),
              },
              {
                key: 'status',
                label: t('الحالة', 'Status'),
                render: (r) => (
                  <StatusBadge variant={contentStatusVariant(r.status)}>{statusLabel(r.status, isArabic)}</StatusBadge>
                ),
              },
              {
                key: 'updated_at',
                label: t('آخر تحديث', 'Updated'),
                render: (r) => formatDate(r.updated_at, locale),
              },
              {
                key: 'actions',
                label: t('الإجراءات', 'Actions'),
                render: (r) => (
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <Button type="button" variant="outline" onClick={() => openEdit(r)}>
                      <Pencil size={16} aria-hidden />
                    </Button>
                    <Link className="btn btn--outline" to={`/admin/content-hub/help/${r.id}/edit`}>
                      {t('المقال', 'Article')}
                    </Link>
                  </div>
                ),
              },
            ]}
            rows={rows}
          />
        )}
      </SectionCard>

      {editing ? (
        <SectionCard title={`${t('تعديل السياق', 'Edit context')}: ${editing.title_ar}`}>
          <div className="form-grid">
            <FormInput
              id="ctx-route"
              label={t('المسار المرتبط', 'Related route')}
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              placeholder="/student/field-training"
            />
            <FormInput
              id="ctx-key"
              label={t('المفتاح السياقي', 'Contextual key')}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <FormSwitch
              id="ctx-show"
              label={t('إظهار في المساعدة السياقية', 'Show in contextual help')}
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
            />
            <div className="form-actions">
              <Button type="button" variant="primary" disabled={saveMut.isPending} onClick={onSave}>
                <Save size={18} aria-hidden /> {t('حفظ', 'Save')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {t('إلغاء', 'Cancel')}
              </Button>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
