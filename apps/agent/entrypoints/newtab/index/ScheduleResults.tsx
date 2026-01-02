import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  XCircle,
} from 'lucide-react'
import type { FC } from 'react'
import { useMemo, useState } from 'react'
import { RunResultDialog } from '@/components/ai-elements/run-result-dialog'
import {
  useScheduledJobRuns,
  useScheduledJobs,
} from '@/lib/schedules/scheduleStorage'
import type {
  ScheduledJob,
  ScheduledJobRun,
} from '@/lib/schedules/scheduleTypes'

dayjs.extend(relativeTime)

interface JobRunWithDetails extends ScheduledJobRun {
  job: ScheduledJob | undefined
}

const MAX_DISPLAY_COUNT = 3

const getStatusIcon = (status: JobRunWithDetails['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'running':
      return <Loader2 className="h-4 w-4 animate-spin text-accent-orange" />
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive" />
  }
}

const formatTimestamp = (dateString: string) => dayjs(dateString).fromNow()

export const ScheduleResults: FC = () => {
  const [showSchedulerOutputs, setShowSchedulerOutputs] = useState(false)
  const [viewingRun, setViewingRun] = useState<JobRunWithDetails | null>(null)

  const { jobRuns } = useScheduledJobRuns()
  const { jobs } = useScheduledJobs()

  const displayedRuns: JobRunWithDetails[] = useMemo(() => {
    const enrichWithJob = (run: ScheduledJobRun): JobRunWithDetails => ({
      ...run,
      job: jobs.find((j) => j.id === run.jobId),
    })

    const runningJobs = jobRuns
      .filter((r) => r.status === 'running')
      .map(enrichWithJob)

    if (runningJobs.length >= MAX_DISPLAY_COUNT) {
      return runningJobs
    }

    const completedOrFailed = jobRuns
      .filter((r) => r.status === 'completed' || r.status === 'failed')
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
      .slice(0, MAX_DISPLAY_COUNT - runningJobs.length)
      .map(enrichWithJob)

    return [...runningJobs, ...completedOrFailed]
  }, [jobRuns, jobs])

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowSchedulerOutputs(!showSchedulerOutputs)}
        className="group flex w-full items-center justify-between rounded-xl border border-border/50 bg-card/50 p-3 transition-all hover:border-border hover:bg-card"
      >
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground text-sm">
            Scheduler Outputs
          </span>
          <span className="text-muted-foreground text-xs">
            ({jobRuns.filter((r) => r.status === 'running').length} running)
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${showSchedulerOutputs ? 'rotate-180' : ''}`}
        />
      </button>

      {showSchedulerOutputs && (
        <div className="fade-in-0 slide-in-from-top-2 animate-in space-y-2 duration-200">
          {displayedRuns.map((run) => (
            <button
              type="button"
              key={run.id}
              onClick={() => setViewingRun(run)}
              className="w-full cursor-pointer rounded-xl border border-border/50 bg-card p-4 text-left transition-all hover:border-border"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-1 items-start gap-3">
                  {getStatusIcon(run.status)}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="truncate font-medium text-foreground text-sm">
                        {run.job?.name}
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground text-xs">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(run.startedAt)}
                      </span>
                    </div>
                    {run.result && (
                      <p className="line-clamp-2 text-muted-foreground text-xs">
                        {run.result}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <RunResultDialog
        run={viewingRun}
        jobName={viewingRun?.job?.name}
        onOpenChange={(open) => !open && setViewingRun(null)}
      />
    </div>
  )
}
