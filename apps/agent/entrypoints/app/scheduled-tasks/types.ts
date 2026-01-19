import type {
  ScheduledJob,
  ScheduledJobRun,
} from '@/lib/schedules/scheduleTypes'

export type { ScheduledJob, ScheduledJobRun }

export interface ScheduledTasksStorage {
  loadJobs(): Promise<ScheduledJob[]>
  saveJobs(jobs: ScheduledJob[]): Promise<void>
  loadRuns(): Promise<ScheduledJobRun[]>
  saveRuns(runs: ScheduledJobRun[]): Promise<void>
}
