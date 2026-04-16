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
            'radial-gradient(ellipse 100% 80% at 50% -30%, rgba(99,102,241,0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 20%, rgba(212,160,18,0.12), transparent), radial-gradient(ellipse 60% 40% at 0% 80%, rgba(56,189,248,0.08), transparent)',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-slate-950 to-transparent" aria-hidden />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 sm:gap-14 sm:px-6 lg:min-h-[560px] lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-1 flex-col justify-center space-y-7 lg:max-w-xl lg:space-y-8 xl:max-w-2xl"
        >
          <motion.div variants={item}>
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-amber-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-200/95 shadow-sm shadow-amber-900/20">
              {t('hero.badge')}
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            className="text-[1.65rem] font-bold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-[3.25rem] xl:leading-[1.1]"
          >
            {t('hero.title')}
          </motion.h1>

          <motion.p variants={item} className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
            {t('hero.description')}
          </motion.p>

          <motion.div variants={item} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {HERO_STAT_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4 shadow-inner backdrop-blur-sm transition hover:border-amber-500/25 hover:bg-white/[0.08]"
              >
                <FiCheckCircle className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
                <p className="text-xs font-semibold leading-snug text-slate-200 sm:text-sm">{t(`hero.stats.${key}`)}</p>
              </div>
            ))}
          </motion.div>

          <motion.div
            variants={item}
            className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.02] p-6 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]" aria-hidden />
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200/90">{t('hero.companyTitle')}</h2>
            </div>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-white sm:text-base">{t('hero.companyLead')}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{t('hero.companyBody')}</p>
          </motion.div>

          <motion.div variants={item} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              to="/register"
              className="inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-8 text-base font-bold text-slate-950 shadow-[0_12px_40px_-8px_rgba(245,158,11,0.55)] transition hover:brightness-105"
            >
              {t('hero.ctaRegister')}
              <FiArrowRight className={dir === 'rtl' ? 'rotate-180' : ''} aria-hidden />
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-2xl border border-white/20 bg-white/[0.06] px-8 text-base font-bold text-white backdrop-blur-sm transition hover:border-white/35 hover:bg-white/10"
            >
              {t('hero.ctaLogin')}
            </Link>
            <a
              href="#capabilities"
              className="inline-flex min-h-[3.25rem] items-center justify-center rounded-2xl px-4 text-sm font-bold text-amber-200/95 underline-offset-4 hover:underline sm:px-6"
            >
              {t('hero.ctaExplore')}
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="relative flex flex-1 items-center justify-center lg:justify-end"
        >
          <div
            className="pointer-events-none absolute -inset-6 rounded-[3.5rem] opacity-100 blur-2xl sm:-inset-10"
            style={{
              background:
                'radial-gradient(circle at 40% 30%, rgba(99,102,241,0.45), transparent 50%), radial-gradient(circle at 70% 70%, rgba(212,160,18,0.25), transparent 45%)',
            }}
            aria-hidden
          />
          <div className="relative w-full max-w-[440px]">
            <BattechnoPhoneApp variant="device" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
