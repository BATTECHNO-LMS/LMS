import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FiUsers, FiEye, FiLayers, FiAward } from 'react-icons/fi';
import { useLandingStatsContext } from '../../features/landing/LandingStatsContext.jsx';
import { useCountUp } from '../../features/landing/hooks/useCountUp.js';
import { useLandingMotion, MOTION_STAGGER } from './motion/index.js';

const STAT_ITEMS = [
  { id: 'users', valueKey: 'usersCount', labelKey: 'hero.liveStats.users', Icon: FiUsers },
  { id: 'visits', valueKey: 'visitsCount', labelKey: 'hero.liveStats.visits', Icon: FiEye },
  { id: 'cohorts', valueKey: 'cohortsCount', labelKey: 'hero.liveStats.cohorts', Icon: FiLayers },
  { id: 'certificates', valueKey: 'certificatesCount', labelKey: 'hero.liveStats.certificates', Icon: FiAward },
];

/**
 * @param {{ variant?: 'grid' | 'inline' }} props
 */
export function LandingStats({ variant = 'grid' }) {
  const { t } = useTranslation('landing');
  const { stats, isLoading } = useLandingStatsContext();
  const { staggerContainer, staggerItem } = useLandingMotion();

  const isHero = variant === 'inline';
  const containerClass = `landing-stats-grid${isHero ? ' landing-stats-grid--hero' : ''} ${isHero ? 'mt-7 sm:mt-8' : 'mt-6 sm:mt-7'} w-full`;

  return (
    <motion.div
      variants={staggerContainer(MOTION_STAGGER.tight, isHero ? 0.1 : 0.12)}
      initial="hidden"
      animate={isHero ? 'show' : undefined}
      whileInView={isHero ? undefined : 'show'}
      viewport={isHero ? undefined : { once: true, margin: '-40px' }}
      className={containerClass}
      aria-label={t('hero.liveStats.aria')}
    >
      {STAT_ITEMS.map(({ id, valueKey, labelKey, Icon }) => (
        <StatCard
          key={id}
          label={t(labelKey)}
          rawValue={stats?.[valueKey]}
          isLoading={isLoading}
          variants={staggerItem(isHero ? 10 : 12)}
          Icon={Icon}
        />
      ))}
    </motion.div>
  );
}

function StatCard({ label, rawValue, isLoading, variants, Icon }) {
  const animated = useCountUp(rawValue, { enabled: !isLoading && rawValue != null });
  const display = isLoading ? '—' : rawValue == null ? '—' : animated.toLocaleString();

  return (
    <motion.article variants={variants} className="landing-stat-card">
      <span className="landing-stat-card__wave" aria-hidden />
      <span className="landing-stat-card__glow" aria-hidden />
      <span className="landing-stat-card__accent" aria-hidden />
      <span className="landing-stat-card__icon" aria-hidden>
        <Icon size={18} />
      </span>
      <p className="landing-stat-card__value">{display}</p>
      <p className="landing-stat-card__label">{label}</p>
    </motion.article>
  );
}
