import { useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../features/auth/index.js';
import { LoadingSpinner } from '../common/LoadingSpinner.jsx';
import { IllustratedStatusLayout } from '../designSystem/index.js';
import {
  getActiveRoleCode,
  getDefaultDashboardPath,
  getRoleLabelAr,
  isSafeBackPath,
} from '../../utils/authRouting.js';

/** Optional `title` / `description` override default `common.unauthorized` copy. */
export function UnauthorizedPage({ title, description, showContactAdmin = true } = {}) {
  const { user, isAuthReady } = useAuth();
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const roleCode = getActiveRoleCode(user);
  const dashboard = getDefaultDashboardPath(user);
  const roleLabel = getRoleLabelAr(roleCode);

  const details = useMemo(() => {
    if (!user || !roleCode) return [];
    return [
      {
        label: t('unauthorized.currentRoleLabel'),
        value: roleLabel,
      },
    ];
  }, [user, roleCode, roleLabel, t]);

  const handleGoBack = useCallback(() => {
    const idx = typeof window !== 'undefined' ? window.history.state?.idx : undefined;
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1);
      return;
    }
    let referrerPath = '';
    try {
      if (typeof document !== 'undefined' && document.referrer) {
        const url = new URL(document.referrer);
        if (url.origin === window.location.origin) {
          referrerPath = `${url.pathname}${url.search || ''}`;
        }
      }
    } catch {
      referrerPath = '';
    }
    if (isSafeBackPath(referrerPath.split('?')[0])) {
      navigate(referrerPath);
      return;
    }
    navigate(dashboard || '/login', { replace: true });
  }, [dashboard, navigate]);

  if (!isAuthReady) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
      <div className="page page--unauthorized">
        <IllustratedStatusLayout
          logo={false}
          statusType="error"
          badgeLabel={t('unauthorized.badge')}
          title={title ?? t('unauthorized.title')}
          description={t('unauthorized.sessionRequired')}
          primaryAction={
            <Link className="btn btn--primary" to="/login">
              {t('unauthorized.goToLogin')}
            </Link>
          }
        />
      </div>
    );
  }

  if (!roleCode) {
    return (
      <div className="page page--unauthorized">
        <IllustratedStatusLayout
          logo={false}
          statusType="error"
          badgeLabel={t('unauthorized.badge')}
          title={t('unauthorized.unknownRoleTitle')}
          description={t('unauthorized.unknownRoleDescription')}
          primaryAction={
            <Link className="btn btn--primary" to="/login">
              {t('unauthorized.goToLogin')}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page page--unauthorized">
      <IllustratedStatusLayout
        logo={false}
        statusType="error"
        badgeLabel={t('unauthorized.badge')}
        title={title ?? t('unauthorized.title')}
        description={description ?? t('unauthorized.description')}
        details={details}
        secondaryAction={
          <button type="button" className="btn btn--outline" onClick={handleGoBack}>
            {t('unauthorized.goBack')}
          </button>
        }
        primaryAction={
          <Link className="btn btn--primary" to={dashboard}>
            {t('unauthorized.backToDashboard')}
          </Link>
        }
      >
        {showContactAdmin ? (
          <p className="unauthorized-page__hint">
            {t('unauthorized.contactHint')}{' '}
            <a className="unauthorized-page__contact" href="mailto:support@battechno.com">
              {t('unauthorized.contactAdmin')}
            </a>
          </p>
        ) : null}
      </IllustratedStatusLayout>
    </div>
  );
}
