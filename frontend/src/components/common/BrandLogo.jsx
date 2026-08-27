import battechnoLogo from '../../assets/images/battechno-lms-logo-transparent.png';

/** @typedef {'header' | 'hero' | 'portal' | 'cockpit' | 'phone' | 'footer' | 'auth' | 'app-header' | 'sidebar'} BrandLogoVariant */

const EXTRA_CLASS = {
  auth: 'auth-card__logo',
  'app-header': 'app-header__logo-image',
  sidebar: 'app-sidebar__logo-image',
};

const PRIORITY_VARIANTS = new Set(['header', 'hero', 'portal', 'auth']);

/**
 * Transparent LMS brand mark — no background box, aspect ratio preserved.
 * Sizing lives in `_brand-logo.scss` so it works outside `#battechno-landing`.
 * @param {{
 *   variant?: BrandLogoVariant,
 *   alt: string,
 *   align?: 'start' | 'center',
 *   className?: string,
 *   imgClassName?: string,
 * }} props
 */
export function BrandLogo({
  variant = 'header',
  alt,
  align = 'start',
  className = '',
  imgClassName = '',
}) {
  const extra = EXTRA_CLASS[variant] || '';
  const alignClass = align === 'center' ? 'brand-logo--center' : '';
  const eager = PRIORITY_VARIANTS.has(variant);

  return (
    <img
      src={battechnoLogo}
      alt={alt}
      width={1024}
      height={682}
      className={`brand-logo brand-logo--${variant} ${alignClass} ${extra} ${className} ${imgClassName}`.trim()}
      decoding="async"
      fetchPriority={eager ? 'high' : 'auto'}
      loading={eager ? 'eager' : 'lazy'}
    />
  );
}
