// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { TimeSinceEpoch } from './network'
import type { RegistrationID } from './service-worker'

// ══ Types ══

export type ServiceName =
  | 'backgroundFetch'
  | 'backgroundSync'
  | 'pushMessaging'
  | 'notifications'
  | 'paymentHandler'
  | 'periodicBackgroundSync'

export interface EventMetadata {
  key: string
  value: string
}

export interface BackgroundServiceEvent {
  timestamp: TimeSinceEpoch
  origin: string
  serviceWorkerRegistrationId: RegistrationID
  service: ServiceName
  eventName: string
  instanceId: string
  eventMetadata: EventMetadata[]
  storageKey: string
}

// ══ Commands ══

export interface StartObservingParams {
  service: ServiceName
}

export interface StopObservingParams {
  service: ServiceName
}

export interface SetRecordingParams {
  shouldRecord: boolean
  service: ServiceName
}

export interface ClearEventsParams {
  service: ServiceName
}

// ══ Events ══

export interface RecordingStateChangedEvent {
  isRecording: boolean
  service: ServiceName
}

export interface BackgroundServiceEventReceivedEvent {
  backgroundServiceEvent: BackgroundServiceEvent
}
