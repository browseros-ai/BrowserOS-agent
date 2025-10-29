import React from 'react'
import { useOnboardingStore } from '../stores/onboardingStore'
import { NavigationControls } from './ui/NavigationControls'

export function StepTwo() {
  const { nextStep, previousStep } = useOnboardingStore()

  const handleOpenSettings = () => {
    chrome.tabs.create({ url: 'chrome://settings/browseros' })
  }

  return (
    <div className="flex flex-col space-y-10 max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="text-center space-y-4 pt-16">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          Bring Your Own Keys
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Connect directly to AI providers with your own API keys for maximum control and privacy
        </p>
      </div>

      {/* Why BYOK - Compact Grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          {
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
            title: 'Privacy First',
            desc: 'Your keys, your data'
          },
          {
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
            title: 'Direct Access',
            desc: 'Fastest responses'
          },
          {
            icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
            title: 'Pay Per Use',
            desc: 'No markup fees'
          }
        ].map((item, index) => (
          <div
            key={item.title}
            className="bg-gradient-to-br from-card/80 to-background/60 backdrop-blur-sm border-2 border-border/60 rounded-xl p-4 text-center hover:border-brand/50 hover:shadow-lg hover:shadow-brand/10 transition-all duration-300 hover:-translate-y-1 hover:scale-105 active:scale-95"
          >
            <div className="w-10 h-10 mx-auto rounded-lg bg-gradient-to-br from-brand/15 to-orange-500/15 border border-brand/20 flex items-center justify-center text-brand mb-3 shadow-sm">
              {item.icon}
            </div>
            <h4 className="font-bold text-sm mb-1">{item.title}</h4>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* CTA Section */}
      <div className="flex flex-col items-center gap-5 bg-gradient-to-br from-orange-50/50 to-orange-100/30 dark:from-orange-950/20 dark:to-orange-900/10 border border-orange-200/50 dark:border-orange-800/30 rounded-2xl p-8">
        <div className="text-center space-y-2 max-w-xl">
          <h3 className="text-xl font-bold">Ready to Configure Your Keys?</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Set up now or configure later from settings. Your API keys are stored securely and never leave your device.
          </p>
        </div>

        <button
          onClick={handleOpenSettings}
          className="group relative px-10 py-4 bg-gradient-to-r from-brand to-orange-500 hover:from-brand/90 hover:to-orange-500/90 text-white font-bold rounded-xl transition-all duration-300 shadow-lg shadow-brand/25 hover:shadow-xl hover:shadow-brand/40 hover:scale-105 active:scale-95 overflow-hidden"
        >
          <span className="relative z-10 flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Configure API Keys
            <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </button>

        <p className="text-center text-xs text-muted-foreground">
          💡 Access settings anytime: <code className="px-2 py-1 bg-background/90 border border-border/50 rounded font-mono text-xs">chrome://settings/browseros</code>
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
