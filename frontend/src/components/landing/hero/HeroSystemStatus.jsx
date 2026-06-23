import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { HERO_STATUS_ROWS } from './hero.constants.js';
import { useLandingMotion, MOTION_DURATION } from '../motion/index.js';

export function HeroSystemStatus() {
  const { t } = useTranslation('landing');
  const { transition, reduced } = useLandingMotion();

  return (
    <motion.aside
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition(MOTION_DURATION.medium, 0.35)}
      className="hero-glass-panel w-full max-w-[17rem] rounded-xl p-3.5 sm:p-4 lg:absolute lg:bottom-2 lg:end-0 lg:z-20"
      aria-label={t('hero.cockpit.systemStatus.title')}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-bat-accent-hover">
        {t('hero.cockpit.systemStatus.eyebrow')}
      </p>
      <h3 className="mt-1 text-sm font-bold text-bat-ink">{t('hero.cockpit.systemStatus.title')}</h3>

      <ul className="mt-3 space-y-2.5">
        {HERO_STATUS_ROWS.map(({ id, labelKey, valueKey, bar = 80 }) => (
          <li key={id}>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-medium text-bat-muted">{t(labelKey)}</span>
              <span className="font-bold text-bat-primary">{t(valueKey)}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-bat-surface-header">
              <motion.span
                className="block h-full rounded-full bg-gradient-to-r from-bat-primary to-bat-accent"
                initial={reduced ? false : { width: 0 }}
                animate={{ width: `${bar}%` }}
                transition={transition(MOTION_DURATION.slow, 0.4)}
              />
            </div>
          </li>
        ))}
      </ul>
    </motion.aside>
  );
}
