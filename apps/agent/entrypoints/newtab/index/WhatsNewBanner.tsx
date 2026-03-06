import { ArrowRight, Sparkles, X } from 'lucide-react'
import { motion } from 'motion/react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import type { ReleaseNote } from '@/lib/whats-new/whats-new-config'
import { getReleaseNumber } from '@/lib/whats-new/whats-new-config'

interface WhatsNewBannerProps {
  release: ReleaseNote
  onDismiss: () => void
  onOpen: () => void
}

export const WhatsNewBanner: FC<WhatsNewBannerProps> = ({
  release,
  onDismiss,
  onOpen,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-[1.75rem] border border-[var(--accent-orange)]/20 bg-gradient-to-br from-[var(--accent-orange)]/14 via-background to-background p-5 shadow-[0_24px_80px_-40px_rgba(245,121,36,0.65)]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,121,36,0.16),transparent_38%)]" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-orange)] px-3 py-1 font-medium text-primary-foreground text-xs">
              <Sparkles className="size-3.5" />
              What's New
            </span>
            <span className="rounded-full border border-[var(--accent-orange)]/20 bg-background/80 px-3 py-1 font-medium text-[var(--accent-orange)] text-xs">
              Release {getReleaseNumber(release.browserosVersion)}
            </span>
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold text-foreground text-xl">
              BrowserOS v{release.browserosVersion}
            </h2>
            <p className="max-w-2xl text-muted-foreground text-sm leading-6">
              {release.summary}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-4 right-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
          aria-label="Dismiss What's New"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="relative mt-4 flex flex-col gap-3 sm:flex-row">
        <Button onClick={onOpen} className="rounded-xl">
          See what's new
          <ArrowRight className="size-4" />
        </Button>
        <Button variant="outline" onClick={onDismiss} className="rounded-xl">
          Dismiss
        </Button>
      </div>
    </motion.div>
  )
}
