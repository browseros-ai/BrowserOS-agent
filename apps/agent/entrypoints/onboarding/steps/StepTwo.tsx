import { DollarSign, Key, LockIcon, Zap } from 'lucide-react'
import type { FC } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { type StepDirection, StepTransition } from './StepTransition'

interface StepTwoProps {
  direction: StepDirection
}

const configurationURL = 'chrome://settings/browseros'

export const StepTwo: FC<StepTwoProps> = ({ direction }) => {
  const openConfigurationSettings = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html#/ai') })
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(configurationURL)
    toast.success('Copied to clipboard!', {
      position: 'bottom-center',
    })
  }

  return (
    <StepTransition direction={direction}>
      <div className="space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="font-bold text-3xl tracking-tight md:text-4xl">
            Bring Your Own Keys
          </h2>
          <p className="mx-auto max-w-xl text-base text-muted-foreground">
            Connect to AI providers with your keys for privacy and control
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid grid-cols-3 gap-3 py-6">
          <div className="group relative overflow-hidden rounded-lg border border-border bg-card/50 p-4 transition-all hover:border-[var(--accent-orange)]/50 hover:bg-card">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-orange)]/0 to-[var(--accent-orange)]/5 opacity-0 transition-opacity group-hover:opacity-100" />
            <LockIcon className="mb-2 h-5 w-5 text-[var(--accent-orange)]" />
            <h3 className="mb-1 font-semibold text-sm">Privacy First</h3>
            <p className="text-muted-foreground text-xs">
              Your keys, your data
            </p>
          </div>

          <div className="group relative overflow-hidden rounded-lg border border-border bg-card/50 p-4 transition-all hover:border-[var(--accent-orange)]/50 hover:bg-card">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-orange)]/0 to-[var(--accent-orange)]/5 opacity-0 transition-opacity group-hover:opacity-100" />
            <Zap className="mb-2 h-5 w-5 text-[var(--accent-orange)]" />
            <h3 className="mb-1 font-semibold text-sm">Direct Access</h3>
            <p className="text-muted-foreground text-xs">Fastest responses</p>
          </div>

          <div className="group relative overflow-hidden rounded-lg border border-border bg-card/50 p-4 transition-all hover:border-[var(--accent-orange)]/50 hover:bg-card">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-orange)]/0 to-[var(--accent-orange)]/5 opacity-0 transition-opacity group-hover:opacity-100" />
            <DollarSign className="mb-2 h-5 w-5 text-[var(--accent-orange)]" />
            <h3 className="mb-1 font-semibold text-sm">Pay Per Use</h3>
            <p className="text-muted-foreground text-xs">No markup fees</p>
          </div>
        </div>

        {/* Visual representation */}
        <div className="rounded-xl border border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-orange)]">
                <Key className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-sm">Supported Providers</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {['OpenAI', 'Anthropic', 'Google', 'Custom'].map((provider) => (
              <div
                key={provider}
                className="rounded-md border border-border bg-background px-3 py-2 text-center font-medium text-xs"
              >
                {provider}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3">
          <Button
            onClick={openConfigurationSettings}
            className="h-10 bg-[var(--accent-orange)] text-white shadow-[var(--accent-orange)]/25 shadow-lg hover:bg-[var(--accent-orange)]/90"
          >
            <Key className="mr-2 h-4 w-4" />
            Configure API Keys
          </Button>
          <p className="text-center text-muted-foreground text-xs">
            Configure anytime from{' '}
            <button
              type="button"
              className="cursor-pointer"
              onClick={copyToClipboard}
            >
              <code className="rounded bg-muted px-1.5 py-0.5 text-[var(--accent-orange)]">
                chrome://settings/browseros
              </code>
            </button>
          </p>
        </div>
      </div>
    </StepTransition>
  )
}
