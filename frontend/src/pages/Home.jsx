import { useTranslation } from 'react-i18next';
import { useLocale } from '../features/locale/index.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { MOBILE_BREAKPOINT } from '../components/landing/home.constants.js';
import { HomeHeader } from '../components/landing/HomeHeader.jsx';
import { HomeHero } from '../components/landing/HomeHero.jsx';
import { HomeFooter } from '../components/landing/HomeFooter.jsx';
import { HomeMobile } from '../components/landing/HomeMobile.jsx';
import { HomeCapabilities } from '../components/landing/HomeCapabilities.jsx';
import { HomePartners } from '../components/landing/HomePartners.jsx';
import { HomeAboutBand } from '../components/landing/HomeAboutBand.jsx';
import { HomeAppShowcase } from '../components/landing/HomeAppShowcase.jsx';
import { HomeCtaBand } from '../components/landing/HomeCtaBand.jsx';

export function Home() {
  const { t, i18n } = useTranslation('landing');
  const { dir } = useLocale();
  const isNarrow = useMediaQuery(MOBILE_BREAKPOINT);

  return (
    <div id="battechno-landing" dir={dir} lang={i18n.language}>
      <div className="min-h-screen overflow-x-hidden bg-[#FAFAF7] text-slate-900">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-amber-500 focus:px-3 focus:py-2 focus:text-slate-950"
        >
          {t('a11y.skipToMain')}
        </a>

        <div id="main" tabIndex={-1}>
          {isNarrow ? (
            <>
              <HomeMobile />
              <HomeFooter />
            </>
          ) : (
            <>
              <HomeHeader />
              <HomeHero />
              <HomeAboutBand />
              <HomeCapabilities />
              <HomePartners />
              <HomeAppShowcase />
              <HomeCtaBand />
              <HomeFooter />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
