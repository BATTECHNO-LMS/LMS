import { motion } from 'framer-motion';
import { HERO_SIDE_ILLUSTRATIONS } from './heroIllustrations.constants.js';
import { useLandingMotion, MOTION_DURATION } from '../motion/index.js';

export function HeroIllustrationColumn() {
  const { transition, reduced } = useLandingMotion();

  return (
    <aside className="hero-deco-col hero-deco-col--start hidden lg:grid" aria-hidden>
      {HERO_SIDE_ILLUSTRATIONS.map(({ id, src, position }, index) => (
        <motion.figure
          key={id}
          initial={reduced ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition(MOTION_DURATION.slow, 0.1 + index * 0.08)}
          className={`hero-deco-illus hero-deco-illus--${position}`}
        >
          <span className="hero-deco-illus__halo" />
          <img src={src} alt="" className="hero-deco-illus__img" loading="eager" decoding="async" />
        </motion.figure>
      ))}
    </aside>
  );
}
