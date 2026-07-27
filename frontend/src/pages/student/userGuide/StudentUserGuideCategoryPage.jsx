import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { fetchHelpArticles, fetchHelpCategories } from '../../../features/help/index.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function StudentUserGuideCategoryPage() {
  const { categorySlug } = useParams();
  const { t } = useTranslation('userGuide');

  const catsQuery = useQuery({
    queryKey: ['help', 'categories'],
    queryFn: fetchHelpCategories,
  });
  const articlesQuery = useQuery({
    queryKey: ['help', 'articles', categorySlug],
    queryFn: () => fetchHelpArticles({ category: categorySlug }),
    enabled: Boolean(categorySlug),
  });

  const category = (catsQuery.data?.categories ?? []).find((c) => c.slug === categorySlug);
  const articles = articlesQuery.data?.articles ?? [];

  if (catsQuery.isLoading || articlesQuery.isLoading) return <LoadingSpinner />;

  if (!category) {
    return <EmptyState title={t('categoryMissing')} description={t('categoryMissingDesc')} />;
  }

  return (
    <div className="page page--student ug-page">
      <nav className="ug-breadcrumbs" aria-label="breadcrumb">
        <Link to="/student/user-guide">{t('title')}</Link>
        <span aria-hidden>/</span>
        <span>{category.title_ar}</span>
      </nav>
      <header className="ug-page__hero ug-page__hero--compact">
        <div>
          <h1 className="ug-page__title">{category.title_ar}</h1>
          <p className="ug-page__desc">{category.description_ar}</p>
        </div>
        <Link className="btn btn--outline btn--sm" to="/student/user-guide">
          <ArrowRight size={16} aria-hidden /> {t('back')}
        </Link>
      </header>
      {articlesQuery.isError ? (
        <p className="form-field__error">{getApiErrorMessage(articlesQuery.error)}</p>
      ) : null}
      <ul className="ug-article-list">
        {articles.map((a) => (
          <li key={a.id}>
            <Link to={`/student/user-guide/articles/${a.slug}`}>{a.title_ar}</Link>
            {a.summary_ar ? <p>{a.summary_ar}</p> : null}
          </li>
        ))}
      </ul>
      {!articles.length ? <EmptyState title={t('noArticles')} /> : null}
    </div>
  );
}
