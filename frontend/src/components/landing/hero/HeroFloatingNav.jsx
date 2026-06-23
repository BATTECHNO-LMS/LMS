import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX } from 'react-icons/fi';
import { useLocale } from '../../../features/locale/index.js';
import { BrandLogo } from '../../common/BrandLogo.jsx';

const NAV_LINKS = [
  { href: '#portals', key: 'header.navPortals' },
  { href: '#journey', key: 'header.navJourney' },
  { href: '#capabilities', key: 'header.navCapabilities' },
  { href: '#partners', key: 'header.navPartners' },
];

/**
 * Floating pill navbar — reference-inspired, BATTECHNO LMS theme.
 */
export function HeroFloatingNav() {
  const { t } = useTranslation('landing');
  const { isArabic, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const nextLocale = isArabic ? 'en' : 'ar';
  const close = () => setOpen(false);

  const linkClass =
    'whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-semibold text-bat-text transition hover:bg-bat-accent-soft/50 hover:text-bat-primary sm:px-2.5 sm:text-[0.8125rem]';

  return (
    <header className="hero-floating-nav sticky top-0 z-50 w-full px-[var(--landing-container-pad)] pt-4 pb-2 sm:pt-5 sm:pb-2.5">
      <div className="mx-auto w-full max-w-5xl">
        <div className="hero-floating-nav__bar hero-floating-nav__bar--desktop hidden items-center gap-3 px-3 py-2 sm:gap-4 sm:px-4 sm:py-2.5 lg:flex">
        <span className="hero-floating-nav__wave" aria-hidden />
        <span className="hero-floating-nav__glow" aria-hidden />
        <span className="hero-floating-nav__wave-edge" aria-hidden />
        <div className="hero-floating-nav__inner flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <Link to="/" className="relative z-[1] shrink-0 ps-1" onClick={close}>
            <BrandLogo variant="header" alt={t('brand')} className="!h-9 !max-h-9 sm:!h-10" />
          </Link>

          <nav className="relative z-[1] flex min-w-0 flex-1 flex-wrap items-center justify-center gap-0.5" aria-label="Primary">
            {NAV_LINKS.map(({ href, key }) => (
              <a key={key} href={href} className={linkClass} onClick={close}>
                {t(key)}
              </a>
            ))}
          </nav>

          <div className="relative z-[1] flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link
              to="/login"
              className="hidden rounded-full bg-bat-primary px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-bat-primary-hover sm:inline-flex"
            >
              {t('header.login')}
            </Link>
            <Link
              to="/register"
              className="hidden rounded-full border border-bat-accent bg-bat-accent-soft px-3 py-2 text-xs font-semibold text-bat-primary transition hover:bg-bat-accent sm:inline-flex"
            >
              {t('header.register')}
            </Link>
            <button
              type="button"
              className="rounded-full border border-bat-border/80 bg-bat-surface px-2.5 py-1.5 text-[10px] font-bold text-bat-ink sm:text-xs"
              onClick={() => setLocale(nextLocale)}
            >
              {isArabic ? 'EN' : 'عربي'}
            </button>
          </div>
        </div>
      </div>

      <div className="hero-floating-nav__bar hero-floating-nav__bar--mobile flex items-center justify-between gap-2 px-3 py-2 lg:hidden">
        <span className="hero-floating-nav__wave" aria-hidden />
        <span className="hero-floating-nav__glow" aria-hidden />
        <span className="hero-floating-nav__wave-edge" aria-hidden />
        <div className="hero-floating-nav__inner flex w-full items-center justify-between gap-2">
          <button
            type="button"
            className="relative z-[1] rounded-lg p-2 text-bat-ink"
            aria-expanded={open}
            aria-label={open ? t('header.menuClose') : t('header.menuOpen')}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
          <Link to="/" className="relative z-[1] flex flex-1 justify-center" onClick={close}>
            <BrandLogo variant="header" alt={t('brand')} className="!h-9" />
          </Link>
          <Link to="/login" className="relative z-[1] rounded-full bg-bat-primary px-3 py-1.5 text-[11px] font-semibold text-white">
            {t('header.login')}
          </Link>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="hero-floating-nav__bar hero-floating-nav__bar--menu mt-2 overflow-hidden p-2 lg:hidden"
            aria-label="Mobile"
          >
            <span className="hero-floating-nav__wave" aria-hidden />
            <span className="hero-floating-nav__glow" aria-hidden />
            <span className="hero-floating-nav__wave-edge" aria-hidden />
            <div className="hero-floating-nav__inner relative z-[1] flex flex-col gap-0.5">
              {NAV_LINKS.map(({ href, key }) => (
                <a key={key} href={href} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-bat-text hover:bg-bat-accent-soft/40" onClick={close}>
                  {t(key)}
                </a>
              ))}
              <Link to="/register" className="mt-1 rounded-xl border border-bat-accent bg-bat-accent-soft px-3 py-2.5 text-center text-sm font-semibold text-bat-primary" onClick={close}>
                {t('header.register')}
              </Link>
              <button type="button" className="rounded-lg py-2 text-xs font-bold text-bat-muted" onClick={() => setLocale(nextLocale)}>
                {isArabic ? 'English' : 'العربية'}
              </button>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
      </div>
    </header>
  );
}
