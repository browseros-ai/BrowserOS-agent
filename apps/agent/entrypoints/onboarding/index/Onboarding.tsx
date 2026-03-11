import { ArrowRight } from 'lucide-react'
import { type FC, useEffect, useState } from 'react'
import { NavLink, useSearchParams } from 'react-router'
import { PillIndicator } from '@/components/elements/pill-indicator'
import { Button } from '@/components/ui/button'
import { ONBOARDING_STARTED_EVENT } from '@/lib/constants/analyticsEvents'
import { productRepositoryShortUrl } from '@/lib/constants/productUrls'
import { getCurrentYear } from '@/lib/getCurrentYear'
import { track } from '@/lib/metrics/track'
import {
  getOnboardingFeaturesPath,
  ONBOARDING_HOME_PATH,
} from '@/lib/onboarding/onboardingFlow'
import { onboardingCompletedStorage } from '@/lib/onboarding/onboardingStorage'
import { FocusGrid } from './FocusGrid'
import { OnboardingHeader } from './OnboardingHeader'

export const Onboarding: FC = () => {
  const [searchParams] = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const isRevisit = searchParams.get('source') === 'revisit'

  useEffect(() => {
    setMounted(true)
    track(ONBOARDING_STARTED_EVENT)
    onboardingCompletedStorage
      .getValue()
      .then((completed) => setHasCompletedOnboarding(completed))
  }, [])

  const showRevisitActions = hasCompletedOnboarding || isRevisit
  const primaryPath = getOnboardingFeaturesPath(
    showRevisitActions ? 'settings' : 'setup',
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OnboardingHeader isMounted={mounted} />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
        <FocusGrid />

        <div className="relative w-full max-w-6xl">
          <div className="space-y-6 text-center">
            <PillIndicator
              text={
                showRevisitActions
                  ? 'Welcome Back'
                  : 'Open-Source Agentic Browser'
              }
              className={`transition-all delay-100 duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            />

            <h1
              className={`text-balance font-semibold text-5xl leading-[1.1] tracking-tight transition-all delay-200 duration-700 md:text-7xl ${mounted ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
            >
              Welcome to{' '}
              <span className="inline-block animate-glow-once text-accent-orange">
                BrowserOS
              </span>
            </h1>

            <p
              className={`mx-auto max-w-2xl text-pretty text-muted-foreground text-xl leading-relaxed transition-all delay-300 duration-700 md:text-2xl ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            >
              {showRevisitActions
                ? 'Revisit the guided setup or jump straight back into BrowserOS.'
                : 'Turn your words into actions. Privacy-first alternative to ChatGPT Atlas, Perplexity Comet and Dia!'}
            </p>

            <div
              className={`flex items-center justify-center gap-4 pt-4 transition-all delay-500 duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            >
              <Button
                size="lg"
                asChild
                className="group bg-primary font-medium text-primary-foreground transition-transform duration-200 hover:scale-105 hover:bg-primary/90"
              >
                <NavLink to={primaryPath}>
                  {showRevisitActions ? 'Revisit Onboarding' : 'Get Started'}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </NavLink>
              </Button>
              <Button
                size="lg"
                asChild
                variant="outline"
                className="border-border bg-background transition-transform duration-200 hover:scale-105 hover:bg-accent"
              >
                {showRevisitActions ? (
                  <NavLink to={ONBOARDING_HOME_PATH}>Open BrowserOS</NavLink>
                ) : (
                  <a
                    href={productRepositoryShortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on GitHub
                  </a>
                )}
              </Button>
            </div>
          </div>
        </div>
      </main>

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
