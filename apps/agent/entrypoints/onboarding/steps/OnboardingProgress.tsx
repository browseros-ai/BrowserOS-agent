import { Check } from 'lucide-react'
import { onboardingProgressSteps } from '@/lib/onboarding/onboardingFlow'

export const OnboardingProgress = ({
  currentStep,
}: {
  currentStep: 1 | 2 | 3
}) => {
  return (
    <div className="border-border/40 border-b">
      <div className="mx-auto max-w-3xl px-6 py-5">
        <div className="relative flex items-center justify-between">
          {onboardingProgressSteps.map((step) => {
            const isCompleted = step.id < currentStep
            const isActive = step.id === currentStep

            return (
              <div
                key={step.id}
                className="relative flex flex-1 items-center justify-center"
              >
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <div className="relative">
                    {isActive && (
                      <div className="absolute inset-0 animate-ping rounded-full bg-[var(--accent-orange)] opacity-30" />
                    )}
                    <div
                      className={`relative flex h-8 w-8 items-center justify-center rounded-full font-semibold text-sm transition-all duration-500 ${
                        isCompleted
                          ? 'bg-[var(--accent-orange)] text-white'
                          : isActive
                            ? 'bg-[var(--accent-orange)] text-white ring-4 ring-[var(--accent-orange)]/20'
                            : 'border border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                    </div>
                  </div>
                  <div className="hidden text-center md:block">
                    <div
                      className={`font-medium text-xs transition-colors duration-300 ${
                        isCompleted || isActive
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {step.name}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
