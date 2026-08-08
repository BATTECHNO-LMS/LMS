import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BookOpen, X } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { useAuth } from '../../features/auth/index.js';
import {
  completeFieldTrainingOnboarding,
  completeOnboardingByKey,
  dismissFieldTrainingOnboarding,
  dismissOnboardingByKey,
  fetchActiveOnboarding,
  fetchFieldTrainingOnboarding,
  progressFieldTrainingOnboarding,
  progressOnboardingByKey,
  startFieldTrainingOnboarding,
  startOnboardingByKey,
} from '../../features/help/index.js';
import {
  FIELD_TRAINING_STUDENT_GUIDE_KEY,
  FIELD_TRAINING_TOUR_STEPS,
  findTourTarget,
  guideKeyForRole,
  mapApiTourSteps,
  resolveVisibleStepIndex,
} from '../../features/help/tourSteps.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';
import { getUserGuideBasePath } from './userGuidePaths.js';

export function FieldTrainingTourHost({ forceOpen = false, onCloseForce } = {}) {
  const { t } = useTranslation('userGuide');
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [phase, setPhase] = useState('idle'); // idle | welcome | tour | done
  const [stepIndex, setStepIndex] = useState(0);
  const [highlight, setHighlight] = useState(null);
  const [error, setError] = useState('');

  const role = String(user?.role || '').toLowerCase();
  const guideKey = guideKeyForRole(role);
  const guideBase = getUserGuideBasePath(user);
  const isStudentFallback = role === 'student';

  const onboardingKey = useMemo(
    () => ['onboarding', guideKey || 'none', role],
    [guideKey, role]
  );

  const { data: onboarding } = useQuery({
    queryKey: onboardingKey,
    queryFn: async () => {
      if (!guideKey) return null;
      try {
        return await fetchActiveOnboarding({ guide_key: guideKey });
      } catch {
        try {
          return await fetchActiveOnboarding();
        } catch {
          if (isStudentFallback) return fetchFieldTrainingOnboarding();
          return null;
        }
      }
    },
    enabled: Boolean(guideKey),
    staleTime: 60_000,
    retry: 1,
  });

  const apiSteps = useMemo(() => mapApiTourSteps(onboarding?.steps), [onboarding?.steps]);
  const useApiSteps = apiSteps.length > 0;
  const steps = useApiSteps
    ? apiSteps
    : isStudentFallback
      ? FIELD_TRAINING_TOUR_STEPS
      : [];

  const shouldAutoOpen = Boolean(onboarding?.should_show) && steps.length > 0;
  const updateAvailable = Boolean(onboarding?.update_available);
  const activeGuideKey = onboarding?.guide_key || guideKey || FIELD_TRAINING_STUDENT_GUIDE_KEY;

  useEffect(() => {
    if (forceOpen && steps.length) {
      setPhase('welcome');
      setStepIndex(0);
      return;
    }
    if (shouldAutoOpen && phase === 'idle') {
      setPhase('welcome');
    }
  }, [forceOpen, shouldAutoOpen, phase, steps.length]);

  const invalidate = () => qc.invalidateQueries({ queryKey: onboardingKey });

  const startMut = useMutation({
    mutationFn: async () => {
      if (useApiSteps || !isStudentFallback) {
        return startOnboardingByKey(activeGuideKey);
      }
      return startFieldTrainingOnboarding();
    },
    onSuccess: () => {
      invalidate();
      const first = resolveVisibleStepIndex(steps, 0);
      setPhase('tour');
      setStepIndex(first >= 0 ? first : 0);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const progressMut = useMutation({
    mutationFn: (last_step) => {
      if (useApiSteps || !isStudentFallback) {
        return progressOnboardingByKey(activeGuideKey, { last_step });
      }
      return progressFieldTrainingOnboarding({ last_step });
    },
  });

  const completeMut = useMutation({
    mutationFn: () => {
      if (useApiSteps || !isStudentFallback) {
        return completeOnboardingByKey(activeGuideKey);
      }
      return completeFieldTrainingOnboarding();
    },
    onSuccess: () => {
      invalidate();
      setPhase('done');
      setHighlight(null);
    },
  });

  const dismissMut = useMutation({
    mutationFn: () => {
      if (useApiSteps || !isStudentFallback) {
        return dismissOnboardingByKey(activeGuideKey);
      }
      return dismissFieldTrainingOnboarding();
    },
    onSuccess: () => {
      invalidate();
      setPhase('idle');
      setHighlight(null);
      onCloseForce?.();
    },
  });

  const step = steps[stepIndex];
  const total = steps.length;

  const updateHighlight = useCallback(() => {
    if (phase !== 'tour' || !step) {
      setHighlight(null);
      return;
    }
    if (!step.tourId) {
      setHighlight(null);
      return;
    }
    const el = findTourTarget(step.tourId);
    if (!el) {
      setHighlight(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setHighlight({
      top: Math.max(8, rect.top + window.scrollY - 8),
      left: Math.max(8, rect.left + window.scrollX - 8),
      width: Math.min(window.innerWidth - 16, rect.width + 16),
      height: rect.height + 16,
    });
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }, [phase, step]);

  useEffect(() => {
    if (phase !== 'tour' || !steps.length) return;
    const visible = resolveVisibleStepIndex(steps, stepIndex);
    if (visible < 0) {
      if (phase === 'tour') completeMut.mutate();
      return;
    }
    if (visible !== stepIndex) {
      setStepIndex(visible);
    }
    // intentionally omit completeMut/progressMut from deps to avoid re-entry loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stepIndex, steps]);

  useEffect(() => {
    updateHighlight();
    window.addEventListener('resize', updateHighlight);
    return () => window.removeEventListener('resize', updateHighlight);
  }, [updateHighlight, stepIndex, phase]);

  const busy = startMut.isPending || completeMut.isPending || dismissMut.isPending;

  const closeAll = () => {
    setPhase('idle');
    setHighlight(null);
    onCloseForce?.();
  };

  const goNext = () => {
    const nextVisible = resolveVisibleStepIndex(steps, stepIndex + 1);
    if (nextVisible < 0) {
      completeMut.mutate();
      return;
    }
    setStepIndex(nextVisible);
    progressMut.mutate(nextVisible + 1);
  };

  const goPrev = () => {
    if (stepIndex <= 0) {
      setPhase('welcome');
      return;
    }
    let prev = stepIndex - 1;
    while (prev >= 0) {
      const s = steps[prev];
      if (!s?.tourId || findTourTarget(s.tourId)) break;
      prev -= 1;
    }
    if (prev < 0) {
      setPhase('welcome');
      return;
    }
    setStepIndex(prev);
    progressMut.mutate(prev + 1);
  };

  const open = phase === 'welcome' || phase === 'tour' || phase === 'done';
  if (!guideKey || !steps.length || !open) return null;

  const stepTitle = step?.fromApi ? step.title : step ? t(step.titleKey) : '';
  const stepBody = step?.fromApi ? step.body : step ? t(step.bodyKey) : '';

  return (
    <div className="ug-tour-root" role="presentation">
      <div className="ug-tour-backdrop" />
      {highlight ? (
        <div
          className="ug-tour-spotlight"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      ) : null}

      <div
        className="ug-tour-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ug-tour-title"
      >
        <header className="ug-tour-modal__header">
          <h2 id="ug-tour-title" className="ug-tour-modal__title">
            {phase === 'welcome'
              ? t('tour.welcomeTitle')
              : phase === 'done'
                ? t('tour.doneTitle')
                : stepTitle}
          </h2>
          <button
            type="button"
            className="ug-tour-modal__close"
            aria-label={t('tour.close')}
            onClick={() => (phase === 'done' ? closeAll() : dismissMut.mutate())}
            disabled={busy}
          >
            <X size={18} />
          </button>
        </header>

        <div className="ug-tour-modal__body">
          {updateAvailable && phase === 'welcome' ? (
            <p className="ug-tour-modal__update" role="status">
              {t('tour.updateAvailable')}
            </p>
          ) : null}

          {phase === 'welcome' ? <p>{t('tour.welcomeBody')}</p> : null}
          {phase === 'tour' ? <p>{stepBody}</p> : null}
          {phase === 'done' ? <p>{t('tour.doneBody')}</p> : null}

          {phase === 'tour' ? (
            <p className="ug-tour-modal__progress" aria-live="polite">
              {t('tour.progress', { current: stepIndex + 1, total })}
            </p>
          ) : null}

          {error ? <p className="form-field__error">{error}</p> : null}
        </div>

        <footer className="ug-tour-modal__footer">
          {phase === 'welcome' ? (
            <>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => dismissMut.mutate()}>
                {t('tour.skip')}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(guideBase)}>
                <BookOpen size={16} aria-hidden /> {t('tour.openGuide')}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={busy}
                onClick={() => startMut.mutate()}
              >
                {t('tour.start')}
              </Button>
            </>
          ) : null}

          {phase === 'tour' ? (
            <>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => dismissMut.mutate()}>
                {t('tour.skip')}
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={goPrev}>
                {t('tour.prev')}
              </Button>
              {step?.actionTo ? (
                <Button type="button" variant="outline" onClick={() => navigate(step.actionTo)}>
                  {step.fromApi
                    ? t('tour.openGuide')
                    : t(step.actionLabelKey || 'tour.openGuide')}
                </Button>
              ) : null}
              <Button type="button" variant="primary" disabled={busy} onClick={goNext}>
                {resolveVisibleStepIndex(steps, stepIndex + 1) < 0 ? t('tour.finish') : t('tour.next')}
              </Button>
            </>
          ) : null}

          {phase === 'done' ? (
            <>
              {isStudentFallback ? (
                <Button type="button" variant="outline" onClick={() => navigate('/student/field-training')}>
                  {t('tour.goOpportunities')}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => navigate(guideBase)}>
                {t('tour.openGuide')}
              </Button>
              <Button type="button" variant="primary" onClick={closeAll}>
                {t('tour.end')}
              </Button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

export function useOpenFieldTrainingTour() {
  const [open, setOpen] = useState(false);
  return {
    open,
    start: () => setOpen(true),
    stop: () => setOpen(false),
    host: open ? <FieldTrainingTourHost forceOpen onCloseForce={() => setOpen(false)} /> : null,
  };
}
