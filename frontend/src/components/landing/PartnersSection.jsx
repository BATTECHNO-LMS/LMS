import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { PARTNER_INSTITUTIONS } from './home.constants.js';
import { PartnerCard } from './PartnerCard.jsx';
import { LandingSection, LandingSectionContent } from './LandingSection.jsx';
import {
  useLandingMotion,
  LandingSectionHeader,
  MOTION_STAGGER,
  VIEWPORT_CARD,
} from './motion/index.js';

export function PartnersSection() {
  const { t } = useTranslation('landing');
  const { staggerContainer, staggerItem } = useLandingMotion();

  return (
    <LandingSection variant="partners" id="partners" compact>
      <LandingSectionContent>
        <LandingSectionHeader
          eyebrow={t('header.navPartners')}
          title={t('partners.sectionTitle')}
          subtitle={t('partners.sectionSubtitle')}
          wide
        />

        <motion.div
          variants={staggerContainer(MOTION_STAGGER.normal, 0.1)}
          initial="hidden"
          whileInView="show"
          viewport={VIEWPORT_CARD}
          className="landing-after-header landing-grid landing-grid--loose auto-rows-fr sm:grid-cols-2 lg:grid-cols-3"
        >
          {PARTNER_INSTITUTIONS.map((p) => (
            <motion.div key={p.id} variants={staggerItem(16)} className="flex h-full">
              <PartnerCard
                initials={p.initials}
                nameKey={p.nameKey}
                category={p.category}
                logoUrl={p.logoUrl}
                descriptionKey={p.descriptionKey}
              />
            </motion.div>
          ))}
        </motion.div>
      </LandingSectionContent>
    </LandingSection>
  );
}
