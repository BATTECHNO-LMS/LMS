/**
 * Wraps landing section content with z-index above decorative ::before layers.
 *
 * @param {{
 *   variant: 'hero' | 'portals' | 'journey' | 'partners' | 'features' | 'trust' | 'cta',
 *   id?: string,
 *   className?: string,
 *   compact?: boolean,
 *   children: import('react').ReactNode,
 * }} props
 */
export function LandingSection({ variant, id, className = '', compact = false, children }) {
  return (
    <section
      id={id}
      className={`landing-section landing-section--${variant} landing-section-shell${compact ? ' landing-section-shell--compact' : ''} ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * Inner content container — sits above section pseudo-element decor.
 */
export function LandingSectionContent({ children, className = '' }) {
  return <div className={`landing-section__content landing-container ${className}`}>{children}</div>;
}
