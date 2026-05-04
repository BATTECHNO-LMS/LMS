import { useTranslation } from 'react-i18next';
import { useLocale } from '../features/locale/index.js';
import { HomeHeader } from '../components/landing/HomeHeader.jsx';
import { HomeHero } from '../components/landing/HomeHero.jsx';
import { PartnersSection } from '../components/landing/PartnersSection.jsx';
import { FeaturesSection } from '../components/landing/FeaturesSection.jsx';
import { CTASection } from '../components/landing/CTASection.jsx';
import { HomeFooter } from '../components/landing/HomeFooter.jsx';

export function Home() {
  const { t, i18n } = useTranslation('landing');
  const { dir } = useLocale();

  return (
    <div id="battechno-landing" dir={dir} lang={i18n.language}>
      <div className="min-h-screen overflow-x-hidden bg-bat-bg text-bat-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-bat-accent focus:px-3 focus:py-2 focus:text-bat-primary"
        >
          {t('a11y.skipToMain')}
        </a>

        <div id="main" tabIndex={-1}>
          <HomeHeader />
          <HomeHero />
          <PartnersSection />
          <FeaturesSection />
          <CTASection />
          <HomeFooter />
        </div>
      </div>
    </div>
  );
}
