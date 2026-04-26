import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { BattechnoPhoneApp } from './BattechnoPhoneApp.jsx';

export function HomeAppShowcase() {
  const { t } = useTranslation('landing');

  return (
    <section id="preview" className="relative scroll-mt-20 overflow-hidden bg-[#F5F5F3] py-16 sm:py-24">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(250, 250, 247, 0.9), transparent), radial-gradient(ellipse 70% 50% at 50% -10%, rgba(212, 154, 42, 0.05), transparent)',
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
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-800/90">{t('showcase.eyebrow')}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t('showcase.title')}</h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">{t('showcase.subtitle')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="mt-10 hidden justify-center md:mt-12 md:flex"
        >
          <div className="relative w-full max-w-[390px]">
            <div
              className="pointer-events-none absolute -inset-6 rounded-[3rem] opacity-60 blur-3xl sm:-inset-8"
              style={{
                background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.2), rgba(212, 154, 42, 0.1), rgba(250, 250, 247, 0.9))',
              }}
              aria-hidden
            />
            <div className="relative">
              <BattechnoPhoneApp variant="device" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
