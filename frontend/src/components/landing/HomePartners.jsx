import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FiTrendingUp, FiBook } from 'react-icons/fi';

export function HomePartners() {
  const { t } = useTranslation('landing');

  return (
    <section id="partners" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300/90">{t('header.navPartners')}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t('partners.title')}</h2>
        </motion.div>
        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.14] via-slate-900/40 to-slate-950 p-8 shadow-[0_24px_60px_-20px_rgba(245,158,11,0.2)] backdrop-blur-md sm:p-10"
          >
            <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
            <FiTrendingUp className="relative text-4xl text-amber-400" />
            <h3 className="relative mt-6 text-xl font-bold text-white">{t('partners.success')}</h3>
            <p className="relative mt-3 text-sm leading-relaxed text-slate-200 sm:text-base">{t('partners.successDesc')}</p>
          </motion.article>
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            whileHover={{ y: -4 }}
            transition={{ duration: 0.4, delay: 0.06 }}
            className="relative overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.12] via-slate-900/40 to-slate-950 p-8 shadow-[0_24px_60px_-20px_rgba(14,165,233,0.18)] backdrop-blur-md sm:p-10"
          >
            <div className="absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-sky-400/10 blur-3xl" aria-hidden />
            <FiBook className="relative text-4xl text-sky-400" />
            <h3 className="relative mt-6 text-xl font-bold text-white">{t('partners.academic')}</h3>
            <p className="relative mt-3 text-sm leading-relaxed text-slate-200 sm:text-base">{t('partners.academicDesc')}</p>
          </motion.article>
        </div>
      </div>
    </section>
  );
}
