/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmTrigger - Toggle button for swarm mode (matches ChatModeToggle style)
 */

import { Users } from 'lucide-react'
import type { FC } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SwarmTriggerProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  workerCount?: number
  className?: string
}

/**
 * Simple toggle button for enabling swarm mode.
 * Matches the ChatModeToggle visual style.
 */
export const SwarmTrigger: FC<SwarmTriggerProps> = ({
  enabled,
  onToggle,
  workerCount = 3,
  className,
}) => {
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onToggle(!enabled)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 font-medium text-xs transition-all',
              enabled
                ? 'border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/10 text-[var(--accent-orange)]'
                : 'border-border/50 bg-muted text-muted-foreground hover:text-foreground',
              className,
            )}
          >
            <Users className="h-3 w-3" />
            <span>{enabled ? `Swarm ×${workerCount}` : 'Swarm'}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          {enabled
            ? `Spawns ${workerCount} parallel AI agents`
            : 'Enable parallel AI agents for complex tasks'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
