/**
 * Layered static hero background — no looping motion.
 */
export function HeroBackground() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-bat-bg" aria-hidden />
      <div className="landing-hero-grid landing-grid-pattern" aria-hidden />
      <div className="landing-academic-pattern pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />
      <div className="landing-hero-shapes" aria-hidden>
        <div
          className="landing-hero-shape h-48 w-48 bg-bat-accent/12"
          style={{ top: '8%', insetInlineStart: '-5%' }}
        />
        <div
          className="landing-hero-shape h-56 w-56 bg-bat-primary/8"
          style={{ bottom: '10%', insetInlineEnd: '5%' }}
        />
        <div
          className="landing-hero-shape h-36 w-36 bg-bat-accent-hover/10"
          style={{ top: '42%', insetInlineStart: '35%' }}
        />
      </div>
    </>
  );
}
