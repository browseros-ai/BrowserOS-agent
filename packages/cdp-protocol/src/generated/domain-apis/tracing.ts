// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  BufferUsageEvent,
  DataCollectedEvent,
  GetCategoriesResult,
  GetTrackEventDescriptorResult,
  RecordClockSyncMarkerParams,
  RequestMemoryDumpParams,
  RequestMemoryDumpResult,
  StartParams,
  TracingCompleteEvent,
} from '../domains/tracing'

export interface TracingApi {
  // ── Commands ──

  end(): Promise<void>
  getCategories(): Promise<GetCategoriesResult>
  getTrackEventDescriptor(): Promise<GetTrackEventDescriptorResult>
  recordClockSyncMarker(params: RecordClockSyncMarkerParams): Promise<void>
  requestMemoryDump(
    params?: RequestMemoryDumpParams,
  ): Promise<RequestMemoryDumpResult>
  start(params?: StartParams): Promise<void>

  // ── Events ──

  on(
    event: 'bufferUsage',
    handler: (params: BufferUsageEvent) => void,
  ): () => void
  on(
    event: 'dataCollected',
    handler: (params: DataCollectedEvent) => void,
  ): () => void
  on(
    event: 'tracingComplete',
    handler: (params: TracingCompleteEvent) => void,
  ): () => void
}
