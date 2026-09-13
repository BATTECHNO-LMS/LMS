import logoSrc from '../../assets/images/eprojecto-logo.png';
import { APP_NAME } from '../../config/brand.js';

/** @typedef {'header' | 'hero' | 'portal' | 'cockpit' | 'phone' | 'footer' | 'auth' | 'app-header' | 'sidebar'} BrandLogoVariant */

const EXTRA_CLASS = {
  auth: 'auth-card__logo',
  'app-header': 'app-header__logo-image',
  sidebar: 'app-sidebar__logo-image',
};

/**
 * Official eprojecto lockup. Use this asset everywhere in the product shell.
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

  return (
    <img
      src={logoSrc}
      alt={alt || APP_NAME}
      className={`brand-logo brand-logo--${variant} ${alignClass} ${extra} ${className} ${imgClassName}`.trim()}
      decoding="async"
    />
  );
}
