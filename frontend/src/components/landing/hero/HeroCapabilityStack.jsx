import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FiLayers, FiClipboard, FiShield, FiGrid } from 'react-icons/fi';
import { HERO_CAPABILITY_KEYS } from './hero.constants.js';
import { useLandingMotion, MOTION_STAGGER, VIEWPORT_CARD } from '../motion/index.js';

const ICONS = {
  layers: FiLayers,
  clipboard: FiClipboard,
  shield: FiShield,
  grid: FiGrid,
};

export function HeroCapabilityStack() {
  const { t } = useTranslation('landing');
  const { staggerContainer, staggerItem, transition } = useLandingMotion();

  return (
    <motion.div
      variants={staggerContainer(MOTION_STAGGER.tight, 0.08)}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT_CARD}
      className="flex flex-col gap-2.5 sm:gap-3"
    >
      {HERO_CAPABILITY_KEYS.map(({ id, titleKey, descKey, icon }) => {
        const Icon = ICONS[icon] ?? FiLayers;
        return (
          <motion.article
            key={id}
            variants={staggerItem(14)}
            transition={transition(0.45)}
            className="hero-glass-panel group flex gap-3 rounded-xl p-3 sm:p-3.5"
          >
            <span className="hero-glass-panel__icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-bat-accent/40 bg-bat-accent-soft/50 text-bat-primary">
              <Icon size={18} aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-bold leading-snug text-bat-ink">{t(titleKey)}</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-bat-muted sm:text-[0.8125rem]">{t(descKey)}</p>
            </div>
          </motion.article>
        );
      })}
    </motion.div>
  );
}
