import battechnoLogo from '../../assets/images/battechno-lms-logo-transparent.png';

/** @typedef {'header' | 'hero' | 'cockpit' | 'phone' | 'footer' | 'auth' | 'app-header' | 'sidebar'} BrandLogoVariant */

const VARIANTS = {
  header:
    'h-11 w-auto max-w-[min(300px,60vw)] shrink-0 object-contain object-start sm:h-12 lg:h-[3.375rem] lg:max-w-[320px]',
  hero: 'h-[4.5rem] w-auto max-w-[min(440px,94vw)] object-contain sm:h-20 lg:h-24',
  cockpit: 'h-14 w-auto max-w-[min(380px,72vw)] object-contain sm:h-16 lg:h-[4.5rem]',
  phone: 'h-7 w-auto max-w-full shrink-0 object-contain object-start sm:h-8',
  footer: 'mb-3 h-10 w-auto max-w-[260px] object-contain object-start sm:h-11',
  auth: 'auth-card__logo',
  'app-header': 'app-header__logo-image',
  sidebar: 'app-sidebar__logo-image',
};

/**
 * Transparent LMS brand mark — no background box, aspect ratio preserved.
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
  const alignClass = align === 'center' ? 'mx-auto object-center' : 'object-start';

  return (
    <img
      src={battechnoLogo}
      alt={alt}
      className={`${VARIANTS[variant]} ${alignClass} ${className} ${imgClassName}`.trim()}
      decoding="async"
    />
  );
}
