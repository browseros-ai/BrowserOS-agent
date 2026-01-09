import { onScheduleMessage } from '@/lib/messaging/schedules/scheduleMessages'
import { createAlarmFromJob } from '@/lib/schedules/createAlarmFromJob'
import { getChatServerResponse } from '@/lib/schedules/getChatServerResponse'
import {
  scheduledJobRunStorage,
  scheduledJobStorage,
} from '@/lib/schedules/scheduleStorage'
import type { ScheduledJobRun } from '@/lib/schedules/scheduleTypes'

const MAX_RUNS_PER_JOB = 15
const STALE_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

export const scheduledJobRuns = async () => {
  const cleanupStaleJobRuns = async () => {
    const current = (await scheduledJobRunStorage.getValue()) ?? []
    const now = Date.now()

    const updated = current.map((run) => {
      if (run.status !== 'running') return run

      const startedAt = new Date(run.startedAt).getTime()
      if (now - startedAt > STALE_TIMEOUT_MS) {
        return {
          ...run,
          status: 'failed' as const,
          completedAt: new Date().toISOString(),
          result: 'Job timed out!',
        }
      }
      return run
    })

    await scheduledJobRunStorage.setValue(updated)
  }

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
    const otherJobRuns = current.filter((r) => r.jobId !== jobId)
    const thisJobRuns = current
      .filter((r) => r.jobId === jobId)
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
      .slice(0, MAX_RUNS_PER_JOB - 1)

    await scheduledJobRunStorage.setValue([
      ...otherJobRuns,
      ...thisJobRuns,
      jobRun,
    ])
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

  const executeScheduledJob = async (jobId: string): Promise<void> => {
    const job = (await scheduledJobStorage.getValue()).find(
      (each) => each.id === jobId,
    )

    if (!job) {
      throw new Error(`Job not found: ${jobId}`)
    }

    const backgroundWindow = await chrome.windows.create({
      url: 'chrome://newtab',
      focused: false,
      state: 'minimized',
      type: 'normal',
    })

    // FIXME: Race condition - the controller-ext extension sends a window_created
    // WebSocket message to register window ownership, but our HTTP request may arrive
    // at the server before that registration completes. This delay is a temporary fix.
    // Proper solution: ControllerBridge should wait/poll for window ownership registration.
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const backgroundTab = backgroundWindow?.tabs?.[0]

    if (!backgroundWindow || !backgroundTab) {
      throw new Error('Failed to create background window')
    }

    const jobRun = await createJobRun(jobId, 'running')

    try {
      const response = await getChatServerResponse({
        message: job.query,
        activeTab: backgroundTab,
        windowId: backgroundWindow.id,
      })

      await updateJobRun(jobRun.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        result: response.text,
        finalResult: response.finalResult,
        executionLog: response.executionLog,
        toolCalls: response.toolCalls,
      })
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      await updateJobRun(jobRun.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        result: errorMessage,
        error: errorMessage,
      })
    } finally {
      await updateJobLastRunAt(jobId)
      if (backgroundWindow.id) {
        await chrome.windows.remove(backgroundWindow.id)
      }
    }
  }

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (!alarm.name.startsWith('scheduled-job-')) return
    const jobId = alarm.name.replace('scheduled-job-', '')
    await executeScheduledJob(jobId)
  })

  onScheduleMessage('runScheduledJob', async ({ data }) => {
    try {
      await executeScheduledJob(data.jobId)
      return { success: true }
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  })

  chrome.runtime.onStartup.addListener(async () => {
    await cleanupStaleJobRuns()
    await syncAlarmState()
  })

  chrome.runtime.onInstalled.addListener(async () => {
    await cleanupStaleJobRuns()
    await syncAlarmState()
  })
}
