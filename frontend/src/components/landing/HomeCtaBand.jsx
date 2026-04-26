import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FiArrowRight } from 'react-icons/fi';
import { useLocale } from '../../features/locale/index.js';

export function HomeCtaBand() {
  const { t } = useTranslation('landing');
  const { dir } = useLocale();

  return (
    <section className="relative bg-[#FAFAF7] py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-10 shadow-[0_16px_48px_-16px_rgba(15,23,42,0.08)] ring-1 ring-slate-100/90 sm:p-14"
        >
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-200/25 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-12 h-56 w-56 rounded-full bg-slate-200/30 blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t('cta.title')}</h2>
            <p className="mt-4 text-base text-slate-600 sm:text-lg">{t('cta.subtitle')}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/register"
                className="inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-8 py-3 text-base font-bold text-slate-950 shadow-lg transition hover:brightness-105"
              >
                {t('cta.primary')}
                <FiArrowRight className={dir === 'rtl' ? 'rotate-180' : ''} aria-hidden />
              </Link>
              <Link
                to="/login"
                className="inline-flex min-h-[3rem] items-center justify-center rounded-2xl border-2 border-slate-300 bg-white px-8 py-3 text-base font-semibold text-slate-800 shadow-sm transition hover:border-amber-300/60 hover:bg-slate-50"
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
