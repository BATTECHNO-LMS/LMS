import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { HeroPhoneScene } from '../HeroPhoneScene.jsx';
import { HeroSystemStatus } from './HeroSystemStatus.jsx';
import { HERO_CALLOUT_KEYS } from './hero.constants.js';
import { useLandingMotion, MOTION_DURATION } from '../motion/index.js';

export function HeroProductStage() {
  const { t } = useTranslation('landing');
  const { transition, reduced } = useLandingMotion();

  return (
    <div className="hero-product-stage relative mx-auto w-full max-w-[min(100%,30rem)] lg:max-w-[min(100%,32rem)]">
      <motion.div
        initial={reduced ? false : { opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={transition(MOTION_DURATION.slow, 0.2)}
        className="hero-product-stage__phone relative z-10 flex justify-center"
      >
        <HeroPhoneScene />
      </motion.div>

      <div className="pointer-events-none absolute inset-0 z-20 hidden md:block" aria-hidden>
        {HERO_CALLOUT_KEYS.map(({ id, labelKey, position }, i) => (
          <motion.span
            key={id}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={transition(MOTION_DURATION.medium, 0.25 + i * 0.06)}
            className={`hero-callout ${position}`}
          >
            {t(labelKey)}
          </motion.span>
        ))}
      </div>

      <div className="relative mt-4 flex justify-center lg:mt-0 lg:block lg:min-h-[5.5rem]">
        <HeroSystemStatus />
      </div>
    </div>
  );
}
