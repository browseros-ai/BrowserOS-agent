import { ArrowRight, Clock, Key, Upload } from 'lucide-react'
import type { FC } from 'react'
import { toast } from 'sonner'
import GoogleChromeLogo from '@/assets/google_chrome_logo.svg'
import ProductLogoSvg from '@/assets/product_logo.svg'
import { Button } from '@/components/ui/button'
import { type StepDirection, StepTransition } from './StepTransition'

interface StepOneProps {
  direction: StepDirection
}

const importSettingsURL = 'chrome://settings/importData'

export const StepOne: FC<StepOneProps> = ({ direction }) => {
  const openImportSettings = () => {
    chrome.tabs.create({ url: importSettingsURL })
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(importSettingsURL)
    toast.success('Copied to clipboard!', {
      position: 'bottom-center',
    })
  }

  return (
    <StepTransition direction={direction}>
      <div className="space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="font-bold text-3xl tracking-tight md:text-4xl">
            Seamless Migration
          </h2>
          <p className="mx-auto max-w-xl text-base text-muted-foreground">
            Import bookmarks, history, and passwords from Chrome
          </p>
        </div>

        {/* Visual representation */}
        <div className="flex items-center justify-center gap-6 py-6">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-card shadow-lg">
              <img
                src={GoogleChromeLogo}
                alt="google-chrome"
                className="h-10 w-10"
              />
            </div>
            <span className="font-medium text-muted-foreground text-xs">
              Chrome
            </span>
          </div>

          <ArrowRight className="h-5 w-5 animate-pulse text-muted-foreground" />

          <div className="flex flex-col items-center gap-2">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl shadow-xl">
              <img
                src={ProductLogoSvg}
                alt="BrowserOS"
                className="h-full w-full"
              />
            </div>
            <span className="font-medium text-accent-orange text-xs">
              BrowserOS
            </span>
          </div>
        </div>

        {/* Compact feature grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="group relative overflow-hidden rounded-lg border border-border bg-card/50 p-4 transition-all hover:border-[var(--accent-orange)]/50 hover:bg-card">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-orange)]/0 to-[var(--accent-orange)]/5 opacity-0 transition-opacity group-hover:opacity-100" />
            <Upload className="mb-2 h-5 w-5 text-[var(--accent-orange)]" />
            <h3 className="mb-1 font-semibold text-sm">Bookmarks</h3>
            <p className="text-muted-foreground text-xs">All saved sites</p>
          </div>

          <div className="group relative overflow-hidden rounded-lg border border-border bg-card/50 p-4 transition-all hover:border-[var(--accent-orange)]/50 hover:bg-card">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-orange)]/0 to-[var(--accent-orange)]/5 opacity-0 transition-opacity group-hover:opacity-100" />
            <Clock className="mb-2 h-5 w-5 text-[var(--accent-orange)]" />
            <h3 className="mb-1 font-semibold text-sm">History</h3>
            <p className="text-muted-foreground text-xs">Browse timeline</p>
          </div>

          <div className="group relative overflow-hidden rounded-lg border border-border bg-card/50 p-4 transition-all hover:border-[var(--accent-orange)]/50 hover:bg-card">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-orange)]/0 to-[var(--accent-orange)]/5 opacity-0 transition-opacity group-hover:opacity-100" />
            <Key className="mb-2 h-5 w-5 text-[var(--accent-orange)]" />
            <h3 className="mb-1 font-semibold text-sm">Passwords</h3>
            <p className="text-muted-foreground text-xs">Credentials</p>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <Button
            onClick={openImportSettings}
            className="h-10 bg-[var(--accent-orange)] text-white shadow-[var(--accent-orange)]/25 shadow-lg hover:bg-[var(--accent-orange)]/90"
          >
            <Upload className="mr-2 h-4 w-4" />
            Open Import Settings
          </Button>
          <p className="text-center text-muted-foreground text-xs">
            Import now or later from{' '}
            <button
              type="button"
              className="cursor-pointer"
              onClick={copyToClipboard}
            >
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[var(--accent-orange)]">
                {importSettingsURL}
              </code>
            </button>
          </p>
        </div>
      </div>
    </StepTransition>
  )
}
