import { Calendar, ChevronDown } from 'lucide-react'
import type { FC } from 'react'
import { useState } from 'react'
import {
  useScheduledJobRuns,
  useScheduledJobs,
} from '@/lib/schedules/scheduleStorage'

export const ScheduleResults: FC = () => {
  const [showSchedulerOutputs, setShowSchedulerOutputs] = useState(false)

  const { jobRuns } = useScheduledJobRuns()

  const { jobs } = useScheduledJobs()

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
    </div>
  )
}
