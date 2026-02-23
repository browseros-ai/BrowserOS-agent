// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  AddHeapSnapshotChunkEvent,
  AddInspectedHeapObjectParams,
  GetHeapObjectIdParams,
  GetHeapObjectIdResult,
  GetObjectByHeapObjectIdParams,
  GetObjectByHeapObjectIdResult,
  GetSamplingProfileResult,
  HeapStatsUpdateEvent,
  LastSeenObjectIdEvent,
  ReportHeapSnapshotProgressEvent,
  StartSamplingParams,
  StartTrackingHeapObjectsParams,
  StopSamplingResult,
  StopTrackingHeapObjectsParams,
  TakeHeapSnapshotParams,
} from '../domains/heap-profiler'

export interface HeapProfilerApi {
  // ── Commands ──

  addInspectedHeapObject(params: AddInspectedHeapObjectParams): Promise<void>
  collectGarbage(): Promise<void>
  disable(): Promise<void>
  enable(): Promise<void>
  getHeapObjectId(params: GetHeapObjectIdParams): Promise<GetHeapObjectIdResult>
  getObjectByHeapObjectId(
    params: GetObjectByHeapObjectIdParams,
  ): Promise<GetObjectByHeapObjectIdResult>
  getSamplingProfile(): Promise<GetSamplingProfileResult>
  startSampling(params?: StartSamplingParams): Promise<void>
  startTrackingHeapObjects(
    params?: StartTrackingHeapObjectsParams,
  ): Promise<void>
  stopSampling(): Promise<StopSamplingResult>
  stopTrackingHeapObjects(params?: StopTrackingHeapObjectsParams): Promise<void>
  takeHeapSnapshot(params?: TakeHeapSnapshotParams): Promise<void>

  // ── Events ──

  on(
    event: 'addHeapSnapshotChunk',
    handler: (params: AddHeapSnapshotChunkEvent) => void,
  ): () => void
  on(
    event: 'heapStatsUpdate',
    handler: (params: HeapStatsUpdateEvent) => void,
  ): () => void
  on(
    event: 'lastSeenObjectId',
    handler: (params: LastSeenObjectIdEvent) => void,
  ): () => void
  on(
    event: 'reportHeapSnapshotProgress',
    handler: (params: ReportHeapSnapshotProgressEvent) => void,
  ): () => void
  on(event: 'resetProfiles', handler: () => void): () => void
}
