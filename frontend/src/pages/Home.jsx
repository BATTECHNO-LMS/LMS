import { useTranslation } from 'react-i18next';
import { useLocale } from '../features/locale/index.js';
import { LandingStatsProvider } from '../features/landing/LandingStatsContext.jsx';
import { HeroFloatingNav } from '../components/landing/hero/HeroFloatingNav.jsx';
import { HomeHero } from '../components/landing/HomeHero.jsx';
import { EntryPortalsSection } from '../components/landing/EntryPortalsSection.jsx';
import { PortalsSection } from '../components/landing/PortalsSection.jsx';
import { LifecycleSection } from '../components/landing/LifecycleSection.jsx';
import { PartnersSection } from '../components/landing/PartnersSection.jsx';
import { FeaturesSection } from '../components/landing/FeaturesSection.jsx';
import { TrustSection } from '../components/landing/TrustSection.jsx';
import { CTASection } from '../components/landing/CTASection.jsx';
import { SectionTransition } from '../components/landing/SectionTransition.jsx';
import { HomeFooter } from '../components/landing/HomeFooter.jsx';

export function Home() {
  const { t, i18n } = useTranslation('landing');
  const { dir } = useLocale();

  return (
    <LandingStatsProvider>
      <div id="battechno-landing" dir={dir} lang={i18n.language}>
      <div className="min-h-screen bg-bat-bg text-bat-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-bat-accent focus:px-3 focus:py-2 focus:text-bat-primary"
        >
          {t('a11y.skipToMain')}
        </a>

        <HeroFloatingNav />

        <div id="main" tabIndex={-1} className="overflow-x-hidden">
          <HomeHero />
          <SectionTransition variant="from-hero" />
          <EntryPortalsSection />
          <SectionTransition />
          <PortalsSection />
          <SectionTransition />
          <LifecycleSection />
          <SectionTransition variant="to-warm" />
          <PartnersSection />
          <SectionTransition />
          <FeaturesSection />
          <SectionTransition />
          <TrustSection />
          <SectionTransition variant="to-warm" />
          <CTASection />
          <SectionTransition variant="to-surface" />
          <HomeFooter />
        </div>
      </div>
    </div>
    </LandingStatsProvider>
  );
}
