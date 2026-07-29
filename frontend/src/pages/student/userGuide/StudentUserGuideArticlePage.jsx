import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { useAuth } from '../../../features/auth/index.js';
import { fetchHelpArticle, recordHelpArticleView } from '../../../features/help/index.js';
import { getUserGuideBasePath } from '../../../components/help/userGuidePaths.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

export function StudentUserGuideArticlePage() {
  const { slug } = useParams();
  const { t } = useTranslation('userGuide');
  const { user } = useAuth();
  const location = useLocation();
  const guideBase = getUserGuideBasePath(user, location.pathname);

  const articleQuery = useQuery({
    queryKey: ['help', 'article', slug],
    queryFn: () => fetchHelpArticle(slug),
    enabled: Boolean(slug),
  });

  const article = articleQuery.data?.article;

  useEffect(() => {
    if (!article?.id) return undefined;
    const timer = setTimeout(() => {
      recordHelpArticleView(article.id).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [article?.id]);

  if (articleQuery.isLoading) return <LoadingSpinner />;
  if (articleQuery.isError) {
    return (
      <EmptyState
        title={t('articleMissing')}
        description={getApiErrorMessage(articleQuery.error)}
      />
    );
  }
  if (!article) return <EmptyState title={t('articleMissing')} />;

  return (
    <div className="page page--student ug-page">
      <nav className="ug-breadcrumbs" aria-label="breadcrumb">
        <Link to={guideBase}>{t('title')}</Link>
        <span aria-hidden>/</span>
        {article.category_slug ? (
          <Link to={`${guideBase}/${article.category_slug}`}>{article.category_title_ar}</Link>
        ) : null}
        <span aria-hidden>/</span>
        <span>{article.title_ar}</span>
      </nav>
      <article className="ug-article">
        <header className="ug-page__hero ug-page__hero--compact">
          <div>
            <h1 className="ug-page__title">{article.title_ar}</h1>
            {article.summary_ar ? <p className="ug-page__desc">{article.summary_ar}</p> : null}
          </div>
          <Link className="btn btn--outline btn--sm" to={guideBase}>
            <ArrowRight size={16} aria-hidden /> {t('back')}
          </Link>
        </header>
        <div className="ug-article__content">
          {String(article.content_ar || '')
            .split(/\n+/)
            .filter(Boolean)
            .map((para) => (
              <p key={para.slice(0, 24)}>{para}</p>
            ))}
        </div>
        <footer className="ug-article__footer">
          <Link className="btn btn--outline" to={`${guideBase}/support`}>
            {t('stillNeedHelp')}
          </Link>
        </footer>
      </article>
    </div>
  );
}
