'use client'

import { ArrowRight, Code2, Lock, Zap } from 'lucide-react'
import { type FC, useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { PillIndicator } from '@/components/elements/pill-indicator'
import { Button } from '@/components/ui/button'
import {
  productRepositoryShortUrl,
  productVideoUrl,
  productWebUrl,
} from '@/lib/constants/productUrls'
import { getCurrentYear } from '@/lib/getCurrentYear'
import { cn } from '@/lib/utils'
import { FeatureCards } from './FeatureCards'
import { FocusGrid } from './FocusGrid'
import { OnboardingHeader } from './OnboardingHeader'

/**
 * @public
 */
export const Onboarding: FC = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <OnboardingHeader isMounted={mounted} />

      {/* Main Content */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
        {/* Grid treatment for the focus area */}
        <FocusGrid />

        <div className="relative w-full max-w-6xl">
          {/* Hero Section */}
          <div className="mb-16 space-y-6 text-center">
            {/* Staggered fade-in animation to badge */}
            <PillIndicator
              text="Open-Source Agentic Browser"
              className={`transition-all delay-100 duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            />

            {/* Fade-in and scale animation to heading */}
            <h1
              className={`text-balance font-semibold text-5xl leading-[1.1] tracking-tight transition-all delay-200 duration-700 md:text-7xl ${mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
            >
              Welcome to{' '}
              <span className="inline-block animate-glow-once text-accent-orange">
                BrowserOS
              </span>
            </h1>

            {/* Fade-in animation to subtitle */}
            <p
              className={`mx-auto max-w-2xl text-pretty text-muted-foreground text-xl leading-relaxed transition-all delay-300 duration-700 md:text-2xl ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            >
              Turn your words into actions. Privacy-first alternative to ChatGPT
              Atlas, Perplexity Comet and Dia!
            </p>

            {/* Fade-in animation to buttons */}
            <div
              className={`flex items-center justify-center gap-4 pt-4 transition-all delay-500 duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            >
              <Button
                size="lg"
                asChild
                className="group bg-primary font-medium text-primary-foreground transition-transform duration-200 hover:scale-105 hover:bg-primary/90"
              >
                <NavLink to="/steps/1">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </NavLink>
              </Button>
              <Button
                size="lg"
                asChild
                variant="outline"
                className="border-border bg-background transition-transform duration-200 hover:scale-105 hover:bg-accent"
              >
                <a
                  href={productRepositoryShortUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>

          <div
            className={cn(
              'mx-auto grid max-w-5xl gap-4 transition-all delay-700 duration-700 md:grid-cols-3',
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
            )}
          >
            <FeatureCards
              href={productVideoUrl}
              title="AI-native Browser"
              description="Automate web tasks with intelligent agents"
              icon={<Zap className="h-6 w-6 text-accent-foreground" />}
            />
            <FeatureCards
              href={productWebUrl}
              title="Privacy First"
              description="Your data stays local and secure"
              icon={<Lock className="h-6 w-6 text-accent-foreground" />}
            />
            <FeatureCards
              href={productRepositoryShortUrl}
              title="Open Source"
              description="Built by the community, for everyone"
              icon={<Code2 className="h-6 w-6 text-accent-foreground" />}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-border/40 border-t py-8">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-center text-muted-foreground text-sm">
            BrowserOS © {getCurrentYear()} - The Open-Source Agentic Browser
          </p>
        </div>
      </footer>
    </div>
  )
}
