import { useTranslation } from 'react-i18next';

import { motion } from 'framer-motion';

import { FiLayout, FiCalendar, FiBookOpen, FiCheckSquare } from 'react-icons/fi';

import { PORTAL_KEYS } from './home.constants.js';

import { LandingSection, LandingSectionContent } from './LandingSection.jsx';
import { SectionDecoration } from './decorations/index.js';

import {

  useLandingMotion,

  LandingSectionHeader,

  MOTION_STAGGER,

  VIEWPORT_CARD,

} from './motion/index.js';



const ICONS = {

  admin: FiLayout,

  instructor: FiCalendar,

  student: FiBookOpen,

  reviewer: FiCheckSquare,

};



export function PortalsSection() {

  const { t } = useTranslation('landing');

  const { staggerContainer, staggerItem, cardHover, cardIconHover, transition } = useLandingMotion();



  return (

    <LandingSection variant="portals" id="portals" compact>

      <SectionDecoration section="portals" />

      <LandingSectionContent>

        <LandingSectionHeader

          eyebrow={t('portals.eyebrow')}

          title={t('portals.title')}

          subtitle={t('portals.subtitle')}

          wide

        />



        <motion.div

          variants={staggerContainer(MOTION_STAGGER.normal, 0.1)}

          initial="hidden"

          whileInView="show"

          viewport={VIEWPORT_CARD}

          className="landing-after-header landing-grid landing-grid--loose sm:grid-cols-2 xl:grid-cols-4"

        >

          {PORTAL_KEYS.map((key) => {

            const Icon = ICONS[key] ?? FiLayout;

            return (

              <motion.article

                key={key}

                variants={staggerItem(20)}

                whileHover={cardHover}

                transition={transition(0.45)}

                className="group flex h-full min-h-[11.5rem] flex-col rounded-2xl landing-premium-card p-6 shadow-[0_2px_24px_-12px_rgba(19,45,74,0.08)] transition-[box-shadow,border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-bat-accent/50 hover:shadow-[0_16px_44px_-18px_rgba(19,45,74,0.14)] focus-within:border-bat-accent/50 lg:p-7"

              >

                <motion.div

                  whileHover={cardIconHover}

                  className="landing-card-icon flex h-14 w-14 items-center justify-center rounded-xl border border-bat-border/90 text-bat-primary transition group-hover:border-bat-accent/60"

                >

                  <Icon className="text-2xl" aria-hidden />

                </motion.div>

                <h3 className="mt-4 text-xl font-bold leading-snug text-bat-ink">

                  {t(`portals.list.${key}.title`)}

                </h3>

                <p className="mt-2 flex-1 text-sm leading-relaxed text-bat-muted sm:text-[0.9375rem]">

                  {t(`portals.list.${key}.desc`)}

                </p>

              </motion.article>

            );

          })}

        </motion.div>

      </LandingSectionContent>

    </LandingSection>

  );

}


