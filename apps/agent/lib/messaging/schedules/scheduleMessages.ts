import { defineExtensionMessaging } from '@webext-core/messaging'

interface RunScheduledJobData {
  jobId: string
}

interface RunScheduledJobResponse {
  success: boolean
  error?: string
}

type ScheduleMessagesProtocol = {
  runScheduledJob(data: RunScheduledJobData): RunScheduledJobResponse
}

const { sendMessage, onMessage } =
  defineExtensionMessaging<ScheduleMessagesProtocol>()

export { sendMessage as sendScheduleMessage, onMessage as onScheduleMessage }
