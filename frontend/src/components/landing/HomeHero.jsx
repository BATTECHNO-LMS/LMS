import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useLocale } from '../../features/locale/index.js';
import { BrandLogo } from '../common/BrandLogo.jsx';
import { HeroBackground } from './motion/HeroBackground.jsx';
import { HeroIllustrationColumn } from './hero/HeroIllustrations.jsx';
import { HeroPhonePanel } from './hero/HeroPhonePanel.jsx';
import { LandingStats } from './LandingStats.jsx';
import {
  useLandingMotion,
  MOTION_DURATION,
  MOTION_Y,
  MOTION_STAGGER,
  LandingCtaButton,
} from './motion/index.js';

export function HomeHero() {
  const { t, i18n } = useTranslation('landing');
  const { dir } = useLocale();
  const { transition, fadeUp, staggerContainer, staggerItem, reduced } = useLandingMotion();
  const Chevron = dir === 'rtl' ? FiChevronLeft : FiChevronRight;

  return (
    <section className="landing-section landing-section--hero hero-showcase relative min-h-[min(100dvh,54rem)] overflow-hidden px-[var(--landing-container-pad)] pb-12 pt-5 sm:pb-14 sm:pt-6 lg:min-h-[min(100dvh,50rem)] lg:pb-16">
      <HeroBackground />
      <div className="hero-showcase__glow pointer-events-none absolute inset-0" aria-hidden />

      <div className="landing-section__content relative z-[1] mx-auto w-full max-w-[var(--landing-container-max)]">
        <div className="hero-showcase__layout relative mx-auto mt-4 w-full sm:mt-6 lg:mt-8">
          <HeroIllustrationColumn />

          <div className="hero-showcase__center">
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transition(MOTION_DURATION.slow)}
              className="flex flex-col items-center text-center"
            >
              <BrandLogo variant="hero" alt={t('brand')} align="center" />

              <motion.div
                variants={staggerContainer(MOTION_STAGGER.relaxed, 0.06)}
                initial="hidden"
                animate="show"
                className="mt-6 flex w-full flex-col items-center sm:mt-7"
              >
                <motion.span
                  variants={fadeUp(10)}
                  className="inline-flex items-center gap-2 rounded-full border border-bat-accent/45 bg-bat-accent-soft/60 px-4 py-1.5 text-xs font-semibold text-bat-primary"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-bat-accent" aria-hidden />
                  {t('hero.trustBadge')}
                </motion.span>

                <motion.h1
                  variants={fadeUp(MOTION_Y.md)}
                  className={`hero-showcase__title mt-5 max-w-[40rem] text-balance font-bold leading-[1.2] tracking-tight text-bat-ink ${i18n.language.startsWith('ar') ? 'font-bold' : ''}`}
                >
                  {t('hero.headline')}
                </motion.h1>

                <motion.p
                  variants={fadeUp(MOTION_Y.sm)}
                  className="mt-4 max-w-2xl text-base leading-relaxed text-bat-muted sm:text-lg"
                >
                  {t('hero.description')}
                </motion.p>

                <LandingStats variant="inline" />

                <motion.div
                  variants={staggerContainer(MOTION_STAGGER.tight, 0.22)}
                  className="mt-8 flex w-full flex-col items-center gap-3 sm:mt-9"
                >
                  <motion.div variants={staggerItem(10)} className="w-full max-w-xs sm:max-w-none sm:w-auto">
                    <LandingCtaButton to="/portals" variant="primary" showArrow rtl={dir === 'rtl'}>
                      {t('hero.ctaLogin')}
                    </LandingCtaButton>
                  </motion.div>
                  <motion.div variants={staggerItem(10)} className="w-full max-w-xs sm:max-w-none sm:w-auto">
                    <LandingCtaButton to="/register" variant="secondary">
                      {t('hero.ctaRegister')}
                    </LandingCtaButton>
                  </motion.div>
                  <motion.div variants={staggerItem(8)}>
                    <a
                      href="#portals"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-bat-primary transition hover:text-bat-primary-hover"
                    >
                      {t('hero.ctaExplore')}
                      <Chevron size={16} aria-hidden />
                    </a>
                  </motion.div>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>

          <HeroPhonePanel />
        </div>
      </div>
    </section>
  );
}
