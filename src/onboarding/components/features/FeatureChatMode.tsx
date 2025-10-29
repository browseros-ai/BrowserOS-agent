import React from 'react'
import { useOnboardingStore } from '../../stores/onboardingStore'
import { NavigationControls } from '../ui/NavigationControls'

export function FeatureChatMode() {
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
          Chat with Any AI Model
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Access Claude, GPT-4, Gemini and more - all in one place. Your keys, your privacy, your control.
        </p>
      </div>

      {/* GIF Container */}
      <div>
        <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl shadow-brand/20 border-2 border-border/50 bg-card">
          {/* 16:9 Aspect Ratio Container */}
          <div className="relative pb-[56.25%]">
            <img
              className="absolute top-0 left-0 w-full h-full object-cover"
              src="/assets/onboarding/features/chat-mode-demo.gif"
              alt="Chat mode demonstration"
            />
            {/* Fallback gradient if GIF doesn't load */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand/10 to-orange-500/10 -z-10" />
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-card/80 to-background/60 backdrop-blur-sm border-2 border-border/60 rounded-xl p-5 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/10 transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand/15 to-orange-500/15 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Unified Chat Interface</h4>
              <p className="text-xs text-muted-foreground">Chat with Claude, GPT-4, Gemini from one clean interface</p>
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
              <h4 className="font-bold text-sm mb-1">Your Keys, Your Data</h4>
              <p className="text-xs text-muted-foreground">Complete privacy with local storage and direct API connections</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-card/80 to-background/60 backdrop-blur-sm border-2 border-border/60 rounded-xl p-5 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/10 transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand/15 to-orange-500/15 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Smart Context</h4>
              <p className="text-xs text-muted-foreground">Maintains conversation history and context across sessions</p>
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
              <h4 className="font-bold text-sm mb-1">Instant Switching</h4>
              <p className="text-xs text-muted-foreground">Switch between models mid-conversation without losing context</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="text-center p-4 bg-muted/30 border border-border/50 rounded-xl">
        <p className="text-sm text-muted-foreground">
          💡 <span className="font-semibold">Pro Tip:</span> Your API keys are encrypted and stored locally on your device for complete privacy!
        </p>
      </div>

      {/* Navigation */}
      <NavigationControls
        onPrevious={previousStep}
        onNext={nextStep}
        nextLabel="Next Feature"
        onSkip={handleSkipTour}
        skipLabel="Skip Tour"
      />
    </div>
  )
}