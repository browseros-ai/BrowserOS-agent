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
