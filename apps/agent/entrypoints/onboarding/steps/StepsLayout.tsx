import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { NavLink, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import type { StepDirection } from './StepTransition'
import { steps } from './steps'

/**
 * @public
 */
export const StepsLayout = () => {
  const { stepId } = useParams()

  const [direction, setDirection] = useState<StepDirection>(1)

  const currentStep = Number(stepId)

  const canGoPrevious = currentStep > 1

  const canGoNext = currentStep < steps.length

  const ActiveStep =
    steps.find((each) => each.id === currentStep)?.component ?? (() => null)

  const onClickNext = () => setDirection(1)

  const onClickPrevious = () => setDirection(-1)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Progress Indicator */}
      <div className="border-border/40 border-b">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <div className="relative flex items-center justify-between">
            {steps.map((step) => {
              const isCompleted = step.id < currentStep
              const isActive = step.id === currentStep

              return (
                <div
                  key={step.id}
                  className="relative flex flex-1 items-center justify-center"
                >
                  {/* Animated progress line */}
                  <motion.div
                    className="absolute top-3.5 left-[50%] h-1 bg-accent-orange"
                    initial={false}
                    animate={{ width: isCompleted ? '100%' : 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 30,
                    }}
                  />
                  <div className="relative z-10 flex flex-col items-center gap-2">
                    <div className="relative">
                      {/* Animated pulsing ring for active step */}
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

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center overflow-y-auto overflow-x-hidden px-6">
        <div className="w-full max-w-4xl">
          <div className="relative h-[550px]">
            <AnimatePresence initial={false} custom={direction}>
              <ActiveStep key={currentStep} direction={direction} />
            </AnimatePresence>
          </div>
          <div className="flex items-center justify-between pt-8">
            <Button
              variant="ghost"
              asChild
              className="group disabled:cursor-not-allowed disabled:opacity-40"
            >
              <NavLink
                onClick={onClickPrevious}
                to={canGoPrevious ? `/steps/${currentStep - 1}` : '/'}
              >
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                Previous
              </NavLink>
            </Button>

            {canGoNext ? (
              <Button
                asChild
                className="group bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange)]/90"
              >
                <NavLink onClick={onClickNext} to={`/steps/${currentStep + 1}`}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </NavLink>
              </Button>
            ) : (
              <div />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
