import { motion } from 'framer-motion';
import { illustrationsForSection } from './landingIllustrations.constants.js';
import { useLandingMotion, MOTION_DURATION } from '../motion/index.js';

/**
 * Section-level decorative illustration layer.
 * Sits behind main content (z-index 0); content uses z-index 1+.
 *
 * @param {{ section: import('./landingIllustrations.constants.js').LandingDecoSection, className?: string }} props
 */
export function SectionDecoration({ section, className = '' }) {
  const items = illustrationsForSection(section);
  const { transition, reduced } = useLandingMotion();

  if (!items.length) return null;

  return (
    <div
      className={`landing-section-deco pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      {items.map(({ id, src, align, size, opacity = 0.5 }, index) => (
        <motion.figure
          key={id}
          initial={reduced ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={transition(MOTION_DURATION.slow, index * 0.08)}
          className={`landing-deco-illus landing-deco-illus--${size} landing-deco-illus--${align}`}
          style={{ '--landing-deco-opacity': opacity }}
        >
          <span className="landing-deco-illus__frame" />
          <img src={src} alt="" className="landing-deco-illus__img" loading="lazy" decoding="async" />
        </motion.figure>
      ))}
    </div>
  );
}
