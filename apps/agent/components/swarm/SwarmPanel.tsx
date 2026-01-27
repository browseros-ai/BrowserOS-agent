/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmPanel - Compact visualization for active swarm (matches existing UI patterns)
 */
import type { FC } from 'react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SwarmState, SwarmStatus } from './types'
import {
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  Square,
} from 'lucide-react'

interface SwarmPanelProps {
  swarm: SwarmState
  onTerminate?: () => void
  className?: string
}

const statusLabels: Record<SwarmStatus, string> = {
  idle: 'Idle',
  planning: 'Planning...',
  spawning: 'Spawning workers...',
  executing: 'Executing...',
  aggregating: 'Aggregating...',
  completed: 'Completed',
  failed: 'Failed',
  terminated: 'Terminated',
}

/**
 * Compact swarm progress panel that fits in the chat UI.
 */
export const SwarmPanel: FC<SwarmPanelProps> = ({
  swarm,
  onTerminate,
  className,
}) => {
  const isActive = ['planning', 'spawning', 'executing', 'aggregating'].includes(swarm.status)
  const isCompleted = swarm.status === 'completed'
  const isFailed = swarm.status === 'failed'

  const completedWorkers = swarm.workers.filter(w => w.status === 'completed').length
  const totalWorkers = swarm.workers.length

  const duration = swarm.completedAt
    ? Math.round((swarm.completedAt - swarm.startedAt) / 1000)
    : Math.round((Date.now() - swarm.startedAt) / 1000)

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2',
        isActive && 'border-[var(--accent-orange)]/30 bg-[var(--accent-orange)]/5',
        isCompleted && 'border-green-500/30 bg-green-500/5',
        isFailed && 'border-red-500/30 bg-red-500/5',
        !isActive && !isCompleted && !isFailed && 'border-border/50 bg-muted/50',
        className,
      )}
    >
      {/* Status icon */}
      <div className="flex-shrink-0">
        {isActive && (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--accent-orange)]" />
        )}
        {isCompleted && <CheckCircle className="h-4 w-4 text-green-500" />}
        {isFailed && <XCircle className="h-4 w-4 text-red-500" />}
        {!isActive && !isCompleted && !isFailed && (
          <Zap className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium truncate">
            {statusLabels[swarm.status]}
          </span>
          <span className="text-muted-foreground ml-2">
            {completedWorkers}/{totalWorkers} • {duration}s
          </span>
        </div>
        <Progress value={swarm.progress} className="mt-1 h-1" />
      </div>

      {/* Workers dots */}
      <TooltipProvider delayDuration={0}>
        <div className="flex gap-0.5">
          {swarm.workers.slice(0, 8).map((worker) => (
            <Tooltip key={worker.id}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'h-2 w-2 rounded-full',
                    worker.status === 'executing' && 'bg-[var(--accent-orange)] animate-pulse',
                    worker.status === 'completed' && 'bg-green-500',
                    worker.status === 'failed' && 'bg-red-500',
                    worker.status === 'pending' && 'bg-muted-foreground/30',
                    worker.status === 'spawning' && 'bg-yellow-500',
                    worker.status === 'ready' && 'bg-blue-500',
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Worker {worker.id.slice(-2)}: {worker.status}
                {worker.progress > 0 && ` (${worker.progress}%)`}
              </TooltipContent>
            </Tooltip>
          ))}
          {swarm.workers.length > 8 && (
            <span className="text-xs text-muted-foreground">
              +{swarm.workers.length - 8}
            </span>
          )}
        </div>
      </TooltipProvider>

      {/* Stop button */}
      {isActive && onTerminate && (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onTerminate}
                className="flex-shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Square className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Stop swarm</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
