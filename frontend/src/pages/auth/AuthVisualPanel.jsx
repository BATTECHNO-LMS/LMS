import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { AUTH_MOTION_EASE } from './authMotion.js';

/**
 * Shared illustration panel for auth split layouts.
 * @param {{ illustration: string, titleKey: string, subtitleKey: string, compact?: boolean }} props
 */
export function AuthVisualPanel({ illustration, titleKey, subtitleKey, compact = false }) {
  const { t } = useTranslation('auth');
  const reduced = useReducedMotion();

  const motionProps = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.65, delay: 0.12, ease: AUTH_MOTION_EASE },
      };

  return (
    <motion.aside
      className={`auth-split__visual${compact ? ' auth-split__visual--compact' : ''}`}
      {...motionProps}
      aria-hidden
    >
      <div className="auth-visual-panel">
        <span className="auth-visual-panel__glow" aria-hidden />
        <figure className="auth-visual-panel__figure">
          <img
            src={illustration}
            alt=""
            className="auth-visual-panel__img"
            loading="lazy"
            decoding="async"
          />
        </figure>
        <div className="auth-visual-panel__copy">
          <h2 className="auth-visual-panel__title">{t(titleKey)}</h2>
          <p className="auth-visual-panel__subtitle">{t(subtitleKey)}</p>
        </div>
        <span className="auth-visual-panel__dots" aria-hidden />
      </div>
    </motion.aside>
  );
}
