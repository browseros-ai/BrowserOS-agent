import { ArrowLeft } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useEffect, useState } from 'react'
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { ONBOARDING_STEP_VIEWED_EVENT } from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import {
  getOnboardingDemoPath,
  getOnboardingFeaturesPath,
  getOnboardingFlowSource,
  getOnboardingStepPath,
} from '@/lib/onboarding/onboardingFlow'
import { OnboardingProgress } from './OnboardingProgress'
import type { StepDirection } from './StepTransition'
import { steps } from './steps'

export const StepsLayout = () => {
  const { stepId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [direction, setDirection] = useState<StepDirection>(1)
  const source = getOnboardingFlowSource(searchParams)

  const currentStep = Number(stepId)
  const isLastStep = currentStep >= steps.length
  const canGoPrevious = currentStep > 1

  const stepEntry = steps.find((each) => each.id === currentStep)
  const ActiveStep = stepEntry?.component ?? (() => null)

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
      navigate(getOnboardingDemoPath(source))
    } else {
      navigate(getOnboardingStepPath((currentStep + 1) as 1 | 2, source))
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <OnboardingProgress currentStep={currentStep as 1 | 2} />
      <main className="flex flex-1 items-center justify-center overflow-y-auto overflow-x-hidden px-6">
        <div className="w-full max-w-4xl">
          <div className="relative h-[550px]">
            <AnimatePresence initial={false} custom={direction}>
              <ActiveStep
                key={currentStep}
                direction={direction}
                onContinue={onContinue}
              />
            </AnimatePresence>
          </div>
          <div className="pt-8">
            <Button variant="ghost" asChild className="group">
              <NavLink
                onClick={() => setDirection(-1)}
                to={
                  canGoPrevious
                    ? getOnboardingStepPath((currentStep - 1) as 1 | 2, source)
                    : getOnboardingFeaturesPath(source)
                }
              >
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                Back
              </NavLink>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
