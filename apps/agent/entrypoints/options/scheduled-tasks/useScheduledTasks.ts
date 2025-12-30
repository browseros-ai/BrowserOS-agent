import { useEffect, useState } from 'react'
import { mockStorage } from './storage.mock'
import type {
  ScheduledJob,
  ScheduledJobRun,
  ScheduledTasksStorage,
} from './types'

export interface UseScheduledTasksReturn {
  jobs: ScheduledJob[]
  isLoading: boolean
  createJob: (data: Omit<ScheduledJob, 'id' | 'createdAt'>) => Promise<void>
  updateJob: (id: string, data: Partial<ScheduledJob>) => Promise<void>
  deleteJob: (id: string) => Promise<void>
  getRunsForJob: (jobId: string) => ScheduledJobRun[]
}

export function useScheduledTasks(
  storage: ScheduledTasksStorage = mockStorage,
): UseScheduledTasksReturn {
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [runs, setRuns] = useState<ScheduledJobRun[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      const [loadedJobs, loadedRuns] = await Promise.all([
        storage.loadJobs(),
        storage.loadRuns(),
      ])
      setJobs(loadedJobs)
      setRuns(loadedRuns)
      setIsLoading(false)
    }
    load()
  }, [storage])

  const createJob = async (data: Omit<ScheduledJob, 'id' | 'createdAt'>) => {
    const newJob: ScheduledJob = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }
    const updated = [...jobs, newJob]
    setJobs(updated)
    await storage.saveJobs(updated)
  }

  const updateJob = async (id: string, data: Partial<ScheduledJob>) => {
    const updated = jobs.map((job) =>
      job.id === id ? { ...job, ...data } : job,
    )
    setJobs(updated)
    await storage.saveJobs(updated)
  }

  const deleteJob = async (id: string) => {
    const updatedJobs = jobs.filter((job) => job.id !== id)
    const updatedRuns = runs.filter((run) => run.jobId !== id)
    setJobs(updatedJobs)
    setRuns(updatedRuns)
    await Promise.all([
      storage.saveJobs(updatedJobs),
      storage.saveRuns(updatedRuns),
    ])
  }

  const getRunsForJob = (jobId: string) => {
    return runs
      .filter((r) => r.jobId === jobId)
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
      .slice(0, 10)
  }

  return {
    jobs,
    isLoading,
    createJob,
    updateJob,
    deleteJob,
    getRunsForJob,
  }
}
