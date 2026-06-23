import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowRight } from 'react-icons/fi';
import { useLandingMotion } from './landingMotion.js';

const MotionLink = motion.create(Link);

/**
 * @param {{
 *   to: string,
 *   variant?: 'primary' | 'secondary',
 *   children: import('react').ReactNode,
 *   className?: string,
 *   showArrow?: boolean,
 *   rtl?: boolean,
 * }} props
 */
export function LandingCtaButton({
  to,
  variant = 'primary',
  children,
  className = '',
  showArrow = false,
  rtl = false,
}) {
  const { reduced, transition } = useLandingMotion();

  const shared =
    'group relative isolate inline-flex min-h-[3rem] w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-8 text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bat-accent sm:w-auto';

  const primaryClass = `${shared} bg-bat-primary text-white shadow-[0_8px_28px_-8px_rgba(19,45,74,0.35)]`;

  const secondaryClass = `${shared} border border-bat-accent bg-bat-accent-soft text-bat-primary shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-bat-accent-hover`;

  const hover =
    variant === 'primary'
      ? reduced
        ? {}
        : {
            y: -3,
            boxShadow: '0 14px 36px -10px rgba(19, 45, 74, 0.42)',
            transition: transition(0.35),
          }
      : reduced
        ? {}
        : {
            y: -2,
            boxShadow: '0 8px 24px -10px rgba(19, 45, 74, 0.14)',
            transition: transition(0.35),
          };

  return (
    <MotionLink
      to={to}
      className={`${variant === 'primary' ? primaryClass : secondaryClass} ${className}`}
      whileHover={hover}
      whileTap={reduced ? {} : { scale: 0.98 }}
    >
      {variant === 'primary' && !reduced ? (
        <span
          className="pointer-events-none absolute inset-0 z-[1] -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:translate-x-full group-hover:opacity-100 motion-safe:duration-700"
          aria-hidden
        />
      ) : null}
      {variant === 'secondary' && !reduced ? (
        <span
          className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] bg-bat-accent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden
        />
      ) : null}
      <span className="relative z-[2] flex items-center justify-center gap-2">
        {children}
        {showArrow ? (
          <motion.span
            className="inline-flex"
            initial={false}
            whileHover={reduced ? {} : { x: rtl ? -4 : 4 }}
            transition={transition(0.3)}
          >
            <FiArrowRight className={rtl ? 'rotate-180' : ''} aria-hidden />
          </motion.span>
        ) : null}
      </span>
    </MotionLink>
  );
}
