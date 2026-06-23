/**
 * Soft animated bridge between landing sections — gradient fade + data-flow line.
 *
 * @param {{
 *   variant?: 'default' | 'from-hero' | 'to-warm' | 'to-surface',
 * }} props
 */
export function SectionTransition({ variant = 'default' }) {
  return (
    <div
      className={`landing-section-transition landing-section-transition--${variant}`}
      aria-hidden="true"
    >
      <span className="landing-section-transition__fade" />
      <span className="landing-section-transition__wave" />
      <span className="landing-section-transition__glow" />
      <span className="landing-section-transition__line" />
      <span className="landing-section-transition__dots" />
    </div>
  );
}
