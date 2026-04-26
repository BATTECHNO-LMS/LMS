import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiX } from 'react-icons/fi';
import { useLocale } from '../../features/locale/index.js';

/**
 * @param {{ variant?: 'default' | 'minimal', hidePreviewNav?: boolean }} props
 */
export function HomeHeader({ variant = 'default', hidePreviewNav = false }) {
  const { t } = useTranslation('landing');
  const { isArabic, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const nextLocale = isArabic ? 'en' : 'ar';

  const close = () => setOpen(false);

  const centerLinks = (
    <>
      <a
        href="#capabilities"
        className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-[#F0F0EC] hover:text-slate-900"
        onClick={close}
      >
        {t('header.navCapabilities')}
      </a>
      <a
        href="#partners"
        className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-[#F0F0EC] hover:text-slate-900"
        onClick={close}
      >
        {t('header.navPartners')}
      </a>
      {hidePreviewNav ? null : (
        <a
          href="#preview"
          className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-[#F0F0EC] hover:text-slate-900"
          onClick={close}
        >
          {t('header.navPreview')}
        </a>
      )}
    </>
  );

  const authBlock = (
    <div className="flex flex-shrink-0 items-center gap-2">
      <Link
        to="/login"
        className="hidden rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-amber-300/60 hover:bg-slate-50 sm:inline-flex"
        onClick={close}
      >
        {t('header.login')}
      </Link>
      <Link
        to="/register"
        className="hidden rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md transition hover:brightness-105 sm:inline-flex"
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
      className="sticky top-0 z-[60] border-b border-slate-200/70 bg-[#FAFAF7]/95 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.06)] backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-6 lg:px-8 lg:py-3.5">
        <Link
          to="/"
          className="flex min-w-0 flex-col justify-center lg:justify-self-start"
          onClick={close}
        >
          <span className="truncate text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">{t('brand')}</span>
          {variant === 'default' ? (
            <span className="truncate text-[11px] font-medium text-amber-800/90 sm:text-xs">{t('brandSubtitle')}</span>
          ) : null}
        </Link>

        <nav
          className="hidden items-center justify-center gap-1 justify-self-center rounded-2xl border border-slate-200/70 bg-[#F4F4F0]/90 px-2 py-1.5 lg:flex"
          aria-label="Primary"
        >
          {centerLinks}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2 lg:flex-none lg:justify-self-end">
          {authBlock}
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
            onClick={() => setLocale(nextLocale)}
          >
            {isArabic ? 'EN' : 'عربي'}
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-800 shadow-sm transition hover:bg-slate-50 lg:hidden"
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
            className="overflow-hidden border-t border-slate-200/70 bg-[#FAFAF7] lg:hidden"
          >
            <nav className="flex flex-col gap-1 px-4 py-4" aria-label="Mobile">
              <div className="flex flex-col gap-1 rounded-2xl border border-slate-200/70 bg-[#F4F4F0]/90 p-2">{centerLinks}</div>
              <Link
                to="/login"
                className="mt-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-800 shadow-sm"
                onClick={close}
              >
                {t('header.login')}
              </Link>
              <Link
                to="/register"
                className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 text-center text-sm font-bold text-slate-950 shadow-md"
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
