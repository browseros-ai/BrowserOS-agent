import React from 'react'
import { useOnboardingStore } from '../stores/onboardingStore'
import { NavigationControls } from './ui/NavigationControls'

export function VideoStep() {
  const { nextStep, previousStep } = useOnboardingStore()

  return (
    <div className="flex flex-col space-y-8 max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="text-center space-y-4 pt-16">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          Why switch to BrowserOS?
        </h2>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Watch our launch video to understand the vision of BrowserOS and key features!
        </p>
      </div>

      {/* Video Container */}
      <div>
        <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl shadow-brand/20 border-2 border-border/50 bg-card">
          {/* 16:9 Aspect Ratio Container */}
          <div className="relative pb-[56.25%]">
            <video
              className="absolute top-0 left-0 w-full h-full"
              src="https://pub-80f8a01e6e8b4239ae53a7652ef85877.r2.dev/resources/animated-launch-vide.mp4"
              title="BrowserOS Launch Video"
              autoPlay
              muted
              loop
              playsInline
              controls
            />
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="text-center p-4 bg-muted/30 border border-border/50 rounded-xl">
        <p className="text-sm text-muted-foreground">
          🎬 <span className="font-semibold">Tip:</span> This video showcases the key features and capabilities of BrowserOS. You can skip it if you prefer to jump right in!
        </p>
      </div>

      <NavigationControls
        className="pt-4"
        onPrevious={previousStep}
        onNext={nextStep}
        nextLabel="Complete Setup"
      />
    </div>
  )
}
