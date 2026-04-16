import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FiArrowRight } from 'react-icons/fi';
import { useLocale } from '../../features/locale/index.js';

export function HomeCtaBand() {
  const { t } = useTranslation('landing');
  const { dir } = useLocale();

  return (
    <section className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-indigo-600/90 via-indigo-800/90 to-slate-900 p-10 shadow-[0_32px_100px_-24px_rgba(79,70,229,0.55)] sm:p-14"
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-sky-400/15 blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{t('cta.title')}</h2>
            <p className="mt-4 text-base text-indigo-100/90 sm:text-lg">{t('cta.subtitle')}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-2xl bg-amber-400 px-8 py-3 text-base font-bold text-slate-950 shadow-lg transition hover:bg-amber-300"
              >
                {t('cta.primary')}
                <FiArrowRight className={dir === 'rtl' ? 'rotate-180' : ''} aria-hidden />
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-[3rem] items-center justify-center rounded-2xl border-2 border-white/40 bg-white/10 px-8 py-3 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                {t('cta.secondary')}
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
