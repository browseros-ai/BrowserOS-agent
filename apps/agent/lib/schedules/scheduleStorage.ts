import type { ScheduledJob, ScheduledJobRun } from './scheduleTypes'

export const scheduledJobStorage = storage.defineItem<ScheduledJob[]>(
  'local:scheduledJobs',
  {
    fallback: [],
  },
)

export const scheduledJobRunStorage = storage.defineItem<ScheduledJobRun[]>(
  'local:scheduledJobRuns',
  {
    fallback: [],
  },
)
