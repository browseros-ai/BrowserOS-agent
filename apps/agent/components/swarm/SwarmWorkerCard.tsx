/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmWorkerCard - Visual representation of a single swarm worker
 */
import type { FC } from 'react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SwarmWorker, WorkerStatus } from './types'
import {
  Monitor,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Play,
  Square,
  ExternalLink,
} from 'lucide-react'

interface SwarmWorkerCardProps {
  worker: SwarmWorker
  onFocus?: (workerId: string) => void
  onTerminate?: (workerId: string) => void
  compact?: boolean
}

const statusConfig: Record<WorkerStatus, { label: string; color: string; icon: FC<{ className?: string }> }> = {
  pending: { label: 'Pending', color: 'bg-gray-500', icon: Clock },
  spawning: { label: 'Spawning', color: 'bg-yellow-500', icon: Loader2 },
  ready: { label: 'Ready', color: 'bg-blue-500', icon: Monitor },
  executing: { label: 'Executing', color: 'bg-purple-500', icon: Play },
  completed: { label: 'Completed', color: 'bg-green-500', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-500', icon: XCircle },
  terminated: { label: 'Terminated', color: 'bg-gray-400', icon: Square },
}

/**
 * @public
 */
export const SwarmWorkerCard: FC<SwarmWorkerCardProps> = ({
  worker,
  onFocus,
  onTerminate,
  compact = false,
}) => {
  const config = statusConfig[worker.status]
  const StatusIcon = config.icon
  const isActive = worker.status === 'executing' || worker.status === 'spawning'
  const isCompleted = worker.status === 'completed'
  const isFailed = worker.status === 'failed'

  const duration = worker.completedAt && worker.startedAt
    ? Math.round((worker.completedAt - worker.startedAt) / 1000)
    : worker.startedAt
    ? Math.round((Date.now() - worker.startedAt) / 1000)
    : 0

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onFocus?.(worker.id)}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg border transition-all',
                isActive && 'animate-pulse border-purple-500 bg-purple-500/10',
                isCompleted && 'border-green-500 bg-green-500/10',
                isFailed && 'border-red-500 bg-red-500/10',
                !isActive && !isCompleted && !isFailed && 'border-muted-foreground/20 bg-muted/50',
              )}
            >
              <StatusIcon
                className={cn(
                  'h-5 w-5',
                  isActive && 'animate-spin text-purple-500',
                  isCompleted && 'text-green-500',
                  isFailed && 'text-red-500',
                  !isActive && !isCompleted && !isFailed && 'text-muted-foreground',
                )}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <div className="font-semibold">Worker {worker.id.slice(-4)}</div>
              <div className="text-xs text-muted-foreground">{worker.task || 'No task assigned'}</div>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="secondary" className="text-xs">{config.label}</Badge>
                <span>{worker.progress}%</span>
                <span>{duration}s</span>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-3 transition-all',
        isActive && 'border-purple-500 bg-purple-500/5',
        isCompleted && 'border-green-500/50 bg-green-500/5',
        isFailed && 'border-red-500/50 bg-red-500/5',
        !isActive && !isCompleted && !isFailed && 'border-muted-foreground/20',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon
            className={cn(
              'h-4 w-4',
              isActive && 'animate-spin text-purple-500',
              isCompleted && 'text-green-500',
              isFailed && 'text-red-500',
            )}
          />
          <span className="text-sm font-medium">Worker {worker.id.slice(-4)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className={cn('text-xs', config.color, 'text-white')}>
            {config.label}
          </Badge>
          {worker.windowId && (
            <button
              type="button"
              onClick={() => onFocus?.(worker.id)}
              className="p-1 hover:bg-muted rounded"
            >
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Task */}
      {worker.task && (
        <p className="text-xs text-muted-foreground line-clamp-2">{worker.task}</p>
      )}

      {/* Progress */}
      {(isActive || worker.progress > 0) && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span>{worker.progress}%</span>
          </div>
          <Progress value={worker.progress} className="h-1.5" />
        </div>
      )}

      {/* Duration */}
      {duration > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{duration}s</span>
        </div>
      )}

      {/* Error */}
      {worker.error && (
        <div className="text-xs text-red-500 bg-red-500/10 rounded p-2">
          {worker.error}
        </div>
      )}

      {/* Result preview */}
      {worker.result && (
        <div className="text-xs text-muted-foreground bg-muted rounded p-2 line-clamp-2">
          {worker.result.slice(0, 100)}...
        </div>
      )}
    </div>
  )
}
