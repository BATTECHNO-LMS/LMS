import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { LIFECYCLE_STEP_KEYS } from './home.constants.js';
import { LandingSection, LandingSectionContent } from './LandingSection.jsx';
import { SectionDecoration } from './decorations/index.js';
import {
  useLandingMotion,
  LandingSectionHeader,
  MOTION_DURATION,
  MOTION_STAGGER,
  VIEWPORT_CARD,
} from './motion/index.js';

export function LifecycleSection() {
  const { t } = useTranslation('landing');
  const { reduced, transition, staggerContainer, staggerItem, cardHover } = useLandingMotion();

  return (
    <LandingSection variant="journey" id="journey">
      <SectionDecoration section="journey" />

      <div className="landing-journey-path" aria-hidden>
        <svg className="h-full w-full" viewBox="0 0 800 120" preserveAspectRatio="none" fill="none">
          <path
            d="M20 60 Q200 10 400 60 T780 55"
            stroke="rgba(19, 45, 74, 0.08)"
            strokeWidth="2"
            strokeDasharray="10 14"
          />
          <path
            d="M20 78 Q220 108 420 68 T780 82"
            stroke="rgba(168, 134, 28, 0.07)"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <LandingSectionContent>
        <LandingSectionHeader
          eyebrow={t('lifecycle.eyebrow')}
          title={t('lifecycle.title')}
          subtitle={t('lifecycle.subtitle')}
          wide
        />

        <ol className="landing-after-header relative">
          <motion.div
            className="pointer-events-none absolute start-6 end-6 top-7 hidden h-0.5 origin-left bg-gradient-to-r from-bat-accent/20 via-bat-accent to-bat-accent/20 lg:block"
            initial={reduced ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={transition(MOTION_DURATION.slow, 0.15)}
            aria-hidden
          />

          <motion.div
            variants={staggerContainer(MOTION_STAGGER.normal, 0.08)}
            initial="hidden"
            whileInView="show"
            viewport={VIEWPORT_CARD}
            className="landing-grid gap-0 lg:grid-cols-7 lg:gap-2"
          >
            {LIFECYCLE_STEP_KEYS.map((key, i) => (
              <motion.li
                key={key}
                variants={staggerItem(18)}
                className="relative flex gap-4 pb-5 last:pb-0 lg:flex-col lg:items-center lg:gap-2 lg:pb-0 lg:text-center"
              >
                {i < LIFECYCLE_STEP_KEYS.length - 1 ? (
                  <motion.span
                    className="absolute start-[1.25rem] top-11 bottom-0 w-px origin-top bg-bat-border lg:hidden"
                    initial={reduced ? false : { scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={transition(MOTION_DURATION.medium, i * 0.06)}
                    aria-hidden
                  />
                ) : null}

                <motion.div
                  whileHover={cardHover}
                  transition={transition(MOTION_DURATION.fast)}
                  className="flex w-full gap-4 rounded-xl border border-bat-border/50 bg-bat-surface/80 p-3 shadow-sm lg:flex-col lg:items-center lg:gap-2 lg:border-transparent lg:bg-transparent lg:p-2 lg:shadow-none"
                >
                  <motion.span
                    initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={transition(MOTION_DURATION.fast, i * 0.05)}
                    className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-bat-accent bg-bat-surface text-sm font-bold text-bat-primary shadow-sm lg:mx-auto"
                    aria-hidden
                  >
                    {i + 1}
                  </motion.span>

                  <div className="min-w-0 flex-1 lg:flex-none">
                    <p className="text-sm font-bold leading-snug text-bat-ink sm:text-base">
                      {t(`lifecycle.steps.${key}`)}
                    </p>
                  </div>
                </motion.div>
              </motion.li>
            ))}
          </motion.div>
        </ol>
      </LandingSectionContent>
    </LandingSection>
  );
}
