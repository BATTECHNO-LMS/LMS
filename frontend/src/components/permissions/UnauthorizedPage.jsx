import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../../features/auth/index.js';
import { getDefaultDashboardPath } from '../../utils/authRouting.js';

/** Optional `title` / `description` override default `common.unauthorized` copy. */
export function UnauthorizedPage({ title, description } = {}) {
  const { user } = useAuth();
  const { t } = useTranslation('common');
  const home = getDefaultDashboardPath(user);

  return (
    <div className="page page--unauthorized">
      <div className="unauthorized-card">
        <div className="unauthorized-card__icon" aria-hidden>
          <ShieldOff size={40} strokeWidth={1.75} />
        </div>
        <h1 className="unauthorized-card__title">{title ?? t('unauthorized.title')}</h1>
        <p className="unauthorized-card__desc">{description ?? t('unauthorized.description')}</p>
        <Link className="btn btn--primary" to={home}>
          {t('unauthorized.backToDashboard')}
        </Link>
      </div>
    </div>
  );
}
