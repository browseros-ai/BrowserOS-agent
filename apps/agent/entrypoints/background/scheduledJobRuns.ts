import { scheduledJobStorage } from '@/lib/schedules/scheduleStorage'

export const scheduledJobRuns = async () => {
  const getNextScheduledTime = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number)
    const now = new Date()
    const scheduled = new Date()

    scheduled.setHours(hours, minutes, 0, 0)

    // If time has passed today, schedule for tomorrow
    if (scheduled.getTime() <= now.getTime()) {
      scheduled.setDate(scheduled.getDate() + 1)
    }

    return scheduled.getTime()
  }

  const syncAlarmState = async () => {
    const jobs = await scheduledJobStorage.getValue()

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]
      const alarmName = `scheduled-job-${job.id}`
      const existingAlarm = await chrome.alarms.get(alarmName)

      if (!existingAlarm) {
        let time: chrome.alarms.AlarmCreateInfo | undefined

        if (job.scheduleType === 'daily') {
          time = {
            when: getNextScheduledTime(job.scheduleTime!),
            periodInMinutes: 24 * 60, // Repeat every 24 hours
          }
        } else if (job.scheduleType === 'hourly') {
          const intervalInMinutes = job.scheduleInterval! * 60
          time = {
            delayInMinutes: intervalInMinutes,
            periodInMinutes: intervalInMinutes,
          }
        } else if (job.scheduleType === 'minutes') {
          time = {
            delayInMinutes: job.scheduleInterval,
            periodInMinutes: job.scheduleInterval,
          }
        }
        if (time) {
          await chrome.alarms.create(alarmName, time)
        }
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
