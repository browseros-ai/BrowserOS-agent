/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * SwarmPanel - Main visualization panel for AI Swarm Mode
 */
import type { FC } from 'react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { SwarmWorkerCard } from './SwarmWorkerCard'
import type { SwarmState, SwarmStatus } from './types'
import {
  ChevronDown,
  ChevronUp,
  Grid,
  Layers,
  PanelTop,
  Play,
  Square,
  Loader2,
  CheckCircle,
  XCircle,
  Zap,
} from 'lucide-react'

interface SwarmPanelProps {
  swarm: SwarmState
  onTerminate?: () => void
  onArrange?: (layout: 'grid' | 'cascade' | 'tile') => void
  onFocusWorker?: (workerId: string) => void
  onTerminateWorker?: (workerId: string) => void
  className?: string
}

const statusConfig: Record<SwarmStatus, { label: string; color: string; icon: FC<{ className?: string }> }> = {
  idle: { label: 'Idle', color: 'bg-gray-500', icon: Square },
  planning: { label: 'Planning', color: 'bg-blue-500', icon: Loader2 },
  spawning: { label: 'Spawning Workers', color: 'bg-yellow-500', icon: Loader2 },
  executing: { label: 'Executing', color: 'bg-purple-500', icon: Play },
  aggregating: { label: 'Aggregating Results', color: 'bg-indigo-500', icon: Layers },
  completed: { label: 'Completed', color: 'bg-green-500', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-500', icon: XCircle },
  terminated: { label: 'Terminated', color: 'bg-gray-400', icon: Square },
}

/**
 * @public
 */
export const SwarmPanel: FC<SwarmPanelProps> = ({
  swarm,
  onTerminate,
  onArrange,
  onFocusWorker,
  onTerminateWorker,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(true)
  const [workerView, setWorkerView] = useState<'compact' | 'expanded'>('compact')

  const config = statusConfig[swarm.status]
  const StatusIcon = config.icon
  const isActive = ['planning', 'spawning', 'executing', 'aggregating'].includes(swarm.status)
  const isCompleted = swarm.status === 'completed'
  const isFailed = swarm.status === 'failed'

  const completedWorkers = swarm.workers.filter(w => w.status === 'completed').length
  const failedWorkers = swarm.workers.filter(w => w.status === 'failed').length
  const activeWorkers = swarm.workers.filter(w => w.status === 'executing').length

  const duration = swarm.completedAt
    ? Math.round((swarm.completedAt - swarm.startedAt) / 1000)
    : Math.round((Date.now() - swarm.startedAt) / 1000)

  return (
    <Card
      className={cn(
        'transition-all',
        isActive && 'border-purple-500/50 shadow-purple-500/10 shadow-lg',
        isCompleted && 'border-green-500/50',
        isFailed && 'border-red-500/50',
        className,
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  isActive && 'bg-purple-500/10',
                  isCompleted && 'bg-green-500/10',
                  isFailed && 'bg-red-500/10',
                  !isActive && !isCompleted && !isFailed && 'bg-muted',
                )}
              >
                <Zap
                  className={cn(
                    'h-5 w-5',
                    isActive && 'text-purple-500 animate-pulse',
                    isCompleted && 'text-green-500',
                    isFailed && 'text-red-500',
                    !isActive && !isCompleted && !isFailed && 'text-muted-foreground',
                  )}
                />
              </div>
              <div>
                <CardTitle className="text-base">AI Swarm</CardTitle>
                <CardDescription className="text-xs line-clamp-1">
                  {swarm.task}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn('text-xs', config.color, 'text-white')}
              >
                <StatusIcon
                  className={cn('h-3 w-3 mr-1', isActive && 'animate-spin')}
                />
                {config.label}
              </Badge>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {completedWorkers}/{swarm.workers.length} workers
                {activeWorkers > 0 && ` (${activeWorkers} active)`}
                {failedWorkers > 0 && ` (${failedWorkers} failed)`}
              </span>
              <span>{swarm.progress}% • {duration}s</span>
            </div>
            <Progress value={swarm.progress} className="h-2" />
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Action buttons */}
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setWorkerView(workerView === 'compact' ? 'expanded' : 'compact')}
                >
                  {workerView === 'compact' ? 'Expand' : 'Compact'}
                </Button>
                {onArrange && (
                  <div className="flex items-center gap-0.5 border rounded-md">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onArrange('grid')}
                      title="Grid layout"
                    >
                      <Grid className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onArrange('cascade')}
                      title="Cascade layout"
                    >
                      <Layers className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onArrange('tile')}
                      title="Tile layout"
                    >
                      <PanelTop className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              {isActive && onTerminate && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={onTerminate}
                >
                  <Square className="h-3 w-3 mr-1" />
                  Stop Swarm
                </Button>
              )}
            </div>

            {/* Workers grid */}
            {workerView === 'compact' ? (
              <div className="flex flex-wrap gap-2">
                {swarm.workers.map((worker) => (
                  <SwarmWorkerCard
                    key={worker.id}
                    worker={worker}
                    compact
                    onFocus={onFocusWorker}
                    onTerminate={onTerminateWorker}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {swarm.workers.map((worker) => (
                  <SwarmWorkerCard
                    key={worker.id}
                    worker={worker}
                    onFocus={onFocusWorker}
                    onTerminate={onTerminateWorker}
                  />
                ))}
              </div>
            )}

            {/* Result preview */}
            {swarm.result && (
              <div className="mt-4 rounded-lg bg-muted p-3">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Result Preview
                </div>
                <p className="text-sm line-clamp-4">{swarm.result}</p>
              </div>
            )}

            {/* Error message */}
            {swarm.error && (
              <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                <div className="text-xs font-medium text-red-500 mb-1">
                  Error
                </div>
                <p className="text-sm text-red-500">{swarm.error}</p>
              </div>
            )}

            {/* Metrics */}
            {swarm.metrics && (
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {swarm.metrics.totalDurationMs && (
                  <div className="rounded-lg bg-muted p-2">
                    <div className="text-lg font-semibold">
                      {(swarm.metrics.totalDurationMs / 1000).toFixed(1)}s
                    </div>
                    <div className="text-xs text-muted-foreground">Duration</div>
                  </div>
                )}
                {swarm.metrics.successRate !== undefined && (
                  <div className="rounded-lg bg-muted p-2">
                    <div className="text-lg font-semibold">
                      {Math.round(swarm.metrics.successRate * 100)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Success</div>
                  </div>
                )}
                <div className="rounded-lg bg-muted p-2">
                  <div className="text-lg font-semibold">{swarm.workers.length}</div>
                  <div className="text-xs text-muted-foreground">Workers</div>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
