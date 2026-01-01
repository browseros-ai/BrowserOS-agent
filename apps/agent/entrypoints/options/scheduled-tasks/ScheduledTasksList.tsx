import { Loader2 } from 'lucide-react'
import type { FC } from 'react'
import { ScheduledTaskCard } from './ScheduledTaskCard'
import type { ScheduledJob, ScheduledJobRun } from './types'

interface ScheduledTasksListProps {
  jobs: ScheduledJob[]
  isLoading: boolean
  onEdit: (job: ScheduledJob) => void
  onDelete: (jobId: string) => void
  onToggle: (jobId: string, enabled: boolean) => void
  onViewRun: (run: ScheduledJobRun) => void
}

export const ScheduledTasksList: FC<ScheduledTasksListProps> = ({
  jobs,
  isLoading,
  onEdit,
  onDelete,
  onToggle,
  onViewRun,
}) => {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading scheduled tasks...</span>
        </div>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="rounded-lg border border-border border-dashed py-8 text-center">
          <p className="text-muted-foreground text-sm">
            No scheduled tasks yet. Create one to automate recurring workflows.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <ScheduledTaskCard
          key={job.id}
          job={job}
          onEdit={() => onEdit(job)}
          onDelete={() => onDelete(job.id)}
          onToggle={(enabled) => onToggle(job.id, enabled)}
          onViewRun={onViewRun}
        />
      ))}
    </div>
  )
}
