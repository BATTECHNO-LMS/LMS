import { motion } from 'framer-motion';
import { HeroPhoneScene } from '../HeroPhoneScene.jsx';
import { useLandingMotion, MOTION_DURATION } from '../motion/index.js';

/** Static product phone mockup for the hero end column. */
export function HeroPhonePanel() {
  const { transition, reduced } = useLandingMotion();

  return (
    <aside className="hero-phone-panel">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition(MOTION_DURATION.slow, 0.16)}
        className="hero-phone-panel__inner"
      >
        <HeroPhoneScene />
      </motion.div>
    </aside>
  );
}
