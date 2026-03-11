import {
  BrainCircuit,
  CalendarClock,
  KeyRound,
  Sparkles,
  Wand2,
} from 'lucide-react'
import type { FC } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ONBOARDING_STEP_COMPLETED_EVENT } from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { onboardingProfileStorage } from '@/lib/onboarding/onboardingStorage'
import { StepScaffold } from './StepScaffold'
import { type StepDirection, StepTransition } from './StepTransition'

interface CapabilitiesStepProps {
  direction: StepDirection
  onContinue: () => void
}

const capabilityCards = [
  {
    title: 'Evolve your `SOUL.md`',
    description:
      'BrowserOS can change how it behaves, not just what it knows. Tone, boundaries, and working style live in your soul.',
    route: '/settings/soul',
    Icon: BrainCircuit,
  },
  {
    title: 'Create custom skills',
    description:
      'Teach the agent repeatable workflows with your own instructions, templates, and execution rules.',
    route: '/settings/skills',
    Icon: Wand2,
  },
  {
    title: 'Bring your own model',
    description:
      'Use your own providers and API keys so BrowserOS runs with the stack and budget you prefer.',
    route: '/settings/ai',
    Icon: KeyRound,
  },
  {
    title: 'Schedule recurring work',
    description:
      'Turn useful prompts into daily or hourly automations that run inside BrowserOS for you.',
    route: '/scheduled',
    Icon: CalendarClock,
  },
]

export const CapabilitiesStep: FC<CapabilitiesStepProps> = ({
  direction,
  onContinue,
}) => {
  const handleContinue = async () => {
    const profile = await onboardingProfileStorage.getValue()
    track(ONBOARDING_STEP_COMPLETED_EVENT, {
      step: 4,
      step_name: 'teach_agent',
      assistant_name: profile?.assistantName ?? 'BrowserOS',
    })
    onContinue()
  }

  const openRoute = async (path: string) => {
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`app.html#${path}`),
      active: false,
    })
  }

  return (
    <StepTransition direction={direction}>
      <StepScaffold
        badge="Step 4"
        title="Show what makes BrowserOS different"
        description="Before launch, make the product's real levers explicit: personality, reusable skills, your own models, and recurring automation."
        aside={
          <div className="space-y-6">
            <div className="space-y-3">
              <Badge
                variant="secondary"
                className="rounded-full bg-background px-3 py-1"
              >
                What the first chat will do
              </Badge>
              <p className="text-muted-foreground text-sm leading-6">
                BrowserOS will open with your LinkedIn context attached, greet
                you by name, explain these capabilities in plain English, and
                ask whether it can learn more from Gmail and Calendar.
              </p>
            </div>

            <div className="rounded-[28px] border border-[var(--accent-orange)]/20 bg-[var(--accent-orange)]/6 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--accent-orange)]" />
                <p className="font-medium text-sm">Launch promise</p>
              </div>
              <p className="text-muted-foreground text-sm leading-6">
                By the time you land on home, BrowserOS should feel like a
                product that can browse, learn, adapt, and schedule work, not
                just answer prompts.
              </p>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-2">
            {capabilityCards.map(({ title, description, route, Icon }) => (
              <div
                key={title}
                className="rounded-[28px] border border-border/70 bg-background/80 p-5"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-orange)]/10">
                    <Icon className="h-6 w-6 text-[var(--accent-orange)]" />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => openRoute(route)}
                  >
                    Preview
                  </Button>
                </div>
                <div className="space-y-2">
                  <h3 className="font-medium text-lg">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-6">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[28px] border border-border/70 bg-muted/35 p-6">
            <h3 className="font-semibold text-xl">What happens after this</h3>
            <p className="mt-2 max-w-3xl text-muted-foreground leading-7">
              BrowserOS will open a chat on the main home page, inspect the
              LinkedIn tab we attach for context, and then offer to go deeper
              with connected Gmail and Calendar. It will also surface the idea
              of a daily 9:00 AM briefing task instead of waiting for you to
              discover schedules later.
            </p>
          </div>

          <div className="flex justify-end border-border/70 border-t pt-6">
            <Button
              type="button"
              size="lg"
              className="min-w-40 bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange)]/90"
              onClick={handleContinue}
            >
              Continue
            </Button>
          </div>
        </div>
      </StepScaffold>
    </StepTransition>
  )
}
