import portalsIllustration from '../../../assets/landing/illustrations/portals-illustration.svg';
import journeyFlow from '../../../assets/landing/illustrations/journey-flow.svg';
import featuresDashboard from '../../../assets/landing/illustrations/features-dashboard.svg';
import trustVerification from '../../../assets/landing/illustrations/trust-verification.svg';
import ctaAcademic from '../../../assets/landing/illustrations/cta-academic-illustration.svg';

/** @typedef {'portals' | 'journey' | 'features' | 'trust' | 'cta'} LandingDecoSection */

/**
 * @typedef {Object} LandingIllustration
 * @property {string} id
 * @property {string} src
 * @property {LandingDecoSection} section
 * @property {'start' | 'end' | 'center'} align
 * @property {'sm' | 'md' | 'lg'} size
 * @property {number} [opacity]
 */

/** @type {ReadonlyArray<LandingIllustration>} */
export const LANDING_ILLUSTRATIONS = [
  {
    id: 'portals',
    src: portalsIllustration,
    section: 'portals',
    align: 'end',
    size: 'md',
    opacity: 0.55,
  },
  {
    id: 'journey',
    src: journeyFlow,
    section: 'journey',
    align: 'start',
    size: 'sm',
    opacity: 0.5,
  },
  {
    id: 'features',
    src: featuresDashboard,
    section: 'features',
    align: 'end',
    size: 'md',
    opacity: 0.48,
  },
  {
    id: 'trust',
    src: trustVerification,
    section: 'trust',
    align: 'start',
    size: 'sm',
    opacity: 0.52,
  },
  {
    id: 'cta',
    src: ctaAcademic,
    section: 'cta',
    align: 'end',
    size: 'sm',
    opacity: 0.45,
  },
];

/** @param {LandingDecoSection} section */
export function illustrationsForSection(section) {
  return LANDING_ILLUSTRATIONS.filter((item) => item.section === section);
}
