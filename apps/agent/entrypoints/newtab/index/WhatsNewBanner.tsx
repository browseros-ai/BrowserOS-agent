import { ArrowRight, Sparkles, X } from 'lucide-react'
import { motion } from 'motion/react'
import type { FC } from 'react'
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center justify-center"
    >
      <div className="group relative flex w-full max-w-xl items-center gap-1.5 rounded-2xl border border-[var(--accent-orange)]/18 bg-background/92 px-2.5 py-2 shadow-[0_18px_50px_-34px_rgba(245,121,36,0.55)] backdrop-blur">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-[1rem] px-2.5 py-2 text-left transition-colors hover:bg-[var(--accent-orange)]/6"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-orange)]/12 text-[var(--accent-orange)] shadow-[0_0_0_4px_rgba(245,121,36,0.08)]">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-[var(--accent-orange)] text-xs">
                What's new in this version
              </span>
              <span className="rounded-full border border-[var(--accent-orange)]/15 bg-[var(--accent-orange)]/8 px-2 py-0.5 font-medium text-[10px] text-[var(--accent-orange)] uppercase tracking-[0.16em]">
                Release {getReleaseNumber(release.browserosVersion)}
              </span>
            </div>
            <p className="truncate text-foreground text-sm">
              {release.summary}
            </p>
          </div>
          <span className="hidden shrink-0 items-center gap-1 font-semibold text-[var(--accent-orange)] text-xs sm:inline-flex">
            Open
            <ArrowRight className="size-3.5" />
          </span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss What's New"
        >
          <X className="size-4" />
        </button>
      </div>
    </motion.div>
  )
}
