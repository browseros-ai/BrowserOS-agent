import React from 'react'
import { useOnboardingStore } from '../stores/onboardingStore'
import { NavigationControls } from './ui/NavigationControls'

export function StepOne() {
  const { nextStep, previousStep } = useOnboardingStore()

  const handleOpenImportSettings = () => {
    chrome.tabs.create({ url: 'chrome://settings/importData' })
  }

  return (
    <div className="flex flex-col space-y-10 max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="text-center space-y-4 pt-16">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          Seamless Migration
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Bring your data from Google Chrome or other browsers to BrowserOS!
        </p>
      </div>

      {/* Visual flow diagram */}
      <div className="flex items-center justify-center gap-4 sm:gap-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border-2 border-border/40 flex items-center justify-center shadow-xl p-4">
            <img
              src="/assets/icons8-google-chrome.svg"
              alt="Chrome"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">Chrome</p>
        </div>

        <div className="flex items-center gap-2 animate-pulse">
          <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-brand/20 to-orange-500/20 border-2 border-brand/40 flex items-center justify-center shadow-xl p-4">
            <img
              src="/assets/product_logo_svg.svg"
              alt="BrowserOS"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-sm font-semibold text-brand">BrowserOS</p>
        </div>
      </div>

      {/* What gets imported */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[
          { icon: '🔖', title: 'Bookmarks', desc: 'All your saved sites' },
          { icon: '🕐', title: 'History', desc: 'Browsing timeline' },
          { icon: '🔑', title: 'Passwords', desc: 'Saved credentials' }
        ].map((item, index) => (
          <div
            key={item.title}
            className="group bg-gradient-to-br from-card/80 to-background/60 backdrop-blur-sm border-2 border-border/60 rounded-2xl p-6 text-center hover:border-brand/50 hover:shadow-xl hover:shadow-brand/10 transition-all duration-300 hover:-translate-y-1 hover:scale-105 active:scale-95"
          >
            <div className="text-4xl mb-3">{item.icon}</div>
            <h4 className="font-bold text-base mb-2">{item.title}</h4>
            <p className="text-sm text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA Section */}
      <div className="flex flex-col items-center gap-5 bg-gradient-to-br from-orange-50/50 to-orange-100/30 dark:from-orange-950/20 dark:to-orange-900/10 border border-orange-200/50 dark:border-orange-800/30 rounded-2xl p-8">
        <div className="text-center space-y-2 max-w-xl">
          <h3 className="text-xl font-bold">Ready to Import Your Data?</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Import now or do it later. Your Chrome bookmarks, history, and passwords can be transferred securely.
          </p>
        </div>

        <button
          onClick={handleOpenImportSettings}
          className="group relative px-10 py-4 bg-gradient-to-r from-brand to-orange-500 hover:from-brand/90 hover:to-orange-500/90 text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/40 hover:scale-105 active:scale-95 overflow-hidden"
        >
          <span className="relative z-10 flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Open Import Settings
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </button>

        <p className="text-center text-xs text-muted-foreground">
          💡 You can access import settings at: <code className="px-2 py-1 bg-background/90 border border-border/50 rounded font-mono text-xs">chrome://settings/importData</code>
        </p>
      </div>

      <NavigationControls
        className="pt-4"
        onPrevious={previousStep}
        onNext={nextStep}
        nextLabel="Next Step"
      />
    </div>
  )
}
