import { ArrowUpRight, Bookmark, History, KeyRound, Upload } from 'lucide-react'
import { type FC, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ONBOARDING_STEP_COMPLETED_EVENT,
  ONBOARDING_STEP_VIEWED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import {
  importHintDismissedAtStorage,
  onboardingProfileStorage,
} from '@/lib/onboarding/onboardingStorage'
import { StepScaffold } from './StepScaffold'
import { type StepDirection, StepTransition } from './StepTransition'

interface ImportChromeStepProps {
  direction: StepDirection
  onContinue: () => void
}

const IMPORT_SETTINGS_URL = 'chrome://settings/importData'

export const ImportChromeStep: FC<ImportChromeStepProps> = ({
  direction,
  onContinue,
}) => {
  const [hasOpenedImport, setHasOpenedImport] = useState(false)

  useEffect(() => {
    onboardingProfileStorage.getValue().then((profile) => {
      if (profile?.importStatus === 'imported') {
        setHasOpenedImport(true)
      }
    })
  }, [])

  const completeStep = async (status: 'imported' | 'skipped') => {
    const existingProfile = await onboardingProfileStorage.getValue()
    if (existingProfile) {
      await onboardingProfileStorage.setValue({
        ...existingProfile,
        importStatus: status,
      })
    }
    await importHintDismissedAtStorage.setValue(
      Date.now() + 100 * 365 * 24 * 60 * 60 * 1000,
    )
    track(ONBOARDING_STEP_COMPLETED_EVENT, {
      step: 2,
      step_name: 'import_chrome',
      import_status: status,
    })
    onContinue()
  }

  const handleOpenImport = async () => {
    setHasOpenedImport(true)
    await chrome.tabs.create({ url: IMPORT_SETTINGS_URL })
    track(ONBOARDING_STEP_VIEWED_EVENT, {
      step: 2,
      step_name: 'import_chrome_settings_opened',
    })
  }

  return (
    <StepTransition direction={direction}>
      <StepScaffold
        badge="Step 2"
        title="Pull your browser context across"
        description="Import from Google Chrome so BrowserOS starts with your bookmarks, saved logins, and recent history instead of an empty slate."
        aside={
          <div className="space-y-6">
            <div className="space-y-3">
              <Badge
                variant="secondary"
                className="rounded-full bg-background px-3 py-1"
              >
                One native handoff
              </Badge>
              <p className="text-muted-foreground text-sm leading-6">
                BrowserOS uses Chrome's native import flow here, so the setup
                stays familiar and you stay in control of what comes over.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  icon: Bookmark,
                  title: 'Bookmarks',
                  description:
                    'Better first-run suggestions and a more useful browser memory.',
                },
                {
                  icon: History,
                  title: 'History',
                  description:
                    'Recent browsing patterns help the agent understand your workflow faster.',
                },
                {
                  icon: KeyRound,
                  title: 'Saved logins',
                  description:
                    'Makes it easier to use authenticated sites from day one.',
                },
              ].map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-border/70 bg-background/80 p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-[var(--accent-orange)]" />
                    <p className="font-medium text-sm">{title}</p>
                  </div>
                  <p className="text-muted-foreground text-sm leading-6">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="rounded-[28px] border border-[var(--accent-orange)]/40 border-dashed bg-[var(--accent-orange)]/5 p-6 sm:p-8">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-orange)]/10">
              <Upload className="h-7 w-7 text-[var(--accent-orange)]" />
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-xl">
                Open Chrome's import sheet
              </h3>
              <p className="max-w-2xl text-muted-foreground leading-7">
                This opens `chrome://settings/importData` in a new tab. Import
                what you want, then come back here to keep going.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Button
              type="button"
              size="lg"
              className="h-auto min-h-28 flex-col items-start gap-3 bg-[var(--accent-orange)] px-5 py-5 text-left text-white hover:bg-[var(--accent-orange)]/90"
              onClick={handleOpenImport}
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-medium">Open Chrome import</span>
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <span className="text-sm text-white/80">
                Bring over history, passwords, and bookmarks.
              </span>
            </Button>

            <Button
              type="button"
              size="lg"
              variant="outline"
              className="h-auto min-h-28 flex-col items-start gap-3 px-5 py-5 text-left"
              onClick={() => completeStep('skipped')}
            >
              <span className="font-medium">Skip for now</span>
              <span className="text-muted-foreground text-sm">
                You can still import later from BrowserOS home.
              </span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-border/70 border-t pt-6">
            <p className="max-w-md text-muted-foreground text-sm leading-6">
              {hasOpenedImport
                ? 'Once you have finished importing in Chrome settings, continue here.'
                : 'If you do not want to import yet, you can skip and keep the flow moving.'}
            </p>
            <Button
              type="button"
              size="lg"
              variant={hasOpenedImport ? 'default' : 'outline'}
              className={
                hasOpenedImport
                  ? 'min-w-40 bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange)]/90'
                  : 'min-w-40'
              }
              onClick={() =>
                completeStep(hasOpenedImport ? 'imported' : 'skipped')
              }
            >
              {hasOpenedImport ? 'I finished importing' : 'Continue'}
            </Button>
          </div>
        </div>
      </StepScaffold>
    </StepTransition>
  )
}
