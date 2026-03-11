import {
  CheckCircle2,
  Linkedin,
  Loader2,
  MessageCircleCode,
  Zap,
} from 'lucide-react'
import { type FC, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  ONBOARDING_COMPLETED_EVENT,
  ONBOARDING_STEP_COMPLETED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import {
  buildOnboardingScheduledTaskUrl,
  seedOnboardingHomeChat,
} from '@/lib/onboarding/launchOnboardingChat'
import {
  firstRunConfettiShownStorage,
  importHintDismissedAtStorage,
  onboardingCompletedStorage,
  onboardingProfileStorage,
  signInHintDismissedAtStorage,
} from '@/lib/onboarding/onboardingStorage'
import { useGetUserMCPIntegrations } from '../../app/connect-mcp/useGetUserMCPIntegrations'
import { StepScaffold } from './StepScaffold'
import { type StepDirection, StepTransition } from './StepTransition'

interface LaunchStepProps {
  direction: StepDirection
  onContinue: () => void
}

const VERY_LONG_TIME_MS = 100 * 365 * 24 * 60 * 60 * 1000

export const LaunchStep: FC<LaunchStepProps> = ({ direction, onContinue }) => {
  const { data: integrations } = useGetUserMCPIntegrations()
  const [isLaunching, setIsLaunching] = useState(false)

  const gmailConnected =
    integrations?.integrations?.find((item) => item.name === 'Gmail')
      ?.is_authenticated ?? false
  const calendarConnected =
    integrations?.integrations?.find((item) => item.name === 'Google Calendar')
      ?.is_authenticated ?? false

  const connectedAppsSummary = useMemo(() => {
    if (gmailConnected && calendarConnected) {
      return 'BrowserOS will mention that Gmail and Google Calendar are already connected, then ask whether it may read a small amount of recent context.'
    }
    if (gmailConnected || calendarConnected) {
      return 'BrowserOS will explain that one Google source is already connected and that adding the other one later gives it a better picture of your work.'
    }
    return 'BrowserOS will explain how Gmail and Google Calendar make the first-run chat more useful once you connect them.'
  }, [calendarConnected, gmailConnected])

  const handleSchedulePreview = async () => {
    await chrome.tabs.create({
      url: buildOnboardingScheduledTaskUrl(),
      active: false,
    })
  }

  const handleLaunch = async () => {
    setIsLaunching(true)

    try {
      const profile = await onboardingProfileStorage.getValue()
      await seedOnboardingHomeChat({
        profile,
        gmailConnected,
        calendarConnected,
      })

      const dismissUntil = Date.now() + VERY_LONG_TIME_MS
      await onboardingCompletedStorage.setValue(true)
      await importHintDismissedAtStorage.setValue(dismissUntil)
      await signInHintDismissedAtStorage.setValue(dismissUntil)
      await firstRunConfettiShownStorage.setValue(false)

      track(ONBOARDING_STEP_COMPLETED_EVENT, {
        step: 5,
        step_name: 'launch',
        gmail_connected: gmailConnected,
        calendar_connected: calendarConnected,
      })
      track(ONBOARDING_COMPLETED_EVENT, {
        gmail_connected: gmailConnected,
        calendar_connected: calendarConnected,
      })

      onContinue()
    } finally {
      setIsLaunching(false)
    }
  }

  return (
    <StepTransition direction={direction}>
      <StepScaffold
        badge="Step 5"
        title="Launch BrowserOS on the main home page"
        description="The next click opens BrowserOS home with a seeded chat, a LinkedIn tab attached for context, and a suggestion for a 9:00 AM daily briefing."
        aside={
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="font-medium text-sm">
                What the first reply will do
              </p>
              <p className="text-muted-foreground text-sm leading-6">
                BrowserOS will greet you by name, inspect the LinkedIn tab we
                attach in the background, then explain how it can personalize
                soul, skills, models, and scheduled tasks.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Linkedin className="h-4 w-4 text-[var(--accent-orange)]" />
                  <p className="font-medium text-sm">LinkedIn first</p>
                </div>
                <p className="text-muted-foreground text-sm leading-6">
                  BrowserOS uses LinkedIn as the first context source instead of
                  a blank introduction.
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <MessageCircleCode className="h-4 w-4 text-[var(--accent-orange)]" />
                  <p className="font-medium text-sm">Consent stays explicit</p>
                </div>
                <p className="text-muted-foreground text-sm leading-6">
                  {connectedAppsSummary}
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[var(--accent-orange)]" />
                  <p className="font-medium text-sm">9:00 AM schedule</p>
                </div>
                <p className="text-muted-foreground text-sm leading-6">
                  The launch chat will mention a recurring inbox and calendar
                  briefing instead of waiting for you to discover schedules
                  later.
                </p>
              </div>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="grid gap-4 xl:grid-cols-2">
            {[
              'Open BrowserOS home and start inline chat automatically.',
              'Attach LinkedIn in the background so the first response has real context.',
              'Ask before reading Gmail and Google Calendar, even when they are connected.',
              'Suggest a daily 9:00 AM automation path for your inbox and calendar.',
            ].map((item) => (
              <div
                key={item}
                className="rounded-[28px] border border-border/70 bg-background/80 p-5"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-orange)]" />
                  <p className="text-sm leading-7">{item}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[28px] border border-[var(--accent-orange)]/30 border-dashed bg-[var(--accent-orange)]/6 p-6">
            <h3 className="font-semibold text-xl">Optional preview</h3>
            <p className="mt-2 max-w-3xl text-muted-foreground leading-7">
              If you want to see the schedule UI immediately, open the prefilled
              daily-briefing draft in the background now. The first chat will
              still suggest it again after launch.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={handleSchedulePreview}
            >
              Preview the 9:00 AM schedule draft
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-border/70 border-t pt-6">
            <p className="max-w-xl text-muted-foreground text-sm leading-6">
              The launch target is the main home page, not the old onboarding
              demo route.
            </p>
            <Button
              type="button"
              size="lg"
              className="min-w-48 bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange)]/90"
              onClick={handleLaunch}
              disabled={isLaunching}
            >
              {isLaunching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Launching BrowserOS...
                </>
              ) : (
                'Open BrowserOS home'
              )}
            </Button>
          </div>
        </div>
      </StepScaffold>
    </StepTransition>
  )
}
