import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX } from 'react-icons/fi';
import { useLocale } from '../../../features/locale/index.js';
import { BrandLogo } from '../../common/BrandLogo.jsx';

const NAV_START = [
  { href: '#main', key: 'header.navHome' },
  { href: '#portals', key: 'header.navPortals' },
  { href: '#journey', key: 'header.navJourney' },
];

const NAV_END = [
  { href: '#capabilities', key: 'header.navCapabilities' },
  { href: '#partners', key: 'header.navPartners' },
];

/**
 * Premium in-frame navigation — centered logo, links on both sides.
 */
export function HeroCockpitNav() {
  const { t } = useTranslation('landing');
  const { isArabic, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const nextLocale = isArabic ? 'en' : 'ar';
  const close = () => setOpen(false);

  const linkClass =
    'rounded-lg px-2.5 py-1.5 text-xs font-semibold text-bat-text transition hover:bg-bat-accent-soft/60 hover:text-bat-primary sm:px-3 sm:text-[0.8125rem]';

  const navLink = (href, key) => (
    <a key={key} href={href} className={linkClass} onClick={close}>
      {t(key)}
    </a>
  );

  return (
    <header className="relative z-20 border-b border-bat-border/50 pb-4">
      <div className="hidden items-center gap-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-4">
        <nav className="flex flex-wrap items-center justify-start gap-0.5" aria-label="Primary start">
          {NAV_START.map(({ href, key }) => navLink(href, key))}
        </nav>

        <Link to="/" className="flex justify-center px-2" onClick={close}>
          <BrandLogo variant="cockpit" alt={t('brand')} align="center" />
        </Link>

        <div className="flex items-center justify-end gap-2">
          <nav className="flex flex-wrap items-center justify-end gap-0.5" aria-label="Primary end">
            {NAV_END.map(({ href, key }) => navLink(href, key))}
          </nav>
          <span className="mx-1 h-5 w-px bg-bat-border/80" aria-hidden />
          <Link
            to="/portals"
            className="hidden rounded-lg border border-bat-accent/70 bg-bat-accent-soft/80 px-3 py-1.5 text-xs font-semibold text-bat-primary transition hover:bg-bat-accent-soft sm:inline-flex"
          >
            {t('header.login')}
          </Link>
          <Link
            to="/portals"
            className="hidden rounded-lg bg-bat-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-md transition hover:bg-bat-primary-hover sm:inline-flex"
          >
            {t('header.register')}
          </Link>
          <button
            type="button"
            className="rounded-lg border border-bat-border/80 bg-white/60 px-2.5 py-1.5 text-xs font-bold text-bat-ink transition hover:bg-bat-surface"
            onClick={() => setLocale(nextLocale)}
          >
            {isArabic ? 'EN' : 'عربي'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          className="rounded-lg border border-bat-border/80 bg-white/70 p-2 text-bat-ink"
          aria-expanded={open}
          aria-label={open ? t('header.menuClose') : t('header.menuOpen')}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <FiX size={20} /> : <FiMenu size={20} />}
        </button>
        <Link to="/" className="flex flex-1 justify-center" onClick={close}>
          <BrandLogo variant="cockpit" alt={t('brand')} align="center" className="!max-h-14" />
        </Link>
        <button
          type="button"
          className="rounded-lg border border-bat-border/80 bg-white/60 px-2 py-1.5 text-[10px] font-bold"
          onClick={() => setLocale(nextLocale)}
        >
          {isArabic ? 'EN' : 'ع'}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden lg:hidden"
          >
            <nav className="mt-3 flex flex-col gap-1 rounded-xl border border-bat-border/60 bg-white/50 p-2 backdrop-blur-sm">
              {[...NAV_START, ...NAV_END].map(({ href, key }) => navLink(href, key))}
              <Link to="/universities/login" className="mt-1 rounded-lg bg-bat-primary px-3 py-2.5 text-center text-sm font-semibold text-white" onClick={close}>
                بوابة الجامعات
              </Link>
              <Link to="/institutions/login" className="rounded-lg border border-bat-accent bg-bat-accent-soft px-3 py-2.5 text-center text-sm font-semibold text-bat-primary" onClick={close}>
                بوابة المؤسسات
              </Link>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
