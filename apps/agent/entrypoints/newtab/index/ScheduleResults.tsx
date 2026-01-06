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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SCHEDULED_TASK_VIEW_MORE_IN_NEWTAB_EVENT,
  SCHEDULED_TASK_VIEW_RESULTS_IN_NEWTAB_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
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
  const [isOpen, setIsOpen] = useState(true)
  const [viewingRun, setViewingRun] = useState<JobRunWithDetails | null>(null)

  const { jobRuns } = useScheduledJobRuns()
  const { jobs } = useScheduledJobs()

  const runningCount = jobRuns.filter((r) => r.status === 'running').length

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

  const viewRun = (run: JobRunWithDetails) => {
    track(SCHEDULED_TASK_VIEW_RESULTS_IN_NEWTAB_EVENT)
    setViewingRun(run)
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="mb-16 w-xl space-y-3 md:w-3xl"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="group flex h-auto w-full items-center justify-between rounded-xl border border-border/50 bg-card/50 p-3 transition-all hover:border-border hover:bg-card"
        >
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground text-sm">
              Scheduled Task Outputs
            </span>
            {runningCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {runningCount} running
              </Badge>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="fade-in-0 slide-in-from-top-2 animate-in space-y-2 duration-200">
        {displayedRuns.map((run) => (
          <Button
            key={run.id}
            variant="ghost"
            onClick={() => viewRun(run)}
            className="h-auto w-full justify-start rounded-xl border border-border/50 bg-card p-4 text-left transition-all hover:border-border"
          >
            <div className="flex w-full items-start gap-3">
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
                  <p className="line-clamp-2 text-ellipsis text-muted-foreground text-xs">
                    {run.result}
                  </p>
                )}
              </div>
            </div>
          </Button>
        ))}
        <Button variant="ghost" asChild className="w-full">
          {/* biome-ignore lint/a11y/useValidAnchor: click handler is passive */}
          <a
            href="/options.html#/scheduled"
            onClick={() => track(SCHEDULED_TASK_VIEW_MORE_IN_NEWTAB_EVENT)}
          >
            View more
          </a>
        </Button>
      </CollapsibleContent>

      <RunResultDialog
        run={viewingRun}
        jobName={viewingRun?.job?.name}
        onOpenChange={(open) => !open && setViewingRun(null)}
      />
    </Collapsible>
  )
}
