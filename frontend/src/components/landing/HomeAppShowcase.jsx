import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { BattechnoPhoneApp } from './BattechnoPhoneApp.jsx';

export function HomeAppShowcase() {
  const { t } = useTranslation('landing');

  return (
    <section
      id="preview"
      className="relative overflow-hidden py-20 sm:py-28"
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(circle at 50% 120%, rgba(15,23,42,0.95), rgba(2,6,23,1)), radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.2), transparent)',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300/90">{t('showcase.eyebrow')}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t('showcase.title')}</h2>
          <p className="mt-4 text-base text-slate-400 sm:text-lg">{t('showcase.subtitle')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="mt-14 flex justify-center"
        >
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-8 rounded-[3rem] opacity-90 blur-3xl"
              style={{
                background:
                  'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(212,160,18,0.2), rgba(56,189,248,0.15))',
              }}
              aria-hidden
            />
            <div className="relative">
              <BattechnoPhoneApp variant="device" className="scale-[1.02] sm:scale-105" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
