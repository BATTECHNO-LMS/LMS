import { useEffect, useState } from 'react';

/**
 * @param {T} value
 * @param {number} [delayMs=350]
 * @returns {T}
 * @template T
 */
export function useDebouncedValue(value, delayMs = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
