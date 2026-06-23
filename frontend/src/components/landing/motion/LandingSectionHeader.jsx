import { motion } from 'framer-motion';
import {
  useLandingMotion,
  MOTION_DURATION,
  MOTION_STAGGER,
  VIEWPORT_SECTION,
} from './landingMotion.js';

/**
 * @param {{ eyebrow?: string, title: string, subtitle?: string, className?: string, wide?: boolean }} props
 */
export function LandingSectionHeader({ eyebrow, title, subtitle, className = '', wide = false }) {
  const { transition, staggerContainer, staggerItem } = useLandingMotion();

  return (
    <motion.div
      variants={staggerContainer(MOTION_STAGGER.normal, 0.04)}
      initial="hidden"
      whileInView="show"
      viewport={VIEWPORT_SECTION}
      className={`mx-auto text-center ${wide ? 'max-w-4xl' : 'max-w-3xl'} ${className}`}
    >
      {eyebrow ? (
        <motion.p
          variants={staggerItem(12)}
          transition={transition(MOTION_DURATION.fast)}
          className="text-xs font-semibold uppercase tracking-[0.2em] text-bat-muted sm:text-[0.8125rem]"
        >
          {eyebrow}
        </motion.p>
      ) : null}
      <motion.h2
        variants={staggerItem(20)}
        transition={transition(MOTION_DURATION.medium)}
        className="mt-2 text-[length:var(--landing-title-section)] font-bold leading-tight tracking-tight text-bat-ink"
      >
        {title}
      </motion.h2>
      {subtitle ? (
        <motion.p
          variants={staggerItem(16)}
          transition={transition(MOTION_DURATION.medium, 0.06)}
          className="mt-3 text-base leading-relaxed text-bat-muted sm:text-lg"
        >
          {subtitle}
        </motion.p>
      ) : null}
    </motion.div>
  );
}
