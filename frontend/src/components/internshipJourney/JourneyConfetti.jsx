import { useEffect, useState } from 'react';
import {
  CONFETTI_COLORS,
  CONFETTI_LIFETIME_MS,
  CONFETTI_PIECES,
} from '../../features/internshipJourney/index.js';

function createPieces() {
  return Array.from({ length: CONFETTI_PIECES }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    animationDelay: `${Math.random() * 0.7}s`,
    '--drift': `${Math.random() * 300 - 150}px`,
  }));
}

/** Plays one confetti burst each time `burstKey` changes to a new truthy value. */
export function JourneyConfetti({ burstKey }) {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!burstKey) return undefined;
    setPieces(createPieces());
    const timer = window.setTimeout(() => setPieces([]), CONFETTI_LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [burstKey]);

  return (
    <div className="ij-confetti" aria-hidden="true">
      {pieces.map((style, i) => (
        <i key={`${burstKey}-${i}`} style={style} />
      ))}
    </div>
  );
}
