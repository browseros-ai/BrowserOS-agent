import React from 'react'
import { useOnboardingStore } from '../../stores/onboardingStore'
import { NavigationControls } from '../ui/NavigationControls'

export function FeatureTeachMode() {
  const { nextStep, previousStep, skipFeatures } = useOnboardingStore()

  const handleSkipTour = async () => {
    // Mark onboarding as completed and open side panel
    await skipFeatures()

    try {
      // Get the current tab
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true })

      // Open the side panel
      if (currentTab?.id) {
        await chrome.sidePanel.open({ tabId: currentTab.id })
      }

      // Redirect to newtab
      setTimeout(() => {
        const newtabUrl = chrome.runtime.getURL('newtab.html')
        window.location.href = newtabUrl
      }, 500)
    } catch (error) {
      console.error('Failed to complete tour:', error)
      const newtabUrl = chrome.runtime.getURL('newtab.html')
      window.location.href = newtabUrl
    }
  }

  return (
    <div className="flex flex-col space-y-8 max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="text-center space-y-4 pt-16">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          Teach Mode
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Record workflows once by showing and narrating, and BrowserOS learns and repeat them forever!
        </p>
      </div>

      {/* YouTube Video Container */}
      <div>
        <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl shadow-brand/20 border-2 border-border/50 bg-card">
          {/* 16:9 Aspect Ratio Container */}
          <div className="relative pb-[56.25%]">
            <video
              className="absolute top-0 left-0 w-full h-full"
              src="https://pub-80f8a01e6e8b4239ae53a7652ef85877.r2.dev/resources/teach-mode-video.mp4"
              title="BrowserOS Teach Mode Demonstration"
              autoPlay
              muted
              loop
              playsInline
              controls
            />
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-card/80 to-background/60 backdrop-blur-sm border-2 border-border/60 rounded-xl p-5 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/10 transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand/15 to-orange-500/15 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Record & Narrate</h4>
              <p className="text-xs text-muted-foreground">Show the agent your workflow while explaining each step</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-card/80 to-background/60 backdrop-blur-sm border-2 border-border/60 rounded-xl p-5 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/10 transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand/15 to-orange-500/15 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">AI Learns</h4>
              <p className="text-xs text-muted-foreground">BrowserOS understands and memorizes your process</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-card/80 to-background/60 backdrop-blur-sm border-2 border-border/60 rounded-xl p-5 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/10 transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand/15 to-orange-500/15 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Repeat Forever</h4>
              <p className="text-xs text-muted-foreground">Run your workflow anytime with a single command</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-card/80 to-background/60 backdrop-blur-sm border-2 border-border/60 rounded-xl p-5 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/10 transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand/15 to-orange-500/15 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Save Time</h4>
              <p className="text-xs text-muted-foreground">Perfect for repetitive tasks like reporting and form filling</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="text-center p-4 bg-muted/30 border border-border/50 rounded-xl">
        <p className="text-sm text-muted-foreground">
          💡 <span className="font-semibold">Pro Tip:</span> Use voice to narrate your workflow when showing the agent your workflow!
        </p>
      </div>

      {/* Navigation */}
      <NavigationControls
        onPrevious={previousStep}
        onNext={nextStep}
        onSkip={handleSkipTour}
        nextLabel="Next Feature"
        skipLabel="Skip Tour"
      />
    </div>
  )
}