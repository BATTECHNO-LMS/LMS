import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import {
  fetchAdminHelpAnalytics,
  fetchAdminHelpArticles,
  fetchAdminHelpCategories,
} from '../../../features/help/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function AdminHelpCenterPage() {
  const { t } = useTranslation('userGuide');
  const analyticsQuery = useQuery({
    queryKey: ['admin', 'help', 'analytics'],
    queryFn: fetchAdminHelpAnalytics,
  });
  const catsQuery = useQuery({
    queryKey: ['admin', 'help', 'categories'],
    queryFn: fetchAdminHelpCategories,
  });
  const articlesQuery = useQuery({
    queryKey: ['admin', 'help', 'articles'],
    queryFn: fetchAdminHelpArticles,
  });

  if (analyticsQuery.isLoading || catsQuery.isLoading || articlesQuery.isLoading) {
    return <LoadingSpinner />;
  }

  const analytics = analyticsQuery.data || {};
  const categories = catsQuery.data?.categories ?? [];
  const articles = articlesQuery.data?.articles ?? [];

  return (
    <div className="page page--admin ug-page">
      <h1 className="ug-page__title">{t('admin.title')}</h1>
      <p className="ug-page__desc">{t('admin.desc')}</p>

      {analyticsQuery.isError ? (
        <p className="form-field__error">{getApiErrorMessage(analyticsQuery.error)}</p>
      ) : null}

      <section className="ug-section">
        <h2>{t('admin.analytics')}</h2>
        <ul className="ug-mark-all-present-stats ug-admin-stats">
          <li>
            {t('admin.started')}: {analytics.onboarding?.started ?? 0}
          </li>
          <li>
            {t('admin.completed')}: {analytics.onboarding?.completed ?? 0}
          </li>
          <li>
            {t('admin.dismissed')}: {analytics.onboarding?.dismissed ?? 0}
          </li>
          <li>
            {t('admin.emptySearches')}: {analytics.empty_searches ?? 0}
          </li>
          <li>
            {t('admin.guideVersion')}: {analytics.guide_version}
          </li>
        </ul>
      </section>

      <section className="ug-section">
        <h2>{t('admin.topArticles')}</h2>
        <ul className="ug-article-list">
          {(analytics.top_articles || []).map((a) => (
            <li key={a.id}>
              {a.title_ar} — {a.view_count}
            </li>
          ))}
        </ul>
      </section>

      <section className="ug-section">
        <h2>
          {t('categoriesTitle')} ({categories.length})
        </h2>
        <ul className="ug-article-list">
          {categories.map((c) => (
            <li key={c.id}>
              {c.title_ar} ({c.slug}) — {c.articles_count ?? 0}
            </li>
          ))}
        </ul>
      </section>

      <section className="ug-section">
        <h2>
          {t('admin.articles')} ({articles.length})
        </h2>
        <ul className="ug-article-list">
          {articles.map((a) => (
            <li key={a.id}>
              {a.title_ar} · {a.is_published ? t('admin.published') : t('admin.hidden')}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
