import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CircleHelp, X } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { fetchContextualHelp } from '../../features/help/index.js';
import { useAuth } from '../../features/auth/index.js';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { getUserGuideBasePath } from './userGuidePaths.js';

export function ContextualHelpButton({ contextualKey, route, className = '' }) {
  const { t } = useTranslation('userGuide');
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const guideBase = getUserGuideBasePath(user, location.pathname);
  const relatedRoute = route || location.pathname;

  const { data, isLoading } = useQuery({
    queryKey: ['contextual-help', contextualKey, relatedRoute],
    queryFn: () => fetchContextualHelp({ key: contextualKey, route: relatedRoute }),
    enabled: open,
    staleTime: 120_000,
  });

  const articles = data?.articles ?? [];
  const guidePath = data?.guide_path || guideBase;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className={`btn--sm ug-contextual-btn ${className}`.trim()}
        onClick={() => setOpen(true)}
        aria-label={t('contextual.open')}
      >
        <CircleHelp size={16} aria-hidden />
        {t('contextual.open')}
      </Button>

      {open ? (
        <div className="ug-drawer-backdrop" onClick={() => setOpen(false)} role="presentation">
          <aside
            className="ug-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ug-contextual-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="ug-drawer__header">
              <h2 id="ug-contextual-title">{t('contextual.title')}</h2>
              <button
                type="button"
                className="ug-tour-modal__close"
                aria-label={t('tour.close')}
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
            <div className="ug-drawer__body">
              {isLoading ? <LoadingSpinner /> : null}
              {!isLoading && !articles.length ? <p>{t('contextual.empty')}</p> : null}
              <ul className="ug-drawer__list">
                {articles.map((a) => (
                  <li key={a.id}>
                    <strong>{a.title_ar}</strong>
                    {a.summary_ar ? <p>{a.summary_ar}</p> : null}
                    <Link to={`${guidePath}/articles/${a.slug}`} onClick={() => setOpen(false)}>
                      {t('contextual.readMore')}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <footer className="ug-drawer__footer">
              <Link className="btn btn--outline btn--sm" to={guidePath} onClick={() => setOpen(false)}>
                {t('contextual.openGuide')}
              </Link>
            </footer>
          </aside>
        </div>
      ) : null}
    </>
  );
}
