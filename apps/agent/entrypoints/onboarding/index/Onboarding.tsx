import {
  ArrowRight,
  BrainCircuit,
  CalendarClock,
  KeyRound,
  Upload,
  Wand2,
} from 'lucide-react'
import { type FC, useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { PillIndicator } from '@/components/elements/pill-indicator'
import { Button } from '@/components/ui/button'
import { ONBOARDING_STARTED_EVENT } from '@/lib/constants/analyticsEvents'
import { productRepositoryShortUrl } from '@/lib/constants/productUrls'
import { getCurrentYear } from '@/lib/getCurrentYear'
import { track } from '@/lib/metrics/track'
import { FocusGrid } from './FocusGrid'
import { OnboardingHeader } from './OnboardingHeader'

const setupSteps = [
  'Meet your agent and set the names',
  'Import Chrome context',
  'Connect Google, Gmail, and Calendar',
  'Preview soul, skills, and schedules',
  'Launch a LinkedIn-aware BrowserOS chat',
]

const capabilityCards = [
  {
    title: 'SOUL.md',
    description: 'Adjust tone, boundaries, and personality.',
    Icon: BrainCircuit,
  },
  {
    title: 'Skills',
    description: 'Teach repeatable workflows with custom instructions.',
    Icon: Wand2,
  },
  {
    title: 'Bring Your Own Keys',
    description: 'Run on your own models and providers.',
    Icon: KeyRound,
  },
  {
    title: 'Scheduled Tasks',
    description: 'Turn useful prompts into daily automation.',
    Icon: CalendarClock,
  },
]

export const Onboarding: FC = () => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    track(ONBOARDING_STARTED_EVENT)
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OnboardingHeader isMounted={mounted} />

      <main className="relative flex flex-1 items-center overflow-hidden px-6 py-12 sm:px-8 lg:px-10">
        <FocusGrid />

        <div className="relative mx-auto grid w-full max-w-7xl gap-10 lg:grid-cols-[minmax(0,1.15fr)_400px]">
          <div className="space-y-8">
            <div className="space-y-6">
              <PillIndicator
                text="Open-Source Agentic Browser"
                className={`transition-all delay-100 duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
              />

              <div className="space-y-4">
                <h1
                  className={`max-w-4xl text-balance font-semibold text-5xl leading-[1.02] tracking-tight transition-all delay-200 duration-700 md:text-7xl ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
                >
                  Onboard into{' '}
                  <span className="text-[var(--accent-orange)]">BrowserOS</span>{' '}
                  like it can actually do something.
                </h1>
                <p
                  className={`max-w-3xl text-lg text-muted-foreground leading-8 transition-all delay-300 duration-700 md:text-xl ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
                >
                  We&apos;ll import your Chrome context, wire up Google, attach
                  LinkedIn to the first chat, and show you where soul, skills,
                  your own model keys, and scheduled tasks live from day one.
                </p>
              </div>
            </div>

            <div
              className={`grid gap-4 transition-all delay-500 duration-700 sm:grid-cols-2 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            >
              {capabilityCards.map(({ title, description, Icon }) => (
                <div
                  key={title}
                  className="rounded-[28px] border border-border/70 bg-card/95 p-5 shadow-[0_24px_80px_-60px_rgba(207,111,44,0.4)] backdrop-blur"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-orange)]/10">
                    <Icon className="h-6 w-6 text-[var(--accent-orange)]" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="font-medium text-lg">{title}</h2>
                    <p className="text-muted-foreground text-sm leading-6">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div
              className={`flex flex-wrap items-center gap-4 transition-all delay-700 duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
            >
              <Button
                size="lg"
                asChild
                className="group bg-primary font-medium text-primary-foreground hover:bg-primary/90"
              >
                <NavLink to="/onboarding/steps/1">
                  Start setup
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </NavLink>
              </Button>
              <Button size="lg" asChild variant="outline">
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
            className={`transition-all delay-400 duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
          >
            <div className="rounded-[32px] border border-border/70 bg-card/95 p-6 shadow-[0_30px_120px_-60px_rgba(207,111,44,0.4)] backdrop-blur">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-orange)]/10">
                  <Upload className="h-5 w-5 text-[var(--accent-orange)]" />
                </div>
                <div>
                  <p className="font-medium text-muted-foreground text-sm">
                    Five-step setup
                  </p>
                  <h2 className="font-semibold text-xl">What happens next</h2>
                </div>
              </div>

              <div className="space-y-3">
                {setupSteps.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-orange)]/10 font-semibold text-[var(--accent-orange)] text-sm">
                      {(index + 1).toString()}
                    </div>
                    <p className="pt-1 text-muted-foreground text-sm leading-6">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
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
