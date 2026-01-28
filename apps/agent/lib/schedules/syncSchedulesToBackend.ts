import { isEqual, omit } from 'es-toolkit'
import { GetProfileIdByUserIdDocument } from '@/lib/conversations/graphql/uploadConversationDocument'
import { execute } from '@/lib/graphql/execute'
import { sentry } from '@/lib/sentry/sentry'
import { createAlarmFromJob } from './createAlarmFromJob'
import {
  CreateScheduledJobDocument,
  GetScheduledJobsByProfileIdDocument,
  UpdateScheduledJobDocument,
} from './graphql/syncSchedulesDocument'
import { scheduledJobStorage } from './scheduleStorage'
import type { ScheduledJob } from './scheduleTypes'

type RemoteScheduledJob = {
  rowId: string
  name: string
  query: string
  scheduleType: string
  scheduleTime: string | null
  scheduleInterval: number | null
  enabled: boolean
  createdAt: string
  updatedAt: string
  lastRunAt: string | null
}

const IGNORED_FIELDS = ['id', 'createdAt', 'lastRunAt'] as const

function toComparable(job: ScheduledJob) {
  const data = omit(job, IGNORED_FIELDS)
  return {
    ...data,
    scheduleTime: data.scheduleTime ?? null,
    scheduleInterval: data.scheduleInterval ?? null,
  }
}

function remoteToComparable(job: RemoteScheduledJob) {
  return {
    name: job.name,
    query: job.query,
    scheduleType: job.scheduleType as ScheduledJob['scheduleType'],
    scheduleTime: job.scheduleTime,
    scheduleInterval: job.scheduleInterval,
    enabled: job.enabled,
  }
}

function remoteToLocal(remote: RemoteScheduledJob): ScheduledJob {
  const createdAt = remote.createdAt.endsWith('Z')
    ? remote.createdAt
    : `${remote.createdAt}Z`
  const lastRunAt = remote.lastRunAt
    ? remote.lastRunAt.endsWith('Z')
      ? remote.lastRunAt
      : `${remote.lastRunAt}Z`
    : undefined

  return {
    id: remote.rowId,
    name: remote.name,
    query: remote.query,
    scheduleType: remote.scheduleType as ScheduledJob['scheduleType'],
    scheduleTime: remote.scheduleTime ?? undefined,
    scheduleInterval: remote.scheduleInterval ?? undefined,
    enabled: remote.enabled,
    createdAt,
    lastRunAt,
  }
}

export async function syncSchedulesToBackend(
  localJobs: ScheduledJob[],
  userId: string,
): Promise<void> {
  const profileResult = await execute(GetProfileIdByUserIdDocument, { userId })
  const profileId = profileResult.profileByUserId?.rowId
  if (!profileId) return

  const remoteResult = await execute(GetScheduledJobsByProfileIdDocument, {
    profileId,
  })

  const remoteJobs = new Map<string, RemoteScheduledJob>()
  for (const node of remoteResult.scheduledJobs?.nodes ?? []) {
    if (node) {
      remoteJobs.set(node.rowId, node as RemoteScheduledJob)
    }
  }

  const localJobIds = new Set(localJobs.map((j) => j.id))
  const jobsToAddLocally: ScheduledJob[] = []

  for (const [rowId, remote] of remoteJobs) {
    if (!localJobIds.has(rowId)) {
      jobsToAddLocally.push(remoteToLocal(remote))
    }
  }

  if (jobsToAddLocally.length > 0) {
    const currentJobs = (await scheduledJobStorage.getValue()) ?? []
    const existingIds = new Set(currentJobs.map((j) => j.id))
    const newJobs = jobsToAddLocally.filter((j) => !existingIds.has(j.id))

    if (newJobs.length > 0) {
      await scheduledJobStorage.setValue([...currentJobs, ...newJobs])

      for (const job of newJobs) {
        if (job.enabled) {
          try {
            await createAlarmFromJob(job)
          } catch {
            // Alarm creation may fail in non-background context
          }
        }
      }
    }
  }

  for (const job of localJobs) {
    try {
      const remote = remoteJobs.get(job.id)

      if (remote) {
        if (isEqual(toComparable(job), remoteToComparable(remote))) continue

        await execute(UpdateScheduledJobDocument, {
          input: {
            rowId: job.id,
            patch: {
              name: job.name,
              query: job.query,
              scheduleType: job.scheduleType,
              scheduleTime: job.scheduleTime ?? null,
              scheduleInterval: job.scheduleInterval ?? null,
              enabled: job.enabled,
              lastRunAt: job.lastRunAt
                ? new Date(job.lastRunAt).toISOString()
                : null,
              updatedAt: new Date().toISOString(),
            },
          },
        })
      } else {
        await execute(CreateScheduledJobDocument, {
          input: {
            scheduledJob: {
              rowId: job.id,
              profileId,
              name: job.name,
              query: job.query,
              scheduleType: job.scheduleType,
              scheduleTime: job.scheduleTime ?? null,
              scheduleInterval: job.scheduleInterval ?? null,
              enabled: job.enabled,
              createdAt: new Date(job.createdAt).toISOString(),
              updatedAt: new Date().toISOString(),
              lastRunAt: job.lastRunAt
                ? new Date(job.lastRunAt).toISOString()
                : null,
            },
          },
        })
      }
    } catch (error) {
      sentry.captureException(error, {
        extra: {
          jobId: job.id,
          jobName: job.name,
        },
      })
    }
  }
}
