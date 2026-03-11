import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ONBOARDING_COMPLETED_EVENT,
  ONBOARDING_DEMO_TRIGGERED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { openSidePanelWithSearch } from '@/lib/messaging/sidepanel/openSidepanelWithSearch'
import { track } from '@/lib/metrics/track'
import {
  getOnboardingFlowSource,
  getOnboardingStepPath,
} from '@/lib/onboarding/onboardingFlow'
import {
  onboardingCompletedStorage,
  onboardingProfileStorage,
} from '@/lib/onboarding/onboardingStorage'
import { OnboardingProgress } from '../steps/OnboardingProgress'

function buildDemoSuggestions(company?: string) {
  return [
    company
      ? {
          label: `Search for ${company} and summarize the latest news`,
          query: `Search for ${company} and summarize the latest news about them`,
          mode: 'agent' as const,
        }
      : {
          label: "What's the top tech news today",
          query: "What's the top tech news today? Give me a brief summary",
          mode: 'agent' as const,
        },
    {
      label: "What's the top news today",
      query:
        "What's the top news today? Give me a brief summary of the biggest stories",
      mode: 'agent' as const,
    },
    {
      label: 'Find me a good restaurant nearby',
      query: 'Find me a good restaurant nearby',
      mode: 'agent' as const,
    },
  ]
}

export const OnboardingDemo = () => {
  const [searchParams] = useSearchParams()
  const [customQuery, setCustomQuery] = useState('')
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [demoSuggestions, setDemoSuggestions] = useState(() =>
    buildDemoSuggestions(),
  )
  const source = getOnboardingFlowSource(searchParams)

  useEffect(() => {
    onboardingProfileStorage.getValue().then((profile) => {
      if (profile?.company) {
        setCompanyName(profile.company)
        setDemoSuggestions(buildDemoSuggestions(profile.company))
      }
    })
  }, [])

  const completeOnboarding = async () => {
    await onboardingCompletedStorage.setValue(true)
    track(ONBOARDING_COMPLETED_EVENT)
  }

  const handleDemoTask = async (
    query: string,
    mode: 'chat' | 'agent',
    index: number,
  ) => {
    track(ONBOARDING_DEMO_TRIGGERED_EVENT, {
      query,
      mode,
      source: 'suggestion',
      suggestion_index: index,
    })
    await completeOnboarding()

    await chrome.tabs.create({ active: true })
    await new Promise((resolve) => setTimeout(resolve, 500))
    openSidePanelWithSearch('open', { query, mode })
  }

  const handleCustomQuery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customQuery.trim()) return

    track(ONBOARDING_DEMO_TRIGGERED_EVENT, {
      query: customQuery.trim(),
      mode: 'agent',
      source: 'custom',
    })
    await completeOnboarding()

    await chrome.tabs.create({ active: true })
    await new Promise((resolve) => setTimeout(resolve, 500))
    openSidePanelWithSearch('open', {
      query: customQuery.trim(),
      mode: 'agent',
    })
  }

  const handleSkip = async () => {
    track(ONBOARDING_DEMO_TRIGGERED_EVENT, { skipped: true })
    await completeOnboarding()
    window.location.href = chrome.runtime.getURL('app.html#/home')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <OnboardingProgress currentStep={3} />
      <main className="flex flex-1 items-center justify-center overflow-y-auto px-6">
        <div className="w-full max-w-4xl">
          <div className="mx-auto w-full max-w-lg space-y-8">
            <div className="space-y-2 text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--accent-orange)]/10">
                <Sparkles className="size-6 text-[var(--accent-orange)]" />
              </div>
              <h2 className="font-bold text-3xl tracking-tight">
                Let&apos;s put BrowserOS to work
              </h2>
              <p className="text-base text-muted-foreground">
                {companyName
                  ? `We tailored a few starter tasks around ${companyName}. Pick one or type a real task of your own.`
                  : 'Pick a suggestion or type a real task of your own to see BrowserOS in action.'}
              </p>
            </div>

            <div className="space-y-3">
              {demoSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion.label}
                  type="button"
                  onClick={() =>
                    handleDemoTask(suggestion.query, suggestion.mode, index)
                  }
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-[var(--accent-orange)]/50 hover:bg-accent"
                >
                  <span className="font-medium text-sm">
                    {suggestion.label}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>

            <form onSubmit={handleCustomQuery} className="flex gap-2">
              <Input
                placeholder="Or type your own task..."
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={!customQuery.trim()}
                className="bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange)]/90"
              >
                Go
              </Button>
            </form>

            <div className="text-center">
              <Button
                variant="ghost"
                onClick={handleSkip}
                className="text-muted-foreground"
              >
                Skip and go to homepage
              </Button>
            </div>
          </div>

          <div className="pt-8">
            <Button variant="ghost" asChild className="group">
              <NavLink to={getOnboardingStepPath(2, source)}>
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                Back
              </NavLink>
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
