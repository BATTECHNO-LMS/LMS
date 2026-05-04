import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FiArrowRight } from 'react-icons/fi';
import { BattechnoPhoneApp } from './BattechnoPhoneApp.jsx';
import { useLocale } from '../../features/locale/index.js';
import battechnoLogo from '../../assets/images/batman-logo.png';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
};

export function HomeHero() {
  const { t, i18n } = useTranslation('landing');
  const { dir } = useLocale();
  const headline = t('hero.headline', { defaultValue: t('hero.title') });

  return (
    <section className="relative min-h-[calc(100dvh-4.25rem)] overflow-hidden pb-16 pt-10 sm:pb-20 sm:pt-14 lg:flex lg:min-h-[calc(100dvh-4.5rem)] lg:items-center lg:pb-24 lg:pt-16">
      <div className="pointer-events-none absolute inset-0 bg-bat-bg" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 0% 0%, rgba(19, 45, 74, 0.06), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 20%, rgba(201, 162, 39, 0.05), transparent 50%)',
        }}
      />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 sm:gap-16 sm:px-6 lg:min-h-[min(640px,calc(100dvh-8rem))] lg:flex-row lg:items-center lg:gap-20 lg:px-8">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex w-full flex-1 flex-col justify-center lg:max-w-[min(100%,32rem)] xl:max-w-xl"
        >
          <motion.div variants={item} className="space-y-5">
            <img
              src={battechnoLogo}
              alt={t('brand')}
              className="h-12 w-auto max-w-[min(280px,85vw)] object-contain object-start sm:h-14"
              decoding="async"
            />
            <span className="inline-flex items-center rounded-full border border-bat-border bg-bat-surface px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-bat-muted shadow-sm">
              {t('hero.badge')}
            </span>
          </motion.div>

          <motion.div variants={item} className="mt-6 space-y-4">
            <h1
              className={`text-balance text-3xl font-bold tracking-tight text-bat-ink sm:text-4xl sm:leading-[1.15] lg:text-[2.35rem] lg:leading-[1.12] ${i18n.language.startsWith('ar') ? 'font-bold' : ''}`}
            >
              {headline}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-bat-muted sm:text-lg">{t('hero.description')}</p>
          </motion.div>

          <motion.div variants={item} className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              to="/register"
              className="inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl bg-bat-primary px-8 text-base font-semibold text-white shadow-[0_8px_28px_-8px_rgba(19,45,74,0.35)] transition hover:bg-bat-primary-hover"
            >
              {t('hero.ctaRegister')}
              <FiArrowRight className={dir === 'rtl' ? 'rotate-180' : ''} aria-hidden />
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-[3rem] items-center justify-center rounded-xl border border-bat-accent bg-bat-accent-soft px-8 text-base font-semibold text-bat-primary shadow-sm transition hover:border-bat-accent-hover hover:bg-bat-accent hover:text-bat-primary"
            >
              {t('hero.ctaLogin')}
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          className="relative hidden w-full flex-1 items-center justify-center lg:flex"
        >
          <motion.div
            animate={{ y: [0, -7, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            className="relative w-full max-w-[min(100%,380px)] shrink-0 xl:max-w-[400px]"
          >
            <div
              className="pointer-events-none absolute -inset-8 rounded-[3.5rem] opacity-80 blur-3xl"
              style={{
                background:
                  'radial-gradient(circle at 45% 35%, rgba(19, 45, 74, 0.12), transparent 52%), radial-gradient(circle at 70% 65%, rgba(201, 162, 39, 0.1), transparent 48%)',
              }}
              aria-hidden
            />
            <div className="relative">
              <BattechnoPhoneApp variant="device" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
