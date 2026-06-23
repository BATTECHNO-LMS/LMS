import { motion } from 'framer-motion';
import { useLandingMotion, MOTION_DURATION, VIEWPORT_CARD } from './landingMotion.js';

/**
 * @param {{
 *   icon: import('react').ComponentType<{ className?: string, 'aria-hidden'?: boolean }>,
 *   title: string,
 *   description: string,
 *   variants?: object,
 *   layout?: 'vertical' | 'horizontal',
 * }} props
 */
export function LandingFeatureCard({ icon: Icon, title, description, variants, layout = 'vertical' }) {
  const { cardHover, cardIconHover, transition } = useLandingMotion();
  const isHorizontal = layout === 'horizontal';

  return (
    <motion.article
      variants={variants}
      whileHover={cardHover}
      transition={transition(MOTION_DURATION.fast)}
      className={`group flex h-full rounded-2xl landing-premium-card shadow-[0_2px_24px_-12px_rgba(19,45,74,0.08)] transition-[box-shadow,border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-bat-accent/45 hover:shadow-[0_16px_44px_-18px_rgba(19,45,74,0.14)] focus-within:border-bat-accent/45 focus-within:shadow-[0_16px_44px_-18px_rgba(19,45,74,0.14)] ${
        isHorizontal ? 'gap-4 p-5 sm:gap-5 sm:p-6' : 'min-h-[10.5rem] flex-col p-5 sm:p-6'
      }`}
    >
      <motion.div
        whileHover={cardIconHover}
        className="landing-card-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-bat-border/90 text-bat-primary transition-colors group-hover:border-bat-accent/60"
      >
        <Icon className="text-xl" aria-hidden />
      </motion.div>
      <div className={isHorizontal ? 'min-w-0' : 'mt-4'}>
        <h3 className={`font-bold leading-snug text-bat-ink ${isHorizontal ? 'text-base sm:text-lg' : 'text-lg'}`}>
          {title}
        </h3>
        <p className={`leading-relaxed text-bat-muted ${isHorizontal ? 'mt-1.5 text-sm' : 'mt-2 text-sm sm:text-[0.9375rem]'}`}>
          {description}
        </p>
      </div>
    </motion.article>
  );
}

export { VIEWPORT_CARD };
