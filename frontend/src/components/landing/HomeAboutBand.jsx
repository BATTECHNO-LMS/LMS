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
      className="relative border-y border-white/[0.08] bg-gradient-to-br from-indigo-950/80 via-slate-950 to-slate-950 py-20 sm:py-24"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 20% 40%, rgba(99,102,241,0.18), transparent), radial-gradient(ellipse 50% 40% at 90% 60%, rgba(212,160,18,0.12), transparent)',
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
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300/90">{t('about.eyebrow')}</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t('about.title')}</h2>
            <p className="mt-4 text-base leading-relaxed text-slate-300 sm:text-lg">{t('about.lead')}</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {chips.map(({ key, icon: Icon }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-slate-200 shadow-inner backdrop-blur-sm"
                >
                  <Icon className="text-amber-400" aria-hidden />
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
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-8 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-10">
              <div className="grid gap-6 sm:grid-cols-2">
                <p className="text-sm leading-relaxed text-slate-300 sm:text-base">{t('about.p1')}</p>
                <p className="text-sm leading-relaxed text-slate-300 sm:text-base">{t('about.p2')}</p>
              </div>
              <div className="mt-8 h-px w-full bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
              <p className="mt-6 text-center text-xs font-medium uppercase tracking-widest text-slate-500">BATTECHNO · 2017</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
