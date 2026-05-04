import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  FiUsers,
  FiHome,
  FiLayers,
  FiAward,
  FiTrendingUp,
  FiCalendar,
  FiShield,
  FiBarChart2,
} from 'react-icons/fi';
import { FEATURE_KEYS } from './home.constants.js';

const ICONS = {
  usersRoles: FiUsers,
  universities: FiHome,
  tracks: FiLayers,
  microCredentials: FiAward,
  gradesAssessments: FiTrendingUp,
  attendance: FiCalendar,
  qualityAccreditation: FiShield,
  reportsAnalytics: FiBarChart2,
};

export function FeaturesSection() {
  const { t } = useTranslation('landing');

  return (
    <section
      id="capabilities"
      className="relative scroll-mt-20 border-t border-bat-border/70 bg-bat-bg py-20 sm:py-28"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-bat-muted">{t('features.eyebrow')}</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-bat-ink sm:text-[2rem] sm:leading-tight">
            {t('features.title')}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-bat-muted sm:text-lg">{t('features.subtitle')}</p>
        </motion.div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {FEATURE_KEYS.map((key, i) => {
            const Icon = ICONS[key] ?? FiLayers;
            return (
              <motion.article
                key={key}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-20px' }}
                transition={{ duration: 0.35, delay: i * 0.035 }}
                whileHover={{ y: -4 }}
                className="group flex flex-col rounded-2xl border border-bat-border/80 bg-bat-surface p-6 shadow-[0_2px_24px_-12px_rgba(19,45,74,0.08)] transition-[box-shadow,border-color] duration-300 hover:border-bat-accent/40 hover:shadow-[0_12px_40px_-16px_rgba(19,45,74,0.12)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-bat-border/90 bg-bat-bg text-bat-primary transition group-hover:border-bat-accent group-hover:bg-bat-accent-soft group-hover:text-bat-primary">
                  <Icon className="text-xl" aria-hidden />
                </div>
                <h3 className="mt-5 text-base font-bold leading-snug text-bat-ink">
                  {t(`features.list.${key}.title`)}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-bat-muted">{t(`features.list.${key}.desc`)}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
