import { createAlarmFromJob } from '@/lib/schedules/createAlarmFromJob'
import { getChatServerResponse } from '@/lib/schedules/getChatServerResponse'
import {
  scheduledJobRunStorage,
  scheduledJobStorage,
} from '@/lib/schedules/scheduleStorage'
import type { ScheduledJobRun } from '@/lib/schedules/scheduleTypes'

export const scheduledJobRuns = async () => {
  const syncAlarmState = async () => {
    const jobs = (await scheduledJobStorage.getValue()).filter(
      (each) => each.enabled,
    )

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]
      const alarmName = `scheduled-job-${job.id}`
      const existingAlarm = await chrome.alarms.get(alarmName)

      if (!existingAlarm) {
        await createAlarmFromJob(job)
      }
    }
  }

  const createJobRun = async (
    jobId: string,
    status: ScheduledJobRun['status'],
  ): Promise<ScheduledJobRun> => {
    const jobRun: ScheduledJobRun = {
      id: crypto.randomUUID(),
      jobId,
      startedAt: new Date().toISOString(),
      status,
    }
    const current = (await scheduledJobRunStorage.getValue()) ?? []
    await scheduledJobRunStorage.setValue([...current, jobRun])
    return jobRun
  }

  const updateJobRun = async (
    runId: string,
    updates: Partial<Omit<ScheduledJobRun, 'id' | 'jobId' | 'startedAt'>>,
  ) => {
    const current = (await scheduledJobRunStorage.getValue()) ?? []
    await scheduledJobRunStorage.setValue(
      current.map((r) => (r.id === runId ? { ...r, ...updates } : r)),
    )
  }

  const updateJobLastRunAt = async (jobId: string) => {
    const current = (await scheduledJobStorage.getValue()) ?? []
    await scheduledJobStorage.setValue(
      current.map((j) =>
        j.id === jobId ? { ...j, lastRunAt: new Date().toISOString() } : j,
      ),
    )
  }

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (!alarm.name.startsWith('scheduled-job-')) return

    const jobId = alarm.name.replace('scheduled-job-', '')

    const job = (await scheduledJobStorage.getValue()).find(
      (each) => each.id === jobId,
    )

    if (!job) return

    const jobRun = await createJobRun(jobId, 'running')

    try {
      const response = await getChatServerResponse({
        message: job.query,
      })

      await updateJobRun(jobRun.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        result: response.text,
      })
    } catch (e) {
      await updateJobRun(jobRun.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        result: e instanceof Error ? e.message : String(e),
      })
    }

    await updateJobLastRunAt(jobId)
  })

  chrome.runtime.onStartup.addListener(async () => {
    await syncAlarmState()
  })

  chrome.runtime.onInstalled.addListener(async () => {
    await syncAlarmState()
  })
}
