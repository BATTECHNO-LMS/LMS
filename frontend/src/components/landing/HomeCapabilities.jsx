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
      className="relative border-t border-white/[0.06] bg-gradient-to-b from-slate-950/90 via-slate-900/80 to-slate-950 py-20 sm:py-28"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.12), transparent)',
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
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300/90">{t('header.navCapabilities')}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{t('capabilities.title')}</h2>
          <p className="mt-4 text-base text-slate-400 sm:text-lg">{t('capabilities.subtitle')}</p>
        </motion.div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY_KEYS.map((key, i) => {
            const Icon = ICONS[key] ?? FiLayers;
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
                whileHover={{ y: -4 }}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-6 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-amber-400/30 hover:shadow-[0_28px_60px_-20px_rgba(245,158,11,0.15)]"
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl transition group-hover:bg-amber-500/10" aria-hidden />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/25 to-amber-600/5 ring-1 ring-amber-500/25">
                  <Icon className="text-xl text-amber-300 transition group-hover:scale-110" aria-hidden />
                </div>
                <p className="relative mt-5 text-sm font-bold leading-snug text-white sm:text-base">{t(`capabilities.items.${key}`)}</p>
                <div className="relative mt-4 h-px w-12 bg-gradient-to-r from-amber-400/60 to-transparent opacity-60 transition group-hover:w-full group-hover:opacity-100" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
