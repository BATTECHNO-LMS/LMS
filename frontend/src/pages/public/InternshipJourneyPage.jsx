import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  JOURNEY_SCROLL_DELAY_MS,
  buildJourneyPlan,
} from '../../features/internshipJourney/index.js';
import batmanTechnologyLogo from '../../assets/images/batman-technology-logo.webp';
import { AnimatedBrandIntro } from '../../components/internshipJourney/AnimatedBrandIntro.jsx';
import { JourneyHeader, JourneyHero } from '../../components/internshipJourney/JourneyHero.jsx';
import { JourneyConfigurator } from '../../components/internshipJourney/JourneyConfigurator.jsx';
import { JourneyRoadmap } from '../../components/internshipJourney/JourneyRoadmap.jsx';
import { PracticalMissions } from '../../components/internshipJourney/PracticalMissions.jsx';
import { CareerTrackInfo, EvaluationExplainer } from '../../components/internshipJourney/EvaluationExplainer.jsx';
import { EnrollmentSteps } from '../../components/internshipJourney/EnrollmentSteps.jsx';
import { StageDetailsModal } from '../../components/internshipJourney/StageDetailsModal.jsx';
import { JourneyConfetti } from '../../components/internshipJourney/JourneyConfetti.jsx';
import '../../components/internshipJourney/internship-journey.css';

const PAGE_TITLE = 'BATMAN TECHNOLOGY | رحلة التدريب الميداني';
const PAGE_DESCRIPTION =
  'خطة التدريب الميداني من BATMAN TECHNOLOGY: اختر جامعتك وساعات تدريبك وتخصصك لتحصل على خريطة تدريب مهنية، وآلية تقييم EPROJECTO وخطوات الالتحاق.';
const FONT_STYLESHEET_ID = 'ij-fonts';
const FONT_STYLESHEET_URL =
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&display=swap';

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function useMetaContent(name, content) {
  useEffect(() => {
    let meta = document.head.querySelector(`meta[name="${name}"]`);
    const created = !meta;
    if (created) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      document.head.appendChild(meta);
    }
    const previous = meta.getAttribute('content');
    meta.setAttribute('content', content);
    return () => {
      if (created) meta.remove();
      else if (previous !== null) meta.setAttribute('content', previous);
    };
  }, [name, content]);
}

function useJourneyFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_STYLESHEET_ID)) return;
    const link = document.createElement('link');
    link.id = FONT_STYLESHEET_ID;
    link.rel = 'stylesheet';
    link.href = FONT_STYLESHEET_URL;
    document.head.appendChild(link);
  }, []);
}

/** React Router keeps the previous page's scroll offset, and the lazy chunk renders after the browser's own hash jump. */
function useScrollToEntryPoint() {
  useLayoutEffect(() => {
    const targetId = decodeURIComponent(window.location.hash.slice(1));
    const target = targetId ? document.getElementById(targetId) : null;
    if (target) target.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
  }, []);
}

function useSmoothAnchorScrolling() {
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'smooth';
    return () => {
      root.style.scrollBehavior = previous;
    };
  }, []);
}

export function InternshipJourneyPage() {
  useDocumentTitle(PAGE_TITLE);
  useMetaContent('description', PAGE_DESCRIPTION);
  useMetaContent('theme-color', '#f8f7ff');
  useJourneyFonts();
  useScrollToEntryPoint();
  useSmoothAnchorScrolling();

  const [plan, setPlan] = useState(null);
  const [openStage, setOpenStage] = useState(null);
  const journeyRef = useRef(null);
  const buildCountRef = useRef(0);
  const scrollTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(scrollTimerRef.current), []);

  const handleBuild = useCallback((selection) => {
    buildCountRef.current += 1;
    setPlan({ ...buildJourneyPlan(selection), id: buildCountRef.current });
    window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      journeyRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    }, JOURNEY_SCROLL_DELAY_MS);
  }, []);

  const handleOpenStage = useCallback((stage, trigger) => {
    setOpenStage({ stage, trigger });
  }, []);

  const handleCloseStage = useCallback(() => setOpenStage(null), []);

  return (
    <div className="ij-root" dir="rtl" lang="ar">
      <AnimatedBrandIntro logoSrc={batmanTechnologyLogo} />
      <JourneyConfetti burstKey={plan?.id ?? 0} />

      <div className="ij-wrap">
        <JourneyHeader logoSrc={batmanTechnologyLogo} />
        <main>
          <JourneyHero />
          <JourneyConfigurator onBuild={handleBuild} />

          {plan ? (
            <div ref={journeyRef} className="ij-journey" id="journey">
              <JourneyRoadmap plan={plan} onOpenStage={handleOpenStage} />
              <PracticalMissions plan={plan} />
            </div>
          ) : null}

          <CareerTrackInfo />
          <EvaluationExplainer />
          <EnrollmentSteps />

          <div className="ij-footbox">
            <div>
              <h3>🚀 كل مهمة تقرّبك أكثر من سوق العمل!</h3>
              <p>خطة استرشادية قابلة للتكييف مع كتاب الجامعة واحتياجات الشركة؛ ليست شهادة أو تعهداً بالتوظيف.</p>
            </div>
            <button type="button" className="ij-btn ij-btn--secondary" onClick={() => window.print()}>
              🖨️ اطبع / احفظ الخطة PDF
            </button>
          </div>
        </main>
        <footer className="ij-footer">
          BATMAN TECHNOLOGY • AMMAN, JORDAN &nbsp; ✦ &nbsp; FIELD TRAINING JOURNEY • EPROJECTO INSPIRED
        </footer>
      </div>

      {openStage ? (
        <StageDetailsModal
          stage={openStage.stage}
          returnFocusTo={openStage.trigger}
          onClose={handleCloseStage}
        />
      ) : null}
    </div>
  );
}
