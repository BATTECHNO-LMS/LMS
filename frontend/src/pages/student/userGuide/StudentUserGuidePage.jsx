import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Award,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarDays,
  FileCheck,
  LifeBuoy,
  ListChecks,
  PlayCircle,
  Search,
  UserRound,
} from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { FormInput } from '../../../components/forms/FormInput.jsx';
import { LoadingSpinner } from '../../../components/common/LoadingSpinner.jsx';
import { EmptyState } from '../../../components/common/EmptyState.jsx';
import { PageShell } from '../../../components/designSystem/index.js';
import { useAuth } from '../../../features/auth/index.js';
import {
  fetchHelpArticles,
  fetchHelpCategories,
  restartFieldTrainingOnboarding,
  restartOnboardingByKey,
  searchHelp,
} from '../../../features/help/index.js';
import { FieldTrainingTourHost } from '../../../components/help/FieldTrainingTourHost.jsx';
import { getUserGuideBasePath } from '../../../components/help/userGuidePaths.js';
import { guideKeyForRole } from '../../../features/help/tourSteps.js';
import { getApiErrorMessage } from '../../../services/apiHelpers.js';

const ICONS = {
  UserRound,
  Briefcase,
  CalendarDays,
  FileCheck,
  ListChecks,
  BarChart3,
  Award,
  AlertTriangle,
  LifeBuoy,
  BookOpen,
};

export function StudentUserGuidePage() {
  const { t } = useTranslation('userGuide');
  const { user } = useAuth();
  const location = useLocation();
  const guideBase = getUserGuideBasePath(user, location.pathname);
  const guideKey = guideKeyForRole(user?.role);
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [forceTour, setForceTour] = useState(false);

  const catsQuery = useQuery({
    queryKey: ['help', 'categories'],
    queryFn: fetchHelpCategories,
  });
  const faqQuery = useQuery({
    queryKey: ['help', 'faq'],
    queryFn: () => fetchHelpArticles({ faq: true }),
  });
  const searchQuery = useQuery({
    queryKey: ['help', 'search', searchTerm],
    queryFn: () => searchHelp(searchTerm),
    enabled: searchTerm.trim().length >= 2,
  });

  const restartMut = useMutation({
    mutationFn: () => {
      if (guideKey) return restartOnboardingByKey(guideKey);
      return restartFieldTrainingOnboarding();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onboarding'] });
      qc.invalidateQueries({ queryKey: ['student', 'onboarding', 'field-training'] });
      setForceTour(true);
    },
  });

  const categories = catsQuery.data?.categories ?? [];
  const faqs = faqQuery.data?.articles ?? [];
  const results = searchQuery.data?.results ?? [];

  const onSearch = (e) => {
    e.preventDefault();
    setSearchTerm(q.trim());
  };

  return (
    <div className="page page--student ug-page" data-tour-id="user-guide">
      <PageShell
        className="ug-page__shell"
        maxWidth="xl"
        breadcrumbs={<p className="ug-page__eyebrow">{t('eyebrow')}</p>}
        title={t('title')}
        description={t('description')}
        actions={
          <div className="ug-page__hero-actions page-shell__actions">
            {guideKey ? (
              <Button
                type="button"
                variant="secondary"
                disabled={restartMut.isPending}
                onClick={() => restartMut.mutate()}
              >
                <PlayCircle size={16} aria-hidden /> {t('restartTour')}
              </Button>
            ) : null}
            <Link className="btn btn--outline" to={`${guideBase}/support`}>
              <LifeBuoy size={16} aria-hidden /> {t('contactSupport')}
            </Link>
          </div>
        }
      >
        <form className="ug-search" onSubmit={onSearch} role="search">
          <FormInput
            label={t('searchLabel')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('searchPlaceholder')}
          />
          <Button type="submit" variant="primary">
            <Search size={16} aria-hidden /> {t('search')}
          </Button>
        </form>

        {searchTerm ? (
          <section className="ug-section" aria-live="polite">
            <h2>{t('searchResults', { q: searchTerm })}</h2>
            {searchQuery.isLoading ? <LoadingSpinner /> : null}
            {!searchQuery.isLoading && !results.length ? (
              <EmptyState
                title={t('noResultsTitle')}
                description={t('noResultsDesc')}
              />
            ) : null}
            <ul className="ug-article-list">
              {results.map((a) => (
                <li key={a.id}>
                  <Link to={`${guideBase}/articles/${a.slug}`}>{a.title_ar}</Link>
                  {a.summary_ar ? <p>{a.summary_ar}</p> : null}
                </li>
              ))}
            </ul>
            {searchQuery.data?.empty ? (
              <Link className="btn btn--outline btn--sm" to={`${guideBase}/support`}>
                {t('contactSupport')}
              </Link>
            ) : null}
          </section>
        ) : null}

        <section className="ug-section">
          <h2>{t('categoriesTitle')}</h2>
          {catsQuery.isLoading ? <LoadingSpinner /> : null}
          {catsQuery.isError ? (
            <p className="form-field__error">{getApiErrorMessage(catsQuery.error)}</p>
          ) : null}
          <div className="ug-category-grid">
            {categories.map((c) => {
              const Icon = ICONS[c.icon] || BookOpen;
              return (
                <Link key={c.id} className="ug-category-card" to={`${guideBase}/${c.slug}`}>
                  <Icon size={22} aria-hidden />
                  <h3>{c.title_ar}</h3>
                  <p>{c.description_ar}</p>
                  <span>{t('articlesCount', { count: c.articles_count ?? 0 })}</span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="ug-section">
          <h2>{t('faqTitle')}</h2>
          <div className="ug-faq">
            {faqs.slice(0, 8).map((a) => (
              <details key={a.id} className="ug-faq__item">
                <summary>{a.title_ar}</summary>
                <p>{a.summary_ar}</p>
                <Link to={`${guideBase}/articles/${a.slug}`}>{t('readArticle')}</Link>
              </details>
            ))}
          </div>
        </section>

        {forceTour ? (
          <FieldTrainingTourHost forceOpen onCloseForce={() => setForceTour(false)} />
        ) : null}
      </PageShell>
    </div>
  );
}
