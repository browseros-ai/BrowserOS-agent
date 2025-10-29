import React from 'react'
import { useOnboardingStore } from '../../stores/onboardingStore'
import { NavigationControls } from '../ui/NavigationControls'

export function FeatureQuickSearch() {
  const { previousStep, skipFeatures } = useOnboardingStore()

  const handleStartUsing = async () => {
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

  const handleOpenSettings = () => {
    chrome.tabs.create({ url: 'chrome://settings/browseros' })
  }

  return (
    <div className="flex flex-col space-y-8 max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="text-center space-y-4 pt-16">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          Quick Search
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Lightning-fast search using any AI provider from the new tab page.
        </p>
      </div>

      {/* GIF Container */}
      <div>
        <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl shadow-brand/20 border-2 border-border/50 bg-card">
          {/* 16:9 Aspect Ratio Container */}
          <div className="relative pb-[56.25%]">
            <img
              className="absolute top-0 left-0 w-full h-full object-cover"
              src="https://pub-b52e24a001bd463a848cb2d8c8667f63.r2.dev/quick-search.gif"
              alt="Quick search demonstration"
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Instant AI Search</h4>
              <p className="text-xs text-muted-foreground">Search with any AI provider directly from your new tab page</p>
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
              <h4 className="font-bold text-sm mb-1">Lightning Fast</h4>
              <p className="text-xs text-muted-foreground">Opens the search results within 400ms!</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-card/80 to-background/60 backdrop-blur-sm border-2 border-border/60 rounded-xl p-5 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/10 transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand/15 to-orange-500/15 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Easy Configuration</h4>
              <p className="text-xs text-muted-foreground">You can customize providers in settings.</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-card/80 to-background/60 backdrop-blur-sm border-2 border-border/60 rounded-xl p-5 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/10 transition-all duration-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand/15 to-orange-500/15 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-1">Multiple Providers</h4>
              <p className="text-xs text-muted-foreground">Switch between Google, ChatGPT, Claude, Gemini and more instantly</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="text-center p-4 bg-muted/30 border border-border/50 rounded-xl">
        <p className="text-sm text-muted-foreground">
          💡 <span className="font-semibold">Pro Tip:</span> Set up your default AI provider in settings for the fastest search experience!
        </p>
      </div>

      {/* Navigation */}
      <NavigationControls
        onPrevious={previousStep}
        onNext={handleStartUsing}
        nextLabel="Start Using BrowserOS"
        nextButtonPrimary
      />
    </div>
  )
}
