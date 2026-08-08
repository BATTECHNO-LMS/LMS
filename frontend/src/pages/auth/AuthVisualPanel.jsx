import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, BarChart3, Award } from 'lucide-react';
import { AUTH_MOTION_EASE } from './authMotion.js';

const FEATURE_ICONS = [BookOpen, BarChart3, Award];

/**
 * Shared illustration panel for auth split layouts.
 */
export function AuthVisualPanel({
  illustration,
  titleKey,
  subtitleKey,
  title,
  subtitle,
  benefits,
  featureIndicators,
  illustrationAlt = '',
}) {
  const { t } = useTranslation('auth');
  const reduced = useReducedMotion();

  const motionProps = reduced
    ? {}
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.65, delay: 0.12, ease: AUTH_MOTION_EASE },
      };

  const heading = title || (titleKey ? t(titleKey) : '');
  const body = subtitle || (subtitleKey ? t(subtitleKey) : '');
  const hasMeaningfulAlt = Boolean(illustrationAlt);

  return (
    <motion.aside
      className="auth-split__visual"
      {...motionProps}
      aria-hidden={hasMeaningfulAlt ? undefined : true}
    >
      <div className="auth-visual-panel">
        <span className="auth-visual-panel__glow" aria-hidden />
        <figure className="auth-visual-panel__figure">
          <img
            src={illustration}
            alt={illustrationAlt || ''}
            className="auth-visual-panel__img"
            loading="lazy"
            decoding="async"
          />
        </figure>
        <div className="auth-visual-panel__copy">
          {heading ? <h2 className="auth-visual-panel__title">{heading}</h2> : null}
          {body ? <p className="auth-visual-panel__subtitle">{body}</p> : null}
          {Array.isArray(featureIndicators) && featureIndicators.length ? (
            <ul className="auth-visual-panel__features" aria-label="مميزات البوابة">
              {featureIndicators.map((label, index) => {
                const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
                return (
                  <li key={label} className="auth-visual-panel__feature">
                    <span className="auth-visual-panel__feature-icon" aria-hidden>
                      <Icon size={14} strokeWidth={2} />
                    </span>
                    <span>{label}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {Array.isArray(benefits) && benefits.length ? (
            <ul className="auth-visual-panel__benefits">
              {benefits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <span className="auth-visual-panel__dots" aria-hidden />
      </div>
    </motion.aside>
  );
}
