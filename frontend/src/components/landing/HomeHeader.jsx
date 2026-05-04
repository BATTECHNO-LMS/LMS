import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX } from 'react-icons/fi';
import { useLocale } from '../../features/locale/index.js';
import battechnoLogo from '../../assets/images/batman-logo.png';

/**
 * @param {{ variant?: 'default' | 'minimal' }} props
 */
export function HomeHeader({ variant = 'default' }) {
  const { t } = useTranslation('landing');
  const { isArabic, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const nextLocale = isArabic ? 'en' : 'ar';

  const close = () => setOpen(false);

  const centerLinks = (
    <>
      <a
        href="#capabilities"
        className="rounded-xl px-4 py-2 text-sm font-semibold text-bat-text transition hover:bg-bat-accent-soft/80 hover:text-bat-primary"
        onClick={close}
      >
        {t('header.navCapabilities')}
      </a>
      <a
        href="#partners"
        className="rounded-xl px-4 py-2 text-sm font-semibold text-bat-text transition hover:bg-bat-accent-soft/80 hover:text-bat-primary"
        onClick={close}
      >
        {t('header.navPartners')}
      </a>
    </>
  );

  const authBlock = (
    <div className="flex flex-shrink-0 items-center gap-2">
      <Link
        to="/login"
        className="hidden rounded-xl border border-bat-accent bg-bat-accent-soft px-4 py-2.5 text-sm font-semibold text-bat-primary shadow-sm transition hover:border-bat-accent-hover hover:bg-bat-accent sm:inline-flex"
        onClick={close}
      >
        {t('header.login')}
      </Link>
      <Link
        to="/register"
        className="hidden rounded-xl bg-bat-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-bat-primary-hover sm:inline-flex"
        onClick={close}
      >
        {t('header.register')}
      </Link>
    </div>
  );

  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-[60] border-b border-bat-border/80 bg-bat-bg/95 shadow-[0_4px_24px_-8px_rgba(19,45,74,0.08)] backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-6 lg:px-8 lg:py-3.5">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-3 lg:justify-self-start"
          onClick={close}
        >
          <img
            src={battechnoLogo}
            alt={t('brand')}
            className="h-9 w-auto max-h-10 max-w-[min(220px,55vw)] shrink-0 object-contain object-start sm:h-10"
            decoding="async"
          />
          {variant === 'default' ? (
            <span className="hidden min-w-0 truncate text-[11px] font-medium text-bat-muted sm:block sm:max-w-[12rem] sm:text-xs">
              {t('brandSubtitle')}
            </span>
          ) : null}
        </Link>

        <nav
          className="hidden items-center justify-center gap-1 justify-self-center rounded-2xl border border-bat-border/80 bg-bat-surface-light/90 px-2 py-1.5 lg:flex"
          aria-label="Primary"
        >
          {centerLinks}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2 lg:flex-none lg:justify-self-end">
          {authBlock}
          <button
            type="button"
            className="rounded-xl border border-bat-border bg-bat-surface px-3 py-2 text-xs font-bold text-bat-ink shadow-sm transition hover:bg-bat-surface-light"
            onClick={() => setLocale(nextLocale)}
          >
            {isArabic ? 'EN' : 'عربي'}
          </button>
          <button
            type="button"
            className="rounded-xl border border-bat-border bg-bat-surface p-2.5 text-bat-ink shadow-sm transition hover:bg-bat-surface-light lg:hidden"
            aria-expanded={open}
            aria-label={open ? t('header.menuClose') : t('header.menuOpen')}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-bat-border/80 bg-bat-bg lg:hidden"
          >
            <nav className="flex flex-col gap-1 px-4 py-4" aria-label="Mobile">
              <div className="flex flex-col gap-1 rounded-2xl border border-bat-border/80 bg-bat-surface-light/90 p-2">{centerLinks}</div>
              <Link
                to="/login"
                className="mt-2 rounded-xl border border-bat-accent bg-bat-accent-soft px-4 py-3 text-center text-sm font-semibold text-bat-primary shadow-sm"
                onClick={close}
              >
                {t('header.login')}
              </Link>
              <Link
                to="/register"
                className="rounded-xl bg-bat-primary px-4 py-3 text-center text-sm font-semibold text-white shadow-md transition hover:bg-bat-primary-hover"
                onClick={close}
              >
                {t('header.register')}
              </Link>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
