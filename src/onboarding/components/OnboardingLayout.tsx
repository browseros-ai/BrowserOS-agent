import React from 'react'
import { useOnboardingStore } from '../stores/onboardingStore'
import { ProgressBar } from './ui/ProgressBar'

interface OnboardingLayoutProps {
  children: React.ReactNode
}

export function OnboardingLayout({ children }: OnboardingLayoutProps) {
  const { currentStep } = useOnboardingStore()

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Progress bar - hide on welcome and completion screens */}
      {currentStep > 0 && currentStep < 4 && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
          <ProgressBar />
        </div>
      )}

      {/* Main content */}
      <div className={`flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 ${currentStep > 0 && currentStep < 4 ? 'pt-24 sm:pt-28' : ''}`}>
        <div className="w-full max-w-4xl">
          {children}
        </div>
      </div>

      {/* Footer */}
      <div className="py-4 text-center text-sm text-muted-foreground">
        <p>
          BrowserOS &copy; {new Date().getFullYear()} - The Open-Source Agentic Browser
        </p>
      </div>
    </div>
  )
}
