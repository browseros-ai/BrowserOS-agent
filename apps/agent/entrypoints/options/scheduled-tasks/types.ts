// TODO: WIP -- this needs to implemented still. Just creating rough UI as of now.
export interface ScheduledJob {
  id: string
  name: string
  query: string
  scheduleType: 'daily' | 'hourly' | 'minutes'
  scheduleTime?: string
  scheduleInterval?: number
  enabled: boolean
  createdAt: string
  lastRunAt?: string
}

export interface ScheduledJobRun {
  id: string
  jobId: string
  startedAt: string
  completedAt?: string
  status: 'running' | 'completed' | 'failed'
  result?: string
}

export interface ScheduledTasksStorage {
  loadJobs(): Promise<ScheduledJob[]>
  saveJobs(jobs: ScheduledJob[]): Promise<void>
  loadRuns(): Promise<ScheduledJobRun[]>
  saveRuns(runs: ScheduledJobRun[]): Promise<void>
}
