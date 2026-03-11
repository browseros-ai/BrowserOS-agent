import { Sparkles } from 'lucide-react'
import type { FC } from 'react'

export const SoulHeader: FC = () => {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-orange)]/10">
          <Sparkles className="h-6 w-6 text-[var(--accent-orange)]" />
        </div>
        <div className="flex-1">
          <h2 className="mb-1 font-semibold text-xl">Agent Soul</h2>
          <p className="text-muted-foreground text-sm">
            Your agent's personality, tone, and behavioral rules. The soul
            evolves as BrowserOS learns how you like to work, write, and make
            decisions.
          </p>
        </div>
      </div>
    </div>
  )
}
