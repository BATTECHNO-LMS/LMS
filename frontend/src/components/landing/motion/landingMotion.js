import { useReducedMotion } from 'framer-motion';

/** Shared landing motion tokens */
export const MOTION_EASE = [0.22, 1, 0.36, 1];

export const MOTION_DURATION = {
  fast: 0.45,
  medium: 0.55,
  slow: 0.8,
};

export const MOTION_Y = {
  sm: 16,
  md: 24,
  lg: 32,
};

export const MOTION_STAGGER = {
  tight: 0.08,
  normal: 0.1,
  relaxed: 0.14,
};

export const VIEWPORT_SECTION = { once: true, margin: '-80px' };
export const VIEWPORT_CARD = { once: true, margin: '-40px' };

/**
 * Landing motion helpers with prefers-reduced-motion support.
 */
export function useLandingMotion() {
  const reduced = useReducedMotion();

  const transition = (duration = MOTION_DURATION.medium, delay = 0) =>
    reduced
      ? { duration: 0.01, delay: 0 }
      : { duration, delay, ease: MOTION_EASE };

  const fadeUp = (y = MOTION_Y.md) => ({
    hidden: reduced ? { opacity: 0 } : { opacity: 0, y },
    show: { opacity: 1, y: 0 },
  });

  const fadeScale = (scale = 0.96) => ({
    hidden: reduced ? { opacity: 0 } : { opacity: 0, scale },
    show: { opacity: 1, scale: 1 },
  });

  const slideIn = (x = 32, dir = 'ltr') => {
    const offset = dir === 'rtl' ? -x : x;
    return {
      hidden: reduced ? { opacity: 0 } : { opacity: 0, x: offset, scale: 0.98 },
      show: { opacity: 1, x: 0, scale: 1 },
    };
  };

  const staggerContainer = (stagger = MOTION_STAGGER.normal, delayChildren = 0.06) => ({
    hidden: {},
    show: {
      transition: reduced
        ? { staggerChildren: 0, delayChildren: 0 }
        : { staggerChildren: stagger, delayChildren },
    },
  });

  const staggerItem = (y = MOTION_Y.sm) => fadeUp(y);

  const sectionHeader = fadeUp(MOTION_Y.md);

  const cardHover = reduced
    ? {}
    : {
        y: -6,
        transition: { duration: MOTION_DURATION.fast, ease: MOTION_EASE },
      };

  const cardIconHover = reduced
    ? {}
    : {
        scale: 1.08,
        rotate: -3,
        transition: { duration: 0.3, ease: MOTION_EASE },
      };

  const floatY = reduced
    ? {}
    : {
        y: [0, -8, 0],
        transition: { duration: 7, repeat: Infinity, ease: 'easeInOut' },
      };

  const glowPulse = reduced
    ? {}
    : {
        opacity: [0.65, 0.9, 0.65],
        scale: [1, 1.04, 1],
        transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
      };

  const blobDrift = (duration = 18) =>
    reduced
      ? {}
      : {
          x: [0, 12, -8, 0],
          y: [0, -10, 6, 0],
          transition: { duration, repeat: Infinity, ease: 'easeInOut' },
        };

  return {
    reduced,
    transition,
    fadeUp,
    fadeScale,
    slideIn,
    staggerContainer,
    staggerItem,
    sectionHeader,
    cardHover,
    cardIconHover,
    floatY,
    glowPulse,
    blobDrift,
  };
}
