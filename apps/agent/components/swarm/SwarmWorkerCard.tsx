/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmWorkerCard - Small inline worker indicator (matches existing patterns)
 */
import type { FC } from 'react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SwarmWorker, WorkerStatus } from './types'
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Zap,
} from 'lucide-react'

interface SwarmWorkerCardProps {
  worker: SwarmWorker
  compact?: boolean
  onFocus?: (workerId: string) => void
  onTerminate?: (workerId: string) => void
}

const statusConfig: Record<WorkerStatus, { icon: FC<{ className?: string }>; color: string }> = {
  pending: { icon: Clock, color: 'text-muted-foreground' },
  spawning: { icon: Loader2, color: 'text-yellow-500' },
  ready: { icon: Zap, color: 'text-blue-500' },
  executing: { icon: Loader2, color: 'text-[var(--accent-orange)]' },
  completed: { icon: CheckCircle, color: 'text-green-500' },
  failed: { icon: XCircle, color: 'text-red-500' },
  terminated: { icon: XCircle, color: 'text-muted-foreground' },
}

/**
 * Small worker indicator that can be shown inline.
 */
export const SwarmWorkerCard: FC<SwarmWorkerCardProps> = ({
  worker,
  compact = true,
  onFocus,
}) => {
  const config = statusConfig[worker.status]
  const Icon = config.icon
  const isActive = worker.status === 'executing' || worker.status === 'spawning'

  const duration = worker.completedAt && worker.startedAt
    ? Math.round((worker.completedAt - worker.startedAt) / 1000)
    : worker.startedAt
    ? Math.round((Date.now() - worker.startedAt) / 1000)
    : 0

  if (compact) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onFocus?.(worker.id)}
              className={cn(
                'flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors',
                'hover:bg-muted',
                worker.status === 'failed' && 'bg-red-500/10',
                worker.status === 'completed' && 'bg-green-500/10',
                isActive && 'bg-[var(--accent-orange)]/10',
              )}
            >
              <Icon
                className={cn('h-3 w-3', config.color, isActive && 'animate-spin')}
              />
              <span className="text-muted-foreground">
                #{worker.id.slice(-2)}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-[200px]">
            <div className="font-medium">{worker.task}</div>
            <div className="text-muted-foreground">
              {worker.status} • {duration}s
              {worker.progress > 0 && ` • ${worker.progress}%`}
            </div>
            {worker.error && (
              <div className="text-red-400 mt-1 truncate">{worker.error}</div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Expanded view
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded border px-2 py-1.5',
        'border-border/50 bg-muted/30',
        worker.status === 'failed' && 'border-red-500/30 bg-red-500/5',
        worker.status === 'completed' && 'border-green-500/30 bg-green-500/5',
        isActive && 'border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/5',
      )}
    >
      <Icon
        className={cn('h-4 w-4 flex-shrink-0', config.color, isActive && 'animate-spin')}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{worker.task}</div>
        <div className="text-xs text-muted-foreground">
          {worker.status} • {duration}s
        </div>
      </div>
      {onFocus && (
        <button
          type="button"
          onClick={() => onFocus(worker.id)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Focus
        </button>
      )}
    </div>
  )
}
