// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  CaptureSnapshotParams,
  CaptureSnapshotResult,
  GetSnapshotParams,
  GetSnapshotResult,
} from '../domains/dom-snapshot'

export interface DOMSnapshotApi {
  // ── Commands ──

  disable(): Promise<void>
  enable(): Promise<void>
  getSnapshot(params: GetSnapshotParams): Promise<GetSnapshotResult>
  captureSnapshot(params: CaptureSnapshotParams): Promise<CaptureSnapshotResult>
}
