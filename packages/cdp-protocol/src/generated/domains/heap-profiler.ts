// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { CallFrame, RemoteObject, RemoteObjectId } from './runtime'

// ══ Types ══

export type HeapSnapshotObjectId = string

export interface SamplingHeapProfileNode {
  callFrame: CallFrame
  selfSize: number
  id: number
  children: SamplingHeapProfileNode[]
}

export interface SamplingHeapProfileSample {
  size: number
  nodeId: number
  ordinal: number
}

export interface SamplingHeapProfile {
  head: SamplingHeapProfileNode
  samples: SamplingHeapProfileSample[]
}

// ══ Commands ══

export interface AddInspectedHeapObjectParams {
  heapObjectId: HeapSnapshotObjectId
}

export interface GetHeapObjectIdParams {
  objectId: RemoteObjectId
}

export interface GetHeapObjectIdResult {
  heapSnapshotObjectId: HeapSnapshotObjectId
}

export interface GetObjectByHeapObjectIdParams {
  objectId: HeapSnapshotObjectId
  objectGroup?: string
}

export interface GetObjectByHeapObjectIdResult {
  result: RemoteObject
}

export interface GetSamplingProfileResult {
  profile: SamplingHeapProfile
}

export interface StartSamplingParams {
  samplingInterval?: number
  stackDepth?: number
  includeObjectsCollectedByMajorGC?: boolean
  includeObjectsCollectedByMinorGC?: boolean
}

export interface StartTrackingHeapObjectsParams {
  trackAllocations?: boolean
}

export interface StopSamplingResult {
  profile: SamplingHeapProfile
}

export interface StopTrackingHeapObjectsParams {
  reportProgress?: boolean
  treatGlobalObjectsAsRoots?: boolean
  captureNumericValue?: boolean
  exposeInternals?: boolean
}

export interface TakeHeapSnapshotParams {
  reportProgress?: boolean
  treatGlobalObjectsAsRoots?: boolean
  captureNumericValue?: boolean
  exposeInternals?: boolean
}

// ══ Events ══

export interface AddHeapSnapshotChunkEvent {
  chunk: string
}

export interface HeapStatsUpdateEvent {
  statsUpdate: number[]
}

export interface LastSeenObjectIdEvent {
  lastSeenObjectId: number
  timestamp: number
}

export interface ReportHeapSnapshotProgressEvent {
  done: number
  total: number
  finished?: boolean
}
