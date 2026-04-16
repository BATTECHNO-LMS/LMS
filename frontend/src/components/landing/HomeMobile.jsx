import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FiArrowRight } from 'react-icons/fi';
import { HomeHeader } from './HomeHeader.jsx';
import { BattechnoPhoneApp } from './BattechnoPhoneApp.jsx';
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
      <HomeHeader variant="minimal" />
      <main className="pb-6">
        <section className="relative overflow-hidden px-4 pb-2 pt-4 sm:px-6">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            aria-hidden
            style={{
              background:
                'radial-gradient(ellipse 90% 70% at 50% -20%, rgba(99,102,241,0.35), transparent), radial-gradient(ellipse 70% 50% at 100% 60%, rgba(212,160,18,0.12), transparent)',
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative space-y-5"
          >
            <span className="inline-flex rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-200">
              {t('hero.badge')}
            </span>
            <h1 className="text-2xl font-bold leading-snug tracking-tight text-white sm:text-3xl">{t('hero.title')}</h1>
            <p className="text-sm leading-relaxed text-slate-300">{t('hero.description')}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {HERO_STAT_KEYS.map((key) => (
                <div
                  key={key}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 text-center text-[11px] font-semibold leading-snug text-slate-200"
                >
                  {t(`hero.stats.${key}`)}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                to="/register"
                className="inline-flex min-h-[3rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-sm font-bold text-slate-950 shadow-lg"
              >
                {t('hero.ctaRegister')}
                <FiArrowRight className={dir === 'rtl' ? 'rotate-180' : ''} aria-hidden />
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-[3rem] flex-1 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.08] text-sm font-bold text-white"
              >
                {t('hero.ctaLogin')}
              </Link>
            </div>
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-transparent p-5 shadow-inner backdrop-blur-md">
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-200/90">{t('hero.companyTitle')}</p>
              <p className="mt-2 text-sm font-semibold text-white">{t('hero.companyLead')}</p>
            </div>
          </motion.div>
        </section>

        <div className="px-2 pt-4 sm:px-4">
          <BattechnoPhoneApp variant="standalone" />
        </div>

        <div className="mt-10 px-4 sm:px-6">
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
