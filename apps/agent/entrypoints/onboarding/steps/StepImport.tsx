import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ONBOARDING_IMPORT_OPENED_EVENT,
  ONBOARDING_IMPORT_SKIPPED_EVENT,
  ONBOARDING_STEP_COMPLETED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { type StepDirection, StepTransition } from './StepTransition'

interface StepImportProps {
  direction: StepDirection
  onContinue: () => void
}

export const StepImport = ({ direction, onContinue }: StepImportProps) => {
  const handleImport = () => {
    track(ONBOARDING_IMPORT_OPENED_EVENT)
    chrome.tabs.create({ url: 'chrome://settings/importData' })
  }

  const handleContinue = () => {
    track(ONBOARDING_STEP_COMPLETED_EVENT, { step: 2, step_name: 'import' })
    onContinue()
  }

  const handleSkip = () => {
    track(ONBOARDING_IMPORT_SKIPPED_EVENT)
    track(ONBOARDING_STEP_COMPLETED_EVENT, {
      step: 2,
      step_name: 'import',
      skipped: true,
    })
    onContinue()
  }

  return (
    <StepTransition direction={direction}>
      <div className="flex h-full flex-col items-center justify-center">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--accent-orange)]/10">
              <Download className="size-6 text-[var(--accent-orange)]" />
            </div>
            <h2 className="font-bold text-3xl tracking-tight">
              Import your data
            </h2>
            <p className="text-base text-muted-foreground">
              Bring your bookmarks, passwords, and browsing history from Google
              Chrome
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 text-muted-foreground text-sm">
            <p>
              This will open Chrome's import settings in a new tab. Select
              Google Chrome as the source and choose what to import.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleImport}
              className="w-full bg-[var(--accent-orange)] text-white hover:bg-[var(--accent-orange)]/90"
            >
              <Download className="size-4" />
              Open Import Settings
            </Button>

            <Button
              variant="outline"
              onClick={handleContinue}
              className="w-full"
            >
              I've imported my data — Continue
            </Button>
          </div>

          <div className="text-center">
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Skip for now
            </Button>
          </div>
        </div>
      </div>
    </StepTransition>
  )
}
