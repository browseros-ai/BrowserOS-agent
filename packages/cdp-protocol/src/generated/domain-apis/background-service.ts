// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  BackgroundServiceEventReceivedEvent,
  ClearEventsParams,
  RecordingStateChangedEvent,
  SetRecordingParams,
  StartObservingParams,
  StopObservingParams,
} from '../domains/background-service'

export interface BackgroundServiceApi {
  // ── Commands ──

  startObserving(params: StartObservingParams): Promise<void>
  stopObserving(params: StopObservingParams): Promise<void>
  setRecording(params: SetRecordingParams): Promise<void>
  clearEvents(params: ClearEventsParams): Promise<void>

  // ── Events ──

  on(
    event: 'recordingStateChanged',
    handler: (params: RecordingStateChangedEvent) => void,
  ): () => void
  on(
    event: 'backgroundServiceEventReceived',
    handler: (params: BackgroundServiceEventReceivedEvent) => void,
  ): () => void
}
