import { useState } from 'react';
import { Link } from 'react-router-dom';
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
import {
  fetchHelpArticles,
  fetchHelpCategories,
  restartFieldTrainingOnboarding,
  searchHelp,
} from '../../../features/help/index.js';
import { FieldTrainingTourHost } from '../../../components/help/FieldTrainingTourHost.jsx';
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
    mutationFn: restartFieldTrainingOnboarding,
    onSuccess: () => {
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
      <header className="ug-page__hero">
        <div>
          <p className="ug-page__eyebrow">{t('eyebrow')}</p>
          <h1 className="ug-page__title">{t('title')}</h1>
          <p className="ug-page__desc">{t('description')}</p>
        </div>
        <div className="ug-page__hero-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={restartMut.isPending}
            onClick={() => restartMut.mutate()}
          >
            <PlayCircle size={16} aria-hidden /> {t('restartTour')}
          </Button>
          <Link className="btn btn--outline" to="/student/user-guide/support">
            <LifeBuoy size={16} aria-hidden /> {t('contactSupport')}
          </Link>
        </div>
      </header>

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
                <Link to={`/student/user-guide/articles/${a.slug}`}>{a.title_ar}</Link>
                {a.summary_ar ? <p>{a.summary_ar}</p> : null}
              </li>
            ))}
          </ul>
          {searchQuery.data?.empty ? (
            <Link className="btn btn--outline btn--sm" to="/student/user-guide/support">
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
              <Link key={c.id} className="ug-category-card" to={`/student/user-guide/${c.slug}`}>
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
              <Link to={`/student/user-guide/articles/${a.slug}`}>{t('readArticle')}</Link>
            </details>
          ))}
        </div>
      </section>

      {forceTour ? (
        <FieldTrainingTourHost forceOpen onCloseForce={() => setForceTour(false)} />
      ) : null}
    </div>
  );
}
