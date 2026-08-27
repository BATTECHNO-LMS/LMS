import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';
import { getDefaultDashboardPath } from '../../../utils/authRouting.js';
import { RegisterForm } from '../components/RegisterForm.jsx';
import { BrandLogo } from '../../../components/common/BrandLogo.jsx';
import { AuthBackgroundDecor } from '../../../pages/auth/AuthBackgroundDecor.jsx';
import { AuthVisualPanel } from '../../../pages/auth/AuthVisualPanel.jsx';
import { AUTH_MOTION_EASE } from '../../../pages/auth/authMotion.js';
import registerIllustration from '../../../assets/landing/illustrations/journey-flow.svg';

export function RegisterPage() {
  const { t } = useTranslation('auth');
  const { t: tCommon } = useTranslation('common');
  const { isAuthenticated, user } = useAuth();
  const reduced = useReducedMotion();

  if (isAuthenticated && user) {
    return <Navigate to={getDefaultDashboardPath(user)} replace />;
  }

  const formMotion = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.55, ease: AUTH_MOTION_EASE },
      };

  return (
    <div className="auth-page auth-page--split auth-page--register">
      <AuthBackgroundDecor />

      <div className="auth-split-wrap">
        <span className="auth-split__halo" aria-hidden />
        <div className="auth-split auth-split--register">
          <motion.section className="auth-split__form" {...formMotion}>
            <div className="auth-split__form-inner">
              <BrandLogo variant="auth" alt={tCommon('logo.alt')} className="auth-split__logo" />

              <header className="auth-split__header auth-split__header--register">
                <h1 className="auth-split__title">{t('register.title')}</h1>
                <p className="auth-split__subtitle">{t('register.description')}</p>
              </header>

              <RegisterForm />
            </div>
          </motion.section>

          <AuthVisualPanel
            illustration={registerIllustration}
            titleKey="register.panelTitle"
            subtitleKey="register.panelSubtitle"
          />
        </div>
      </div>
    </div>
  );
}
