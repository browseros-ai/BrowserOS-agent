import React from 'react'
import { useOnboardingStore } from '../../stores/onboardingStore'

const STEP_NAMES = ['Import Data', 'API Keys', 'Get Started']

export function ProgressBar() {
  const { currentStep } = useOnboardingStore()

  // Calculate progress (steps 1-3, excluding welcome and completion)
  const progress = currentStep > 0 && currentStep < 4 ? ((currentStep) / 3) * 100 : 0

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Step indicators */}
        <div className="flex justify-between mb-2">
          {STEP_NAMES.map((name, index) => {
            const stepNumber = index + 1
            const isActive = currentStep === stepNumber
            const isCompleted = currentStep > stepNumber

            return (
              <div
                key={name}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-brand'
                    : isCompleted
                    ? 'text-green-600 dark:text-green-500'
                    : 'text-muted-foreground'
                }`}
              >
                <div
                  className={`flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all ${
                    isActive
                      ? 'border-brand bg-brand/10'
                      : isCompleted
                      ? 'border-green-600 dark:border-green-500 bg-green-600 dark:bg-green-500 text-white'
                      : 'border-muted-foreground'
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <span className="text-xs">{stepNumber}</span>
                  )}
                </div>
                <span className="hidden sm:inline">{name}</span>
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-brand transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
