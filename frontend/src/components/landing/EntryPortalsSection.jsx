import { useLocale } from '../../features/locale/index.js';
import { PortalSelection } from '../portal/PortalSelection.jsx';
import { LandingSection, LandingSectionContent } from './LandingSection.jsx';

/**
 * Public home section: university vs institution portal entry.
 */
export function EntryPortalsSection() {
  const { isArabic } = useLocale();

  return (
    <LandingSection variant="portals" id="portal-entry" compact>
      <LandingSectionContent>
        <PortalSelection
          variant="section"
          id="portal-entry-block"
          isArabic={isArabic}
          showLogo={false}
          showHomeLink={false}
          showDashboardCta
        />
      </LandingSectionContent>
    </LandingSection>
  );
}
