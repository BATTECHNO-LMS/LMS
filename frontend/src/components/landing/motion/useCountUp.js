import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * Lightweight count-up for stat displays (no external library).
 * @param {string | number} value
 * @param {{ duration?: number, enabled?: boolean }} [options]
 */
export function useCountUp(value, options = {}) {
  const { duration = 900, enabled = true } = options;
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(() => String(value));
  const frameRef = useRef(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const raw = String(value);
    const match = raw.match(/^(\d+(?:\.\d+)?)(.*)$/);
    if (!match || !enabled || reduced) {
      setDisplay(raw);
      return undefined;
    }

    const target = parseFloat(match[1]);
    const suffix = match[2] ?? '';
    if (Number.isNaN(target)) {
      setDisplay(raw);
      return undefined;
    }

    if (startedRef.current) {
      setDisplay(raw);
      return undefined;
    }
    startedRef.current = true;

    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const current = Math.round(target * eased);
      setDisplay(`${current}${suffix}`);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration, enabled, reduced]);

  return display;
}

/**
 * @param {import('react').RefObject<HTMLElement | null>} ref
 */
export function useInViewOnce(ref) {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: '0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, inView]);

  return inView;
}
