import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useLocale } from '../../features/locale/index.js';
import { LandingSection, LandingSectionContent } from './LandingSection.jsx';
import { SectionDecoration } from './decorations/index.js';
import { useLandingMotion, LandingCtaButton, MOTION_DURATION, MOTION_STAGGER } from './motion/index.js';

export function CTASection() {
  const { t } = useTranslation('landing');
  const { dir } = useLocale();
  const { fadeUp, transition, staggerContainer, staggerItem } = useLandingMotion();

  return (
    <LandingSection variant="cta" compact>
      <SectionDecoration section="cta" />

      <LandingSectionContent>
        <motion.div
          variants={staggerContainer(MOTION_STAGGER.normal, 0.06)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          className="mx-auto w-full max-w-4xl rounded-3xl landing-premium-card px-6 py-10 text-center shadow-[0_20px_60px_-24px_rgba(19,45,74,0.12)] sm:px-12 sm:py-12 lg:px-16"
        >
          <motion.h2
            variants={fadeUp(20)}
            transition={transition(MOTION_DURATION.medium)}
            className="text-[length:var(--landing-title-section)] font-bold tracking-tight text-bat-ink"
          >
            {t('cta.title')}
          </motion.h2>
          <motion.p
            variants={fadeUp(14)}
            transition={transition(MOTION_DURATION.medium, 0.08)}
            className="mt-3 text-base text-bat-muted sm:text-lg"
          >
            {t('cta.subtitle')}
          </motion.p>
          <motion.div
            variants={staggerContainer(MOTION_STAGGER.tight, 0.14)}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
          >
            <motion.div variants={staggerItem(12)} className="w-full sm:w-auto">
              <LandingCtaButton to="/portals" variant="primary" showArrow rtl={dir === 'rtl'}>
                {t('cta.primary')}
              </LandingCtaButton>
            </motion.div>
            <motion.div variants={staggerItem(12)} className="w-full sm:w-auto">
              <LandingCtaButton to="/portals" variant="secondary">
                {t('cta.secondary')}
              </LandingCtaButton>
            </motion.div>
          </motion.div>
        </motion.div>
      </LandingSectionContent>
    </LandingSection>
  );
}
