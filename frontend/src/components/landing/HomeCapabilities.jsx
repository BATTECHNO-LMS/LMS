import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  FiUsers,
  FiHome,
  FiLayers,
  FiAward,
  FiCalendar,
  FiCheckSquare,
  FiShield,
  FiGlobe,
  FiCpu,
  FiBarChart2,
} from 'react-icons/fi';
import { CAPABILITY_KEYS } from './home.constants.js';

const ICONS = {
  usersRoles: FiUsers,
  universities: FiHome,
  tracks: FiLayers,
  microCredentials: FiAward,
  cohortsSessions: FiCalendar,
  attendanceAssessments: FiCheckSquare,
  evidenceQuality: FiShield,
  recognition: FiGlobe,
  certificates: FiCpu,
  reportsAnalytics: FiBarChart2,
};

export function HomeCapabilities() {
  const { t } = useTranslation('landing');

  return (
    <section
      id="capabilities"
      className="relative scroll-mt-20 border-y border-slate-200/70 bg-[#FAFAF7] py-16 sm:py-24"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        aria-hidden
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(148, 163, 184, 0.08), transparent)',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-800/90">{t('header.navCapabilities')}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t('capabilities.title')}</h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">{t('capabilities.subtitle')}</p>
        </motion.div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY_KEYS.map((key, i) => {
            const Icon = ICONS[key] ?? FiLayers;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
                whileHover={{ y: -3 }}
                className="group relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] transition hover:border-amber-200/80 hover:shadow-[0_12px_40px_-12px_rgba(212,154,42,0.12)]"
              >
                <div
                  className="absolute -end-8 -top-8 h-24 w-24 rounded-full bg-amber-100/50 blur-2xl transition group-hover:bg-sky-100/60"
                  aria-hidden
                />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 ring-1 ring-amber-200/80">
                  <Icon className="text-xl text-amber-800 transition group-hover:scale-110" aria-hidden />
                </div>
                <p className="relative mt-5 text-sm font-bold leading-snug text-slate-900 sm:text-base">
                  {t(`capabilities.items.${key}`)}
                </p>
                <div className="relative mt-4 h-px w-12 bg-gradient-to-r from-amber-500/50 to-transparent opacity-70 transition group-hover:w-full group-hover:opacity-100" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
