import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import {
  JOURNEY_SCROLL_DELAY_MS,
  buildJourneyPlan,
  saveAcademicProfile,
} from '../../features/internshipJourney/index.js';
import batmanTechnologyLogo from '../../assets/images/batman-technology-logo.webp';
import { AnimatedBrandIntro } from '../../components/internshipJourney/AnimatedBrandIntro.jsx';
import { JourneyHeader, JourneyHero } from '../../components/internshipJourney/JourneyHero.jsx';
import { JourneyConfigurator } from '../../components/internshipJourney/JourneyConfigurator.jsx';
import { TrackPreview } from '../../components/internshipJourney/TrackPreview.jsx';
import { JourneyRoadmap } from '../../components/internshipJourney/JourneyRoadmap.jsx';
import { PracticalMissions } from '../../components/internshipJourney/PracticalMissions.jsx';
import { CareerTrackInfo, EvaluationExplainer } from '../../components/internshipJourney/EvaluationExplainer.jsx';
import { EnrollmentSteps } from '../../components/internshipJourney/EnrollmentSteps.jsx';
import { StageDetailsModal } from '../../components/internshipJourney/StageDetailsModal.jsx';
import { JourneyConfetti } from '../../components/internshipJourney/JourneyConfetti.jsx';
import '../../components/internshipJourney/internship-journey.css';

const PAGE_TITLE = 'eprojecto | رحلة التدريب الميداني';
const PAGE_DESCRIPTION =
  'حدد جامعتك وكليتك وتخصصك وساعات التدريب المطلوبة، واحصل على مسار تدريب ميداني مخصص قبل الالتحاق عبر eprojecto.';
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
  useMetaContent('theme-color', '#fcfaf5');
  useJourneyFonts();
  useScrollToEntryPoint();
  useSmoothAnchorScrolling();

  const [plan, setPlan] = useState(null);
  const [openStage, setOpenStage] = useState(null);
  const journeyRef = useRef(null);
  const enrollRef = useRef(null);
  const buildCountRef = useRef(0);
  const scrollTimerRef = useRef(null);

  useEffect(() => () => window.clearTimeout(scrollTimerRef.current), []);

  const handleBuild = useCallback((selection) => {
    buildCountRef.current += 1;
    const next = { ...buildJourneyPlan(selection), id: buildCountRef.current };
    setPlan(next);
    saveAcademicProfile({
      universityId: next.universityId,
      universityName: next.universityName,
      isOtherUniversity: next.isOtherUniversity,
      facultyCode: next.facultyCode,
      facultyName: next.facultyName,
      isOtherFaculty: next.isOtherFaculty,
      majorCode: next.majorCode,
      majorLabelAr: next.majorLabelAr,
      trainingHours: next.trainingHours,
      trackCode: next.trackCode,
      trackNameAr: next.trackNameAr,
      trackNameEn: next.trackNameEn,
    });
    window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      journeyRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    }, JOURNEY_SCROLL_DELAY_MS);
  }, []);

  const handleEnroll = useCallback(() => {
    enrollRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    });
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
          <JourneyHero logoSrc={batmanTechnologyLogo} />
          <JourneyConfigurator onBuild={handleBuild} />

          {plan ? (
            <div ref={journeyRef} className="ij-journey" id="journey">
              <TrackPreview plan={plan} onEnroll={handleEnroll} />
              <JourneyRoadmap plan={plan} onOpenStage={handleOpenStage} />
              <PracticalMissions plan={plan} />
            </div>
          ) : null}

          <CareerTrackInfo />
          <EvaluationExplainer />
          <div ref={enrollRef}>
            <EnrollmentSteps profile={plan} />
          </div>

          <div className="ij-footbox">
            <div>
              <h3>مسار واضح… وخطوات التحاق عملية</h3>
              <p>
                خطة استرشادية قابلة للتكييف مع كتاب الجامعة واحتياجات الشركة؛ ليست شهادة أو تعهداً بالتوظيف.
              </p>
            </div>
            <button type="button" className="ij-btn ij-btn--secondary" onClick={() => window.print()}>
              اطبع / احفظ الخطة PDF
            </button>
          </div>
        </main>
        <footer className="ij-footer">
          eprojecto • BATMAN TECHNOLOGY • AMMAN, JORDAN &nbsp; ✦ &nbsp; FIELD TRAINING JOURNEY
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
