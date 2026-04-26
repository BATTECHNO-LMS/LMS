import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FiArrowRight } from 'react-icons/fi';
import { HomeHeader } from './HomeHeader.jsx';
import { HomeCapabilities } from './HomeCapabilities.jsx';
import { HomePartners } from './HomePartners.jsx';
import { HomeCtaBand } from './HomeCtaBand.jsx';
import { useLocale } from '../../features/locale/index.js';
import { HERO_STAT_KEYS } from './home.constants.js';

export function HomeMobile() {
  const { t } = useTranslation('landing');
  const { dir } = useLocale();

  return (
    <>
      <HomeHeader variant="minimal" hidePreviewNav />
      <main className="pb-6">
        <section className="relative flex min-h-[calc(100svh-5.5rem)] flex-col justify-center overflow-hidden px-4 py-8 sm:px-6">
          <div
            className="pointer-events-none absolute inset-0 opacity-100"
            aria-hidden
            style={{
              background:
                'radial-gradient(ellipse 100% 80% at 50% 0%, rgba(212, 154, 42, 0.06), transparent 55%), radial-gradient(ellipse 80% 50% at 100% 100%, rgba(148, 163, 184, 0.06), transparent)',
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative mx-auto flex w-full max-w-2xl flex-col space-y-5 text-center sm:text-start"
          >
            <span className="inline-flex rounded-full border border-amber-200/80 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-900">
              {t('hero.badge')}
            </span>
            <h1 className="text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-3xl">{t('hero.mainTitle')}</h1>
            <p className="text-base font-bold leading-snug text-slate-800 sm:text-lg">{t('hero.title')}</p>
            <p className="text-sm leading-relaxed text-slate-600">{t('hero.description')}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {HERO_STAT_KEYS.map((key) => (
                <div
                  key={key}
                  className="rounded-2xl border border-slate-200/90 bg-white px-3 py-3 text-center text-[11px] font-semibold leading-snug text-slate-700 shadow-sm"
                >
                  {t(`hero.stats.${key}`)}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link
                to="/register"
                className="inline-flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-sm font-bold text-slate-950 shadow-md sm:max-w-xs sm:flex-none sm:px-8"
              >
                {t('hero.ctaRegister')}
                <FiArrowRight className={dir === 'rtl' ? 'rotate-180' : ''} aria-hidden />
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-2xl border border-slate-300/90 bg-white text-sm font-bold text-slate-800 shadow-sm sm:max-w-xs sm:flex-none sm:px-8"
              >
                {t('hero.ctaLogin')}
              </Link>
            </div>
            <div className="flex justify-center sm:justify-start">
              <a
                href="#capabilities"
                className="inline-flex min-h-[2.75rem] items-center justify-center rounded-2xl px-4 text-sm font-bold text-amber-900 underline-offset-4 hover:underline"
              >
                {t('hero.ctaExplore')}
              </a>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.08)] ring-1 ring-slate-100/80">
              <p className="text-xs font-bold uppercase tracking-widest text-sky-800/90">{t('hero.companyTitle')}</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-900">{t('hero.companyLead')}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{t('hero.companyBody')}</p>
            </div>
          </motion.div>
        </section>

        <div className="mt-8 px-4 sm:px-6">
          <HomeCapabilities />
        </div>
        <div className="mt-4 px-4 sm:px-6">
          <HomePartners />
        </div>
        <div className="mt-6 px-4 sm:px-6">
          <HomeCtaBand />
        </div>
      </main>
    </>
  );
}
