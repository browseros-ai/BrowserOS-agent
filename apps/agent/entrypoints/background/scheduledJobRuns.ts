import { createAlarmFromJob } from '@/lib/schedules/createAlarmFromJob'
import { scheduledJobStorage } from '@/lib/schedules/scheduleStorage'

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

  chrome.runtime.onStartup.addListener(async () => {
    await syncAlarmState()
  })

  chrome.runtime.onInstalled.addListener(async () => {
    await syncAlarmState()
  })
}
