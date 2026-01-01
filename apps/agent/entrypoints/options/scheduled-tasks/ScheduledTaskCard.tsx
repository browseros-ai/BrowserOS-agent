import {
  CheckCircle2,
  ChevronDown,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react'
import { type FC, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Switch } from '@/components/ui/switch'
import { useScheduledJobRuns } from '@/lib/schedules/scheduleStorage'
import type { ScheduledJob, ScheduledJobRun } from './types'

interface ScheduledTaskCardProps {
  job: ScheduledJob
  onEdit: () => void
  onDelete: () => void
  onToggle: (enabled: boolean) => void
  onViewRun: (run: ScheduledJobRun) => void
}

function formatSchedule(job: ScheduledJob): string {
  if (job.scheduleType === 'daily' && job.scheduleTime) {
    return `Daily at ${job.scheduleTime}`
  }
  if (job.scheduleType === 'hourly' && job.scheduleInterval) {
    return job.scheduleInterval === 1
      ? 'Every hour'
      : `Every ${job.scheduleInterval} hours`
  }
  if (job.scheduleType === 'minutes' && job.scheduleInterval) {
    return job.scheduleInterval === 1
      ? 'Every minute'
      : `Every ${job.scheduleInterval} minutes`
  }
  return 'Not scheduled'
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatDuration(startedAt: string, completedAt?: string): string {
  if (!completedAt) return 'Running...'
  const start = new Date(startedAt).getTime()
  const end = new Date(completedAt).getTime()
  const diffMs = end - start
  const diffSecs = Math.floor(diffMs / 1000)
  const mins = Math.floor(diffSecs / 60)
  const secs = diffSecs % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

function formatRunDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export const ScheduledTaskCard: FC<ScheduledTaskCardProps> = ({
  job,
  onEdit,
  onDelete,
  onToggle,
  onViewRun,
}) => {
  const [isOpen, setIsOpen] = useState(false)

  const { jobRuns } = useScheduledJobRuns()

  const runs = useMemo(
    () =>
      jobRuns
        .filter((run) => run.jobId === job.id)
        .sort(
          (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
        ),
    [jobRuns, job.id],
  )

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-[var(--accent-orange)]/50 hover:shadow-sm">
      <div className="flex items-start gap-4">
        <Switch
          checked={job.enabled}
          onCheckedChange={onToggle}
          aria-label={`${job.enabled ? 'Disable' : 'Enable'} ${job.name}`}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="truncate font-semibold">{job.name}</span>
            {!job.enabled && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs">
                Disabled
              </span>
            )}
          </div>
          <p className="mb-2 line-clamp-1 text-muted-foreground text-sm">
            "{job.query}"
          </p>
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <span>{formatSchedule(job)}</span>
            {job.lastRunAt && (
              <>
                <span>•</span>
                <span>Last run: {formatRelativeTime(job.lastRunAt)}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-1.5 h-3 w-3" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete ${job.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {runs.length > 0 && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
          <CollapsibleTrigger className="flex w-full items-center gap-2 text-muted-foreground text-sm hover:text-foreground">
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
            <span>Run History ({runs.length})</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                >
                  {run.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  ) : run.status === 'failed' ? (
                    <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="text-sm">
                      {formatRunDate(run.startedAt)}
                    </span>
                    <span className="ml-2 text-muted-foreground text-xs">
                      {formatDuration(run.startedAt, run.completedAt)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewRun(run)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}
