import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FiShield, FiLayers, FiAward } from 'react-icons/fi';

export function HomeAboutBand() {
  const { t } = useTranslation('landing');

  const chips = [
    { key: 'chip1', icon: FiShield },
    { key: 'chip2', icon: FiLayers },
    { key: 'chip3', icon: FiAward },
  ];

  return (
    <section
      id="about"
      className="relative scroll-mt-20 border-y border-slate-200/70 bg-[#F5F5F3] py-16 sm:py-24"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 20% 40%, rgba(212, 154, 42, 0.05), transparent), radial-gradient(ellipse 50% 40% at 90% 60%, rgba(148, 163, 184, 0.06), transparent)',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-5"
          >
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-800/90">{t('about.eyebrow')}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t('about.title')}</h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{t('about.lead')}</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {chips.map(({ key, icon: Icon }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm"
                >
                  <Icon className="text-amber-700" aria-hidden />
                  {t(`about.${key}`)}
                </span>
              ))}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="lg:col-span-7"
          >
            <div className="rounded-3xl border border-slate-200/90 bg-white p-8 shadow-[0_12px_48px_-16px_rgba(15,23,42,0.1)] ring-1 ring-slate-100 sm:p-10">
              <div className="grid gap-6 sm:grid-cols-2">
                <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{t('about.p1')}</p>
                <p className="text-sm leading-relaxed text-slate-600 sm:text-base">{t('about.p2')}</p>
              </div>
              <div className="mt-8 h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
              <p className="mt-6 text-center text-xs font-medium uppercase tracking-widest text-slate-500">BATTECHNO · 2017</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
