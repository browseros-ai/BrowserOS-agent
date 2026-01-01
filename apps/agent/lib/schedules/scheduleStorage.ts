import { storage } from '@wxt-dev/storage'
import { useEffect, useState } from 'react'
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

export function useScheduledJobs() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([])

  useEffect(() => {
    scheduledJobStorage.getValue().then(setJobs)
    const unwatch = scheduledJobStorage.watch((newValue) => {
      setJobs(newValue ?? [])
    })
    return unwatch
  }, [])

  const addJob = async (job: Omit<ScheduledJob, 'id' | 'createdAt'>) => {
    const newJob = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...job,
    }
    const current = (await scheduledJobStorage.getValue()) ?? []
    await scheduledJobStorage.setValue([...current, newJob])
  }

  const removeJob = async (id: string) => {
    const current = (await scheduledJobStorage.getValue()) ?? []
    await scheduledJobStorage.setValue(current.filter((j) => j.id !== id))
  }

  const toggleJob = async (id: string, enabled: boolean) => {
    const current = (await scheduledJobStorage.getValue()) ?? []
    await scheduledJobStorage.setValue(
      current.map((j) => (j.id === id ? { ...j, enabled } : j)),
    )
  }

  const editJob = async (
    id: string,
    updates: Omit<ScheduledJob, 'id' | 'createdAt'>,
  ) => {
    const current = (await scheduledJobStorage.getValue()) ?? []
    const updatedJob = {
      id,
      createdAt: new Date().toISOString(),
      ...updates,
    }
    await scheduledJobStorage.setValue(
      current.map((j) => (j.id === id ? updatedJob : j)),
    )
  }

  return { jobs, addJob, removeJob, editJob, toggleJob }
}

export function useScheduledJobRuns() {
  const [jobRuns, setJobRuns] = useState<ScheduledJobRun[]>([])

  useEffect(() => {
    scheduledJobRunStorage.getValue().then(setJobRuns)
    const unwatch = scheduledJobRunStorage.watch((newValue) => {
      setJobRuns(newValue ?? [])
    })
    return unwatch
  }, [])

  const addJobRun = async (jobRun: ScheduledJobRun) => {
    const current = (await scheduledJobRunStorage.getValue()) ?? []
    await scheduledJobRunStorage.setValue([...current, jobRun])
  }

  const removeJobRun = async (id: string) => {
    const current = (await scheduledJobRunStorage.getValue()) ?? []
    await scheduledJobRunStorage.setValue(current.filter((r) => r.id !== id))
  }

  const editJobRun = async (
    id: string,
    updates: Partial<Omit<ScheduledJobRun, 'id'>>,
  ) => {
    const current = (await scheduledJobRunStorage.getValue()) ?? []
    await scheduledJobRunStorage.setValue(
      current.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    )
  }

  return { jobRuns, addJobRun, removeJobRun, editJobRun }
}
