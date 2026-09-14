import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logoSrc from '../../assets/images/eprojecto-logo.png';
import { APP_NAME } from '../../config/brand.js';
import { cn } from '../../utils/helpers.js';

export const BRAND_HOME_PATH = '/';
export const BRAND_LOGO_WIDTH = 894;
export const BRAND_LOGO_HEIGHT = 530;

/** @typedef {'header' | 'hero' | 'portal' | 'cockpit' | 'phone' | 'footer' | 'auth' | 'app-header' | 'sidebar'} BrandLogoVariant */

const IMG_EXTRA_CLASS = {
  'app-header': 'app-header__logo-image',
  sidebar: 'app-sidebar__logo-image',
};

/**
 * Official eprojecto lockup. Always navigates to `/` via React Router.
 * @param {{
 *   variant?: BrandLogoVariant,
 *   alt?: string,
 *   align?: 'start' | 'center',
 *   className?: string,
 *   imgClassName?: string,
 *   onNavigate?: () => void,
 * }} props
 */
export function BrandLogo({
  variant = 'header',
  alt,
  align = 'start',
  className = '',
  imgClassName = '',
  onNavigate,
}) {
  const { t } = useTranslation('common');
  const homeLabel = t('logo.homeAria');
  const imageAlt = alt || APP_NAME;

  return (
    <Link
      to={BRAND_HOME_PATH}
      className={cn(
        'brand-logo-link',
        `brand-logo-link--${variant}`,
        align === 'center' && 'brand-logo-link--center',
        className
      )}
      aria-label={homeLabel}
      onClick={onNavigate}
    >
      <img
        src={logoSrc}
        alt={imageAlt}
        width={BRAND_LOGO_WIDTH}
        height={BRAND_LOGO_HEIGHT}
        className={cn('brand-logo', `brand-logo--${variant}`, IMG_EXTRA_CLASS[variant], imgClassName)}
        decoding="async"
      />
    </Link>
  );
}
