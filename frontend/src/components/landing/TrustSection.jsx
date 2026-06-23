import { useTranslation } from 'react-i18next';

import { motion } from 'framer-motion';

import { TRUST_KEYS } from './home.constants.js';

import { LandingSection, LandingSectionContent } from './LandingSection.jsx';
import { SectionDecoration } from './decorations/index.js';

import {

  useLandingMotion,

  LandingSectionHeader,

  LandingFeatureCard,

  MOTION_STAGGER,

  VIEWPORT_CARD,

} from './motion/index.js';

import { FiShield, FiFileText, FiAward, FiBriefcase } from 'react-icons/fi';



const ICONS = {

  rbac: FiShield,

  audit: FiFileText,

  certificates: FiAward,

  institutions: FiBriefcase,

};



export function TrustSection() {

  const { t } = useTranslation('landing');

  const { staggerContainer, staggerItem } = useLandingMotion();



  return (

    <LandingSection variant="trust" id="trust" compact>

      <SectionDecoration section="trust" />

      <LandingSectionContent>

        <LandingSectionHeader

          eyebrow={t('trust.eyebrow')}

          title={t('trust.title')}

          subtitle={t('trust.subtitle')}

          wide

        />



        <motion.div

          variants={staggerContainer(MOTION_STAGGER.normal, 0.1)}

          initial="hidden"

          whileInView="show"

          viewport={VIEWPORT_CARD}

          className="landing-after-header landing-grid landing-grid--loose sm:grid-cols-2"

        >

          {TRUST_KEYS.map((key) => {

            const Icon = ICONS[key] ?? FiShield;

            return (

              <LandingFeatureCard

                key={key}

                layout="horizontal"

                icon={Icon}

                title={t(`trust.list.${key}.title`)}

                description={t(`trust.list.${key}.desc`)}

                variants={staggerItem(18)}

              />

            );

          })}

        </motion.div>

      </LandingSectionContent>

    </LandingSection>

  );

}


