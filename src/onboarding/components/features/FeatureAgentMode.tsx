import React from 'react'
import { useOnboardingStore } from '../../stores/onboardingStore'
import { NavigationControls } from '../ui/NavigationControls'

export function FeatureAgentMode() {
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
          Built in Agent
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Let BrowserOS Agent browse, click, type, and complete tasks for you. Just describe what you need done!
        </p>
      </div>

      {/* Video Container */}
      <div>
        <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl shadow-brand/20 border-2 border-border/50 bg-card">
          {/* 16:9 Aspect Ratio Container */}
          <div className="relative pb-[56.25%]">
            <video
              className="absolute top-0 left-0 w-full h-full"
              src="https://pub-80f8a01e6e8b4239ae53a7652ef85877.r2.dev/resources/Demo2.mp4"
              title="Agent Mode Demonstration"
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Smart Navigation</h4>
              <p className="text-xs text-muted-foreground">Agent navigates websites and finds information automatically</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-card/80 to-background/60 backdrop-blur-sm border-2 border-border/60 rounded-xl p-5 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/10 transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand/15 to-orange-500/15 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Form Filling</h4>
              <p className="text-xs text-muted-foreground">Automatically fills forms with intelligent context understanding</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-card/80 to-background/60 backdrop-blur-sm border-2 border-border/60 rounded-xl p-5 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/10 transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand/15 to-orange-500/15 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Data Extraction</h4>
              <p className="text-xs text-muted-foreground">Extracts and organizes data from any webpage</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-card/80 to-background/60 backdrop-blur-sm border-2 border-border/60 rounded-xl p-5 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/10 transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand/15 to-orange-500/15 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Privacy Protected</h4>
              <p className="text-xs text-muted-foreground">All automation runs locally with your own API keys</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="text-center p-4 bg-muted/30 border border-border/50 rounded-xl">
        <p className="text-sm text-muted-foreground">
          💡 <span className="font-semibold">Pro Tip:</span> Simply describe your task in natural language and let the agent handle the complexity!
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
