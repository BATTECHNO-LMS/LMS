import { useCallback, useEffect, useRef, useState } from 'react';
import {
  INTRO_AUTO_CLOSE_MS,
  INTRO_FADE_MS,
  LOGO_FRAGMENTS,
} from '../../features/internshipJourney/index.js';

export function AnimatedBrandIntro({ logoSrc }) {
  const [phase, setPhase] = useState('shown');
  const skipRef = useRef(null);

  const close = useCallback(() => {
    setPhase((current) => (current === 'shown' ? 'hiding' : current));
  }, []);

  useEffect(() => {
    skipRef.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(close, INTRO_AUTO_CLOSE_MS);
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close]);

  useEffect(() => {
    if (phase !== 'hiding') return undefined;
    const timer = window.setTimeout(() => setPhase('gone'), INTRO_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      className={`ij-intro${phase === 'hiding' ? ' ij-intro--hiding' : ''}`}
      role="dialog"
      aria-label="مقدمة شعار Batman Technology"
    >
      <div className="ij-intro-core">
        <span className="ij-intro-star ij-intro-star--top" aria-hidden="true">
          ✦
        </span>
        <span className="ij-intro-star ij-intro-star--bottom" aria-hidden="true">
          ✧
        </span>
        <div className="ij-intro-logo" role="img" aria-label="شعار BATMAN TECHNOLOGY">
          {LOGO_FRAGMENTS.map((fragment) => (
            <img
              key={fragment.clip}
              className="ij-intro-piece"
              src={logoSrc}
              alt=""
              aria-hidden="true"
              decoding="async"
              style={{
                clipPath: fragment.clip,
                '--tx': fragment.tx,
                '--ty': fragment.ty,
                '--rot': fragment.rot,
                '--delay': fragment.delay,
              }}
            />
          ))}
        </div>
        <div className="ij-intro-title">أهلاً بك في رحلتك المهنية 🚀</div>
        <div className="ij-intro-sub">من طالب جامعة... إلى مطوّر أو محلل جاهز لأول تحدٍ حقيقي</div>
        <div className="ij-intro-load" aria-hidden="true" />
        <button ref={skipRef} type="button" className="ij-skip" onClick={close}>
          تجاوز المقدمة ←
        </button>
      </div>
    </div>
  );
}
