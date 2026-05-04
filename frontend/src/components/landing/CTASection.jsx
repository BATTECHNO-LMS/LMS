import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FiArrowRight } from 'react-icons/fi';
import { useLocale } from '../../features/locale/index.js';

export function CTASection() {
  const { t } = useTranslation('landing');
  const { dir } = useLocale();

  return (
    <section className="relative border-t border-bat-border/70 bg-bat-bg py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl rounded-3xl border border-bat-border/90 bg-bat-surface px-8 py-12 text-center shadow-[0_20px_60px_-24px_rgba(19,45,74,0.12)] sm:px-14 sm:py-16"
        >
          <h2 className="text-2xl font-bold tracking-tight text-bat-ink sm:text-3xl">{t('cta.title')}</h2>
          <p className="mt-4 text-base text-bat-muted sm:text-lg">{t('cta.subtitle')}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              to="/register"
              className="inline-flex min-h-[3rem] w-full min-w-[200px] items-center justify-center gap-2 rounded-xl bg-bat-primary px-8 text-base font-semibold text-white shadow-[0_8px_28px_-8px_rgba(19,45,74,0.35)] transition hover:bg-bat-primary-hover sm:w-auto"
            >
              {t('cta.primary')}
              <FiArrowRight className={dir === 'rtl' ? 'rotate-180' : ''} aria-hidden />
            </Link>
            <Link
              to="/login"
              className="inline-flex min-h-[3rem] w-full min-w-[200px] items-center justify-center rounded-xl border border-bat-accent bg-bat-accent-soft px-8 text-base font-semibold text-bat-primary shadow-sm transition hover:border-bat-accent-hover hover:bg-bat-accent sm:w-auto"
            >
              {t('cta.secondary')}
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
