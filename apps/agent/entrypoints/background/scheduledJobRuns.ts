import { createAlarmFromJob } from '@/lib/schedules/createAlarmFromJob'
import { getChatServerResponse } from '@/lib/schedules/getChatServerResponse'
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

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    const jobId = alarm.name.replace('scheduled-job-', '')

    const job = (await scheduledJobStorage.getValue()).find(
      (each) => each.id === jobId,
    )

    if (job) {
      try {
        await getChatServerResponse({
          message: job.query,
        })
        // console.log(response.text)
      } catch (_e) {
        // console.error('Error executing scheduled job:', e)
      }
    } else {
      // console.error('job not found')
    }
  })

  chrome.runtime.onStartup.addListener(async () => {
    await syncAlarmState()
  })

  chrome.runtime.onInstalled.addListener(async () => {
    await syncAlarmState()
  })
}
