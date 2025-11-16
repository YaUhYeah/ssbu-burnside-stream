import { useEffect, useState } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { useUIStore, ONBOARDING_STEPS } from '@/stores/uiStore';
import { motion, AnimatePresence } from 'framer-motion';

export function OnboardingOverlay() {
  const {
    showOnboarding,
    onboardingStep,
    nextOnboardingStep,
    previousOnboardingStep,
    completeOnboarding,
  } = useUIStore();

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = ONBOARDING_STEPS[onboardingStep];

  useEffect(() => {
    if (!showOnboarding || !currentStep) return;

    const target = document.querySelector(currentStep.target);
    if (target) {
      const rect = target.getBoundingClientRect();
      setTargetRect(rect);

      // Scroll target into view
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setTargetRect(null);
    }
  }, [showOnboarding, currentStep, onboardingStep]);

  if (!showOnboarding || !currentStep) return null;

  const getTooltipPosition = () => {
    if (!targetRect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    }

    const padding = 20;
    const tooltipWidth = 320;
    const tooltipHeight = 200;

    switch (currentStep.position) {
      case 'top':
        return {
          top: targetRect.top - tooltipHeight - padding,
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        };
      case 'bottom':
        return {
          top: targetRect.bottom + padding,
          left: targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        };
      case 'left':
        return {
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          left: targetRect.left - tooltipWidth - padding,
        };
      case 'right':
        return {
          top: targetRect.top + targetRect.height / 2 - tooltipHeight / 2,
          left: targetRect.right + padding,
        };
      default:
        return { top: '50%', left: '50%' };
    }
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop with cutout */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Highlight box around target */}
      {targetRect && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute rounded-lg border-2 border-primary shadow-lg shadow-primary/20"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
          }}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={onboardingStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute w-80 rounded-lg bg-card p-4 shadow-xl"
          style={getTooltipPosition()}
        >
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Step {onboardingStep + 1} of {ONBOARDING_STEPS.length}
              </p>
              <h3 className="text-lg font-semibold">{currentStep.title}</h3>
            </div>
            <button
              onClick={completeOnboarding}
              className="rounded-md p-1 hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            {currentStep.description}
          </p>

          <div className="flex items-center justify-between">
            <button
              onClick={completeOnboarding}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Skip tour
            </button>

            <div className="flex gap-2">
              {onboardingStep > 0 && (
                <button
                  onClick={previousOnboardingStep}
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm hover:bg-accent"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </button>
              )}
              <button
                onClick={nextOnboardingStep}
                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {onboardingStep === ONBOARDING_STEPS.length - 1 ? (
                  'Finish'
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-3 w-3" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Progress dots */}
          <div className="mt-4 flex justify-center gap-1">
            {ONBOARDING_STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 w-1.5 rounded-full ${
                  idx === onboardingStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
