import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import { BattechnoPhoneApp } from './BattechnoPhoneApp.jsx';
import { useLocale } from '../../features/locale/index.js';
import { HERO_STAT_KEYS } from './home.constants.js';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export function HomeHero() {
  const { t } = useTranslation('landing');
  const { dir } = useLocale();

  return (
    <section className="relative min-h-[calc(100vh-5rem)] overflow-hidden pb-12 pt-6 sm:pb-16 sm:pt-10 lg:flex lg:items-center lg:pb-20 lg:pt-12">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 100% 70% at 0% 0%, rgba(212, 154, 42, 0.06), transparent 52%), radial-gradient(ellipse 80% 55% at 100% 15%, rgba(148, 163, 184, 0.08), transparent 50%), radial-gradient(ellipse 60% 45% at 50% 100%, rgba(250, 250, 247, 0.95), transparent)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#FAFAF7] to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 sm:gap-12 sm:px-6 md:gap-14 lg:min-h-[560px] lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex w-full flex-1 flex-col justify-center space-y-6 md:max-w-xl lg:max-w-xl lg:space-y-7 xl:max-w-2xl"
        >
          <motion.div variants={item}>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-900 shadow-sm">
              {t('hero.badge')}
            </span>
          </motion.div>

          <motion.div variants={item} className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {t('hero.mainTitle')}
            </h1>
            <p className="text-lg font-bold leading-snug text-slate-800 sm:text-xl lg:text-2xl lg:leading-snug">
              {t('hero.title')}
            </p>
          </motion.div>

          <motion.p variants={item} className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            {t('hero.description')}
          </motion.p>

          <motion.div variants={item} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {HERO_STAT_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_20px_-8px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 transition hover:border-amber-200/70 hover:shadow-md"
              >
                <FiCheckCircle className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
                <p className="text-xs font-semibold leading-snug text-slate-700 sm:text-sm">{t(`hero.stats.${key}`)}</p>
              </div>
            ))}
          </motion.div>

          <motion.div
            variants={item}
            className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.08)] ring-1 ring-slate-100/80"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(212,154,42,0.6)]" aria-hidden />
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-sky-800/90">{t('hero.companyTitle')}</h2>
            </div>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">{t('hero.companyLead')}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('hero.companyBody')}</p>
          </motion.div>

          <motion.div variants={item} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              to="/register"
              className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-8 text-base font-bold text-slate-950 shadow-[0_10px_32px_-8px_rgba(212,154,42,0.45)] transition hover:brightness-105"
            >
              {t('hero.ctaRegister')}
              <FiArrowRight className={dir === 'rtl' ? 'rotate-180' : ''} aria-hidden />
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-2xl border border-slate-300 bg-white px-8 text-base font-bold text-slate-800 shadow-sm transition hover:border-amber-300/60 hover:bg-slate-50"
            >
              {t('hero.ctaLogin')}
            </Link>
            <a
              href="#capabilities"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-2xl px-4 text-sm font-bold text-amber-800 underline-offset-4 hover:underline sm:px-6"
            >
              {t('hero.ctaExplore')}
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="relative hidden w-full flex-1 items-center justify-center md:flex lg:justify-end"
        >
          <div
            className="pointer-events-none absolute -inset-4 rounded-[3rem] opacity-70 blur-2xl sm:-inset-8"
            style={{
              background:
                'radial-gradient(circle at 40% 30%, rgba(148, 163, 184, 0.18), transparent 50%), radial-gradient(circle at 70% 70%, rgba(212, 154, 42, 0.1), transparent 45%)',
            }}
            aria-hidden
          />
          <div className="relative w-full max-w-[390px] shrink-0">
            <BattechnoPhoneApp variant="device" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
