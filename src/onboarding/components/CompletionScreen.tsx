import React from 'react'
import { useOnboardingStore } from '../stores/onboardingStore'
import { NavigationControls } from './ui/NavigationControls'

export function CompletionScreen() {
  const { nextStep, previousStep } = useOnboardingStore()

  return (
    <div className="flex flex-col space-y-8 max-w-5xl mx-auto px-4">
      {/* Success animation */}
      <div className="relative flex justify-center pt-16">
        <div className="relative">
          <div className="absolute inset-0 bg-brand/20 blur-3xl animate-pulse" />
          <img
            src="/assets/new_tab_search/browseros.svg"
            alt="BrowserOS"
            className="relative w-32 h-32 object-contain drop-shadow-2xl"
          />
        </div>
      </div>

      {/* Heading */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl sm:text-5xl font-bold">
          Setup Complete! 🎉
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Your setup is complete! You can start using BrowserOS or complete a quick tutorial on BrowserOS's features by clicking orange button (Explore Features) below.</p>
      </div>

      {/* Quick links */}
      <div className="max-w-2xl mx-auto w-full">
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <svg
              className="w-5 h-5 text-brand"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Join our community and help us improve BrowserOS!
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="https://discord.gg/browseros"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 border border-border hover:border-brand/50 rounded-lg transition-all duration-200 group"
            >
              <svg
                className="w-5 h-5 text-muted-foreground group-hover:text-brand transition-colors"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
              </svg>
              <div className="text-left">
                <p className="text-sm font-medium">Join Discord</p>
                <p className="text-xs text-muted-foreground">To suggest features / provide feedback</p>
              </div>
            </a>

            <a
              href="https://dub.sh/browserOS-slack"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 border border-border hover:border-brand/50 rounded-lg transition-all duration-200 group"
            >
              <svg
                className="w-5 h-5 text-muted-foreground group-hover:text-brand transition-colors"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
              </svg>
              <div className="text-left">
                <p className="text-sm font-medium">Join Slack</p>
                <p className="text-xs text-muted-foreground">To suggest features / provide feedback</p>
              </div>
            </a>

            <a
              href="https://github.com/browseros-ai/BrowserOS"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 border border-border hover:border-brand/50 rounded-lg transition-all duration-200 group"
            >
              <svg
                className="w-5 h-5 text-muted-foreground group-hover:text-brand transition-colors"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <div className="text-left">
                <p className="text-sm font-medium">GitHub</p>
                <p className="text-xs text-muted-foreground">Star our repository</p>
              </div>
            </a>

            <a
              href="https://docs.browseros.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 border border-border hover:border-brand/50 rounded-lg transition-all duration-200 group"
            >
              <svg
                className="w-5 h-5 text-muted-foreground group-hover:text-brand transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <div className="text-left">
                <p className="text-sm font-medium">Documentation</p>
                <p className="text-xs text-muted-foreground">Learn more</p>
              </div>
            </a>
          </div>
        </div>
      </div>

      <NavigationControls
        onPrevious={previousStep}
        onNext={nextStep}
        nextLabel="Explore Features"
        nextButtonPrimary={true}
      />
    </div>
  )
}
