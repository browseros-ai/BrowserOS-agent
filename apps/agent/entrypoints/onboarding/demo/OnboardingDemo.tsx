import { ArrowRight, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ONBOARDING_COMPLETED_EVENT,
  ONBOARDING_DEMO_TRIGGERED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { openSidePanelWithSearch } from '@/lib/messaging/sidepanel/openSidepanelWithSearch'
import { track } from '@/lib/metrics/track'
import {
  onboardingCompletedStorage,
  onboardingProfileStorage,
} from '@/lib/onboarding/onboardingStorage'

function buildDemoSuggestions() {
  return [
    {
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
  const [customQuery, setCustomQuery] = useState('')
  const [demoSuggestions, setDemoSuggestions] = useState(() =>
    buildDemoSuggestions(),
  )

  useEffect(() => {
    onboardingProfileStorage.getValue().then((profile) => {
      if (profile?.name) {
        setDemoSuggestions(buildDemoSuggestions())
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
    <div className="flex h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg space-y-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--accent-orange)]/10">
            <Sparkles className="size-6 text-[var(--accent-orange)]" />
          </div>
          <h2 className="font-bold text-3xl tracking-tight">
            Try your first task
          </h2>
          <p className="text-base text-muted-foreground">
            Pick a suggestion or type your own to see BrowserOS in action
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
              <span className="font-medium text-sm">{suggestion.label}</span>
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
    </div>
  )
}
