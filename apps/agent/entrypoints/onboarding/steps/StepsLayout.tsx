import { ArrowLeft, Check, Sparkles } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { ONBOARDING_STEP_VIEWED_EVENT } from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { FocusGrid } from '../index/FocusGrid'
import { OnboardingHeader } from '../index/OnboardingHeader'
import type { StepDirection } from './StepTransition'
import { steps } from './steps'

const launchBullets = [
  'LinkedIn-aware first chat',
  'SOUL.md personalization',
  'Skills and BYO model setup',
  'Daily task suggestions',
]

export const StepsLayout = () => {
  const { stepId } = useParams()
  const navigate = useNavigate()
  const [direction, setDirection] = useState<StepDirection>(1)
  const [mounted, setMounted] = useState(false)

  const currentStep = Number(stepId)
  const isLastStep = currentStep >= steps.length
  const canGoPrevious = currentStep > 1

  const stepEntry = steps.find((each) => each.id === currentStep)
  const ActiveStep = stepEntry?.component ?? (() => null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: track on step navigation only, stepEntry is derived from currentStep
  useEffect(() => {
    if (stepEntry) {
      track(ONBOARDING_STEP_VIEWED_EVENT, {
        step: stepEntry.id,
        step_name: stepEntry.name,
      })
    }
  }, [currentStep])

  const onContinue = () => {
    setDirection(1)
    if (isLastStep) {
      navigate('/home')
      return
    }
    navigate(`/onboarding/steps/${currentStep + 1}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <OnboardingHeader isMounted={mounted} />

      <main className="relative overflow-hidden px-6 py-8 sm:px-8 lg:px-10">
        <FocusGrid />

        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="relative">
              <div className="space-y-6 lg:sticky lg:top-8">
                <div className="rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-[0_24px_80px_-48px_rgba(207,111,44,0.4)] backdrop-blur">
                  <p className="mb-4 font-medium text-muted-foreground text-sm">
                    Step {currentStep} of {steps.length}
                  </p>
                  <div className="space-y-3">
                    {steps.map((step) => {
                      const isCompleted = step.id < currentStep
                      const isActive = step.id === currentStep

                      return (
                        <div
                          key={step.id}
                          className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
                            isActive
                              ? 'border-[var(--accent-orange)]/40 bg-[var(--accent-orange)]/8'
                              : 'border-border/60 bg-background/60'
                          }`}
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-semibold text-sm ${
                              isCompleted
                                ? 'bg-[var(--accent-orange)] text-white'
                                : isActive
                                  ? 'bg-[var(--accent-orange)] text-white shadow-[0_0_0_6px_rgba(207,111,44,0.12)]'
                                  : 'border border-border bg-background text-muted-foreground'
                            }`}
                          >
                            {isCompleted ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              step.id
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{step.name}</p>
                            <p className="text-muted-foreground text-xs">
                              {step.id === 1 && 'Context and names'}
                              {step.id === 2 && 'Chrome import'}
                              {step.id === 3 && 'Google apps'}
                              {step.id === 4 && 'Power features'}
                              {step.id === 5 && 'Seed first chat'}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="rounded-[28px] border border-border/70 bg-card/90 p-6 backdrop-blur">
                  <div className="mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[var(--accent-orange)]" />
                    <h3 className="font-medium text-sm">What unlocks next</h3>
                  </div>
                  <div className="space-y-3">
                    {launchBullets.map((bullet) => (
                      <div
                        key={bullet}
                        className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-muted-foreground text-sm"
                      >
                        {bullet}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            <section className="space-y-6">
              <div className="relative min-h-[620px]">
                <AnimatePresence initial={false} custom={direction}>
                  <ActiveStep
                    key={currentStep}
                    direction={direction}
                    onContinue={onContinue}
                  />
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-between gap-4">
                <Button variant="ghost" asChild className="group w-fit">
                  <NavLink
                    onClick={() => setDirection(-1)}
                    to={
                      canGoPrevious
                        ? `/onboarding/steps/${currentStep - 1}`
                        : '/onboarding'
                    }
                  >
                    <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                    Back
                  </NavLink>
                </Button>

                <p className="text-right text-muted-foreground text-sm">
                  BrowserOS is setting up a first-run experience that starts on
                  the main home page, not in a dead-end demo.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
