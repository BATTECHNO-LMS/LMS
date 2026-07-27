import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BookOpen, X } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import {
  completeFieldTrainingOnboarding,
  dismissFieldTrainingOnboarding,
  fetchFieldTrainingOnboarding,
  progressFieldTrainingOnboarding,
  startFieldTrainingOnboarding,
} from '../../features/help/index.js';
import { FIELD_TRAINING_TOUR_STEPS, findTourTarget } from '../../features/help/tourSteps.js';
import { getApiErrorMessage } from '../../services/apiHelpers.js';

const ONBOARDING_KEY = ['student', 'onboarding', 'field-training'];

export function FieldTrainingTourHost({ forceOpen = false, onCloseForce } = {}) {
  const { t } = useTranslation('userGuide');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [phase, setPhase] = useState('idle'); // idle | welcome | tour | done
  const [stepIndex, setStepIndex] = useState(0);
  const [highlight, setHighlight] = useState(null);
  const [error, setError] = useState('');

  const { data: onboarding } = useQuery({
    queryKey: ONBOARDING_KEY,
    queryFn: fetchFieldTrainingOnboarding,
    staleTime: 60_000,
    retry: 1,
  });

  const shouldAutoOpen = Boolean(onboarding?.should_show);
  const updateAvailable = Boolean(onboarding?.update_available);

  useEffect(() => {
    if (forceOpen) {
      setPhase('welcome');
      setStepIndex(0);
      return;
    }
    if (shouldAutoOpen && phase === 'idle') {
      setPhase('welcome');
    }
  }, [forceOpen, shouldAutoOpen, phase]);

  const startMut = useMutation({
    mutationFn: startFieldTrainingOnboarding,
    onSuccess: () => {
      qc.setQueryData(ONBOARDING_KEY, (prev) => ({ ...(prev || {}), status: 'in_progress' }));
      setPhase('tour');
      setStepIndex(0);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const progressMut = useMutation({
    mutationFn: (last_step) => progressFieldTrainingOnboarding({ last_step }),
  });

  const completeMut = useMutation({
    mutationFn: completeFieldTrainingOnboarding,
    onSuccess: (data) => {
      qc.setQueryData(ONBOARDING_KEY, data);
      setPhase('done');
      setHighlight(null);
    },
  });

  const dismissMut = useMutation({
    mutationFn: dismissFieldTrainingOnboarding,
    onSuccess: (data) => {
      qc.setQueryData(ONBOARDING_KEY, data);
      setPhase('idle');
      setHighlight(null);
      onCloseForce?.();
    },
  });

  const step = FIELD_TRAINING_TOUR_STEPS[stepIndex];
  const total = FIELD_TRAINING_TOUR_STEPS.length;

  const updateHighlight = useCallback(() => {
    if (phase !== 'tour' || !step) {
      setHighlight(null);
      return;
    }
    const el = findTourTarget(step.tourId);
    if (!el) {
      setHighlight(null);
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[tour] missing target', step.tourId);
      }
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
    if (stepIndex >= total - 1) {
      completeMut.mutate();
      return;
    }
    const next = stepIndex + 1;
    setStepIndex(next);
    progressMut.mutate(next + 1);
  };

  const goPrev = () => {
    if (stepIndex <= 0) {
      setPhase('welcome');
      return;
    }
    const prev = stepIndex - 1;
    setStepIndex(prev);
    progressMut.mutate(prev + 1);
  };

  const open = phase === 'welcome' || phase === 'tour' || phase === 'done';
  if (!open) return null;

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
                : t(step.titleKey)}
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
          {phase === 'tour' ? <p>{t(step.bodyKey)}</p> : null}
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
              <Button type="button" variant="outline" onClick={() => navigate('/student/user-guide')}>
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
              {step.actionTo ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(step.actionTo)}
                >
                  {t(step.actionLabelKey || 'tour.openGuide')}
                </Button>
              ) : null}
              <Button type="button" variant="primary" disabled={busy} onClick={goNext}>
                {stepIndex >= total - 1 ? t('tour.finish') : t('tour.next')}
              </Button>
            </>
          ) : null}

          {phase === 'done' ? (
            <>
              <Button type="button" variant="outline" onClick={() => navigate('/student/field-training')}>
                {t('tour.goOpportunities')}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/student/user-guide')}>
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
