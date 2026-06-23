import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * @param {number | null | undefined} target
 * @param {{ duration?: number, enabled?: boolean }} [options]
 */
export function useCountUp(target, { duration = 900, enabled = true } = {}) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled || target == null || Number.isNaN(target)) {
      setValue(0);
      return;
    }

    if (reduced) {
      setValue(target);
      return;
    }

    const goal = Math.max(0, Math.round(target));
    if (goal === 0) {
      setValue(0);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(goal * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, enabled, reduced]);

  return value;
}
