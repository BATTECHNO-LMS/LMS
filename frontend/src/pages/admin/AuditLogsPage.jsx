import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { AdminPageHeader, SectionCard } from '../../components/admin/index.js';
import { StatusBadge } from '../../components/admin/StatusBadge.jsx';
import { SideDrawer } from '../../components/activity/SideDrawer.jsx';
import { AuditEventDetails } from '../../components/activity/AuditEventDetails.jsx';
import { useAuth } from '../../features/auth/index.js';
import { useUniversities } from '../../features/universities/hooks/useUniversities.js';
import {
  fetchAuditCatalog,
  fetchAuditLogById,
  fetchAuditLogsList,
} from '../../features/auditLogs/auditLogs.service.js';
import {
  AUDIT_AUTO_REFRESH_MS,
  AUDIT_PAGE_SIZES,
  ROLE_LABELS_AR,
  actionLabel,
  actorLabel,
  buildAuditQueryParams,
  countActiveFilters,
  formatAuditDateTime,
  outcomeVariant,
  subjectLabel,
} from '../../features/auditLogs/auditPresentation.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

const FILTER_KEYS = [
  'from',
  'to',
  'search',
  'category',
  'outcome',
  'actionType',
  'actorRole',
  'universityId',
  'organizationId',
  'entityType',
  'entityId',
  'sessionId',
  'userId',
  'subjectUserId',
  'involvingUserId',
];

function readFilters(searchParams) {
  const out = {};
  for (const key of FILTER_KEYS) out[key] = searchParams.get(key) || '';
  return out;
}

function isSuperAdmin(user) {
  return Boolean(user?.isGlobal || user?.role === 'super_admin');
}

function FilterFields({ draft, setDraft, catalog, superAdmin, universities }) {
  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));
  const actions = useMemo(() => {
    const list = (catalog?.actions || []).filter((a) => !a.legacy || superAdmin);
    const scoped = draft.category ? list.filter((a) => a.category === draft.category) : list;
    return [...scoped].sort((a, b) => a.label_ar.localeCompare(b.label_ar, 'ar'));
  }, [catalog, draft.category, superAdmin]);

  return (
    <div className="activity-log__filters-grid">
      <div className="form-field">
        <label className="form-field__label" htmlFor="al-search">
          المستخدم (الاسم أو البريد)
        </label>
        <input
          id="al-search"
          className="form-field__control"
          type="search"
          value={draft.search}
          onChange={set('search')}
          placeholder="ابحث باسم المستخدم أو بريده"
        />
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="al-from">
          من تاريخ
        </label>
        <input id="al-from" className="form-field__control" type="date" value={draft.from} onChange={set('from')} />
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="al-to">
          إلى تاريخ
        </label>
        <input id="al-to" className="form-field__control" type="date" value={draft.to} onChange={set('to')} />
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="al-category">
          القسم
        </label>
        <select
          id="al-category"
          className="form-field__control"
          value={draft.category}
          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value, actionType: '' }))}
        >
          <option value="">كل الأقسام</option>
          {(catalog?.categories || []).map((c) => (
            <option key={c.code} value={c.code}>
              {c.label_ar}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="al-action">
          العملية
        </label>
        <select id="al-action" className="form-field__control" value={draft.actionType} onChange={set('actionType')}>
          <option value="">كل العمليات</option>
          {actions.map((a) => (
            <option key={a.code} value={a.code}>
              {superAdmin ? `${a.label_ar} (${a.code})` : a.label_ar}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="al-outcome">
          النتيجة
        </label>
        <select id="al-outcome" className="form-field__control" value={draft.outcome} onChange={set('outcome')}>
          <option value="">كل النتائج</option>
          {(catalog?.outcomes || []).map((o) => (
            <option key={o.code} value={o.code}>
              {o.label_ar}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="al-role">
          دور المنفّذ
        </label>
        <select id="al-role" className="form-field__control" value={draft.actorRole} onChange={set('actorRole')}>
          <option value="">كل الأدوار</option>
          {Object.entries(ROLE_LABELS_AR).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {superAdmin ? (
        <div className="form-field">
          <label className="form-field__label" htmlFor="al-university">
            الجامعة
          </label>
          <select
            id="al-university"
            className="form-field__control"
            value={draft.universityId}
            onChange={set('universityId')}
          >
            <option value="">كل الجامعات</option>
            {(universities || []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="form-field">
        <label className="form-field__label" htmlFor="al-entity-type">
          نوع الكيان
        </label>
        <input
          id="al-entity-type"
          className="form-field__control"
          value={draft.entityType}
          onChange={set('entityType')}
          placeholder="مثال: field_training_task"
          dir="ltr"
        />
      </div>
      <div className="form-field">
        <label className="form-field__label" htmlFor="al-entity-id">
          معرّف الكيان
        </label>
        <input
          id="al-entity-id"
          className="form-field__control"
          value={draft.entityId}
          onChange={set('entityId')}
          placeholder="UUID"
          dir="ltr"
        />
      </div>
      {superAdmin ? (
        <>
          <div className="form-field">
            <label className="form-field__label" htmlFor="al-org">
              معرّف الجهة
            </label>
            <input
              id="al-org"
              className="form-field__control"
              value={draft.organizationId}
              onChange={set('organizationId')}
              placeholder="UUID"
              dir="ltr"
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="al-session">
              معرّف الجلسة
            </label>
            <input
              id="al-session"
              className="form-field__control"
              value={draft.sessionId}
              onChange={set('sessionId')}
              placeholder="UUID"
              dir="ltr"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

export function AuditLogsPage() {
  useDocumentTitle('سجل النشاط');
  const { user } = useAuth();
  const superAdmin = isSuperAdmin(user);
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = AUDIT_PAGE_SIZES.includes(Number(searchParams.get('page_size')))
    ? Number(searchParams.get('page_size'))
    : 25;
  const [draft, setDraft] = useState(filters);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => setDraft(filters), [filters]);

  const writeParams = useCallback(
    (nextFilters, nextPage = 1, nextSize = pageSize) => {
      const sp = new URLSearchParams();
      for (const key of FILTER_KEYS) {
        const v = String(nextFilters[key] || '').trim();
        if (v) sp.set(key, v);
      }
      if (nextPage > 1) sp.set('page', String(nextPage));
      if (nextSize !== 25) sp.set('page_size', String(nextSize));
      setSearchParams(sp, { replace: true });
    },
    [pageSize, setSearchParams]
  );

  const queryParams = useMemo(
    () => buildAuditQueryParams(filters, { page, pageSize }),
    [filters, page, pageSize]
  );

  const catalogQuery = useQuery({
    queryKey: ['audit-logs', 'catalog'],
    queryFn: fetchAuditCatalog,
    staleTime: 60 * 60 * 1000,
  });
  const universitiesQuery = useUniversities({ enabled: superAdmin });

  const listQuery = useQuery({
    queryKey: ['audit-logs', 'list', queryParams],
    queryFn: () => fetchAuditLogsList(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchInterval: autoRefresh ? AUDIT_AUTO_REFRESH_MS : false,
    refetchIntervalInBackground: false,
  });

  const detailQuery = useQuery({
    queryKey: ['audit-logs', 'detail', selectedId],
    queryFn: () => fetchAuditLogById(selectedId),
    enabled: Boolean(selectedId),
    staleTime: 60_000,
  });

  const rows = listQuery.data?.audit_logs ?? [];
  const meta = listQuery.data?.meta ?? { page, total: 0, total_pages: 1 };
  const activeCount = countActiveFilters(filters);
  const categories = catalogQuery.data?.categories || [];

  const applyFilters = (e) => {
    e?.preventDefault?.();
    writeParams(draft, 1);
    setMobileFiltersOpen(false);
  };
  const resetFilters = () => {
    const empty = Object.fromEntries(FILTER_KEYS.map((k) => [k, '']));
    setDraft(empty);
    writeParams(empty, 1);
    setMobileFiltersOpen(false);
  };
  const setCategoryChip = (code) => writeParams({ ...filters, category: code, actionType: '' }, 1);

  return (
    <div className="page page--dashboard page--admin activity-log">
      <AdminPageHeader
        title="سجل النشاط"
        description="سجل موحّد لعمليات المستخدمين والجلسات والإجراءات الإدارية ضمن نطاق صلاحياتك."
        icon={ScrollText}
        actions={
          <div className="activity-log__header-actions">
            <label className="activity-log__toggle">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              <span>تحديث تلقائي كل 30 ثانية</span>
            </label>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => listQuery.refetch()}
              disabled={listQuery.isFetching}
            >
              <RefreshCw size={16} className={listQuery.isFetching ? 'activity-log__spin' : undefined} aria-hidden />
              <span>تحديث</span>
            </button>
          </div>
        }
      />

      <div className="activity-log__chips" role="toolbar" aria-label="تصفية حسب القسم">
        <button
          type="button"
          className={`activity-chip${!filters.category ? ' activity-chip--active' : ''}`}
          aria-pressed={!filters.category}
          onClick={() => setCategoryChip('')}
        >
          الكل
        </button>
        {categories.map((c) => (
          <button
            key={c.code}
            type="button"
            className={`activity-chip${filters.category === c.code ? ' activity-chip--active' : ''}`}
            aria-pressed={filters.category === c.code}
            onClick={() => setCategoryChip(c.code)}
          >
            {c.label_ar}
          </button>
        ))}
      </div>

      <SectionCard className="activity-log__filters activity-log__filters--desktop">
        <form onSubmit={applyFilters}>
          <FilterFields
            draft={draft}
            setDraft={setDraft}
            catalog={catalogQuery.data}
            superAdmin={superAdmin}
            universities={universitiesQuery.data?.universities}
          />
          <div className="activity-log__filter-actions">
            <button type="submit" className="btn btn--primary btn--sm">
              تطبيق الفلاتر
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={resetFilters} disabled={!activeCount}>
              مسح الفلاتر
            </button>
          </div>
        </form>
      </SectionCard>

      <div className="activity-log__mobile-bar">
        <button type="button" className="btn btn--outline btn--sm" onClick={() => setMobileFiltersOpen(true)}>
          <Filter size={16} aria-hidden />
          <span>الفلاتر{activeCount ? ` (${activeCount})` : ''}</span>
        </button>
        {activeCount ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={resetFilters}>
            <XCircle size={16} aria-hidden />
            <span>مسح</span>
          </button>
        ) : null}
      </div>

      <SideDrawer
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        title="الفلاتر"
        footer={
          <div className="activity-log__filter-actions">
            <button type="button" className="btn btn--primary" onClick={applyFilters}>
              تطبيق
            </button>
            <button type="button" className="btn btn--ghost" onClick={resetFilters}>
              مسح الفلاتر
            </button>
          </div>
        }
      >
        <FilterFields
          draft={draft}
          setDraft={setDraft}
          catalog={catalogQuery.data}
          superAdmin={superAdmin}
          universities={universitiesQuery.data?.universities}
        />
      </SideDrawer>

      <SectionCard
        className="activity-log__results"
        title={
          <span className="activity-log__results-title">
            النتائج
            <span className="activity-log__count">{meta.total ?? 0}</span>
          </span>
        }
      >
        {listQuery.isError ? (
          <div className="activity-log__state activity-log__state--error" role="alert">
            <ShieldAlert size={22} aria-hidden />
            <p>{getApiErrorMessage(listQuery.error, 'تعذر تحميل سجل النشاط.')}</p>
          </div>
        ) : null}

        {listQuery.isLoading ? (
          <div className="activity-log__skeleton" aria-busy="true" aria-live="polite">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="activity-log__skeleton-row" />
            ))}
          </div>
        ) : null}

        {!listQuery.isLoading && !listQuery.isError && rows.length === 0 ? (
          <div className="activity-log__state">
            <ScrollText size={28} aria-hidden />
            <p className="activity-log__state-title">لا توجد أحداث</p>
            <p>لا توجد سجلات مطابقة للفلاتر الحالية.</p>
          </div>
        ) : null}

        {rows.length ? (
          <>
            <div className="activity-log__table-wrap">
              <table className="activity-log__table">
                <thead>
                  <tr>
                    <th scope="col">التاريخ والوقت</th>
                    <th scope="col">العملية</th>
                    <th scope="col">القسم</th>
                    <th scope="col">بواسطة</th>
                    <th scope="col">المستخدم المتأثر</th>
                    <th scope="col">النتيجة</th>
                    <th scope="col">الجهة</th>
                    <th scope="col">
                      <span className="sr-only">التفاصيل</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="activity-log__time">{formatAuditDateTime(r.created_at)}</td>
                      <td>
                        <span className="activity-log__action">{actionLabel(r, { showRaw: superAdmin })}</span>
                        {superAdmin ? (
                          <code className="activity-log__code" dir="ltr">
                            {r.action_type}
                          </code>
                        ) : null}
                      </td>
                      <td>{r.category_label}</td>
                      <td>{actorLabel(r)}</td>
                      <td>{subjectLabel(r) || '—'}</td>
                      <td>
                        <StatusBadge variant={outcomeVariant(r.outcome)}>{r.outcome_label}</StatusBadge>
                      </td>
                      <td>{r.university?.name || r.organization?.name || '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => setSelectedId(r.id)}
                          aria-label={`عرض تفاصيل: ${actionLabel(r)}`}
                        >
                          <Eye size={16} aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="activity-log__cards">
              {rows.map((r) => (
                <li key={r.id}>
                  <button type="button" className="activity-card" onClick={() => setSelectedId(r.id)}>
                    <span className="activity-card__top">
                      <span className="activity-card__action">{actionLabel(r, { showRaw: superAdmin })}</span>
                      <StatusBadge variant={outcomeVariant(r.outcome)}>{r.outcome_label}</StatusBadge>
                    </span>
                    <span className="activity-card__meta">
                      {r.category_label} · {formatAuditDateTime(r.created_at)}
                    </span>
                    <span className="activity-card__who">بواسطة: {actorLabel(r)}</span>
                    {subjectLabel(r) ? (
                      <span className="activity-card__who">المستخدم المتأثر: {subjectLabel(r)}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <nav className="activity-log__pagination" aria-label="ترقيم الصفحات">
          <div className="activity-log__page-size">
            <label htmlFor="al-page-size">عدد السجلات</label>
            <select
              id="al-page-size"
              className="form-field__control"
              value={pageSize}
              onChange={(e) => writeParams(filters, 1, Number(e.target.value))}
            >
              {AUDIT_PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="activity-log__pager">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={page <= 1 || listQuery.isFetching}
              onClick={() => writeParams(filters, page - 1)}
              aria-label="الصفحة السابقة"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
            <span aria-live="polite">
              صفحة {meta.page ?? page} من {meta.total_pages ?? 1}
            </span>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={page >= (meta.total_pages ?? 1) || listQuery.isFetching}
              onClick={() => writeParams(filters, page + 1)}
              aria-label="الصفحة التالية"
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
          </div>
        </nav>
      </SectionCard>

      <SideDrawer
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title="تفاصيل الحدث"
        subtitle={detailQuery.data?.audit_log?.category_label}
      >
        {detailQuery.isLoading ? <p className="crud-muted">جارٍ التحميل…</p> : null}
        {detailQuery.isError ? (
          <p className="activity-log__state--error" role="alert">
            {getApiErrorMessage(detailQuery.error, 'تعذر تحميل تفاصيل الحدث.')}
          </p>
        ) : null}
        <AuditEventDetails
          row={detailQuery.data?.audit_log}
          showTechnical={superAdmin}
          onFilterSession={(sid) => {
            setSelectedId(null);
            writeParams({ ...Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])), sessionId: sid }, 1);
          }}
        />
      </SideDrawer>
    </div>
  );
}
