import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  FiUsers,
  FiHome,
  FiBookOpen,
  FiAward,
  FiTrendingUp,
  FiCalendar,
  FiBriefcase,
  FiBarChart2,
} from 'react-icons/fi';
import { FEATURE_KEYS } from './home.constants.js';
import { LandingSection, LandingSectionContent } from './LandingSection.jsx';
import { SectionDecoration } from './decorations/index.js';
import {
  useLandingMotion,
  LandingSectionHeader,
  LandingFeatureCard,
  MOTION_STAGGER,
  VIEWPORT_CARD,
} from './motion/index.js';

const ICONS = {
  usersRoles: FiUsers,
  universities: FiHome,
  trainingCourses: FiBookOpen,
  microCredentials: FiAward,
  gradesAssessments: FiTrendingUp,
  attendance: FiCalendar,
  fieldTraining: FiBriefcase,
  reportsAnalytics: FiBarChart2,
};

export function FeaturesSection() {
  const { t } = useTranslation('landing');
  const { staggerContainer, staggerItem } = useLandingMotion();

  return (
    <LandingSection variant="features" id="capabilities">
      <SectionDecoration section="features" />

      <LandingSectionContent>
        <LandingSectionHeader
          eyebrow={t('features.eyebrow')}
          title={t('features.title')}
          subtitle={t('features.subtitle')}
          wide
        />

        <motion.div
          variants={staggerContainer(MOTION_STAGGER.tight, 0.1)}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_CARD}
          className="landing-after-header landing-grid landing-grid--loose sm:grid-cols-2 xl:grid-cols-4"
        >
          {FEATURE_KEYS.map((key) => {
            const Icon = ICONS[key] ?? FiBookOpen;
            return (
              <LandingFeatureCard
                key={key}
                icon={Icon}
                title={t(`features.list.${key}.title`)}
                description={t(`features.list.${key}.desc`)}
                variants={staggerItem(16)}
              />
            );
          })}
        </motion.div>
      </LandingSectionContent>
    </LandingSection>
  );
}
