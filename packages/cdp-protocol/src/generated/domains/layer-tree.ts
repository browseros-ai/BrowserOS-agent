// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { BackendNodeId, Rect } from './dom'

// ══ Types ══

export type LayerId = string

export type SnapshotId = string

export interface ScrollRect {
  rect: Rect
  type: 'RepaintsOnScroll' | 'TouchEventHandler' | 'WheelEventHandler'
}

export interface StickyPositionConstraint {
  stickyBoxRect: Rect
  containingBlockRect: Rect
  nearestLayerShiftingStickyBox?: LayerId
  nearestLayerShiftingContainingBlock?: LayerId
}

export interface PictureTile {
  x: number
  y: number
  picture: string
}

export interface Layer {
  layerId: LayerId
  parentLayerId?: LayerId
  backendNodeId?: BackendNodeId
  offsetX: number
  offsetY: number
  width: number
  height: number
  transform?: number[]
  anchorX?: number
  anchorY?: number
  anchorZ?: number
  paintCount: number
  drawsContent: boolean
  invisible?: boolean
  scrollRects?: ScrollRect[]
  stickyPositionConstraint?: StickyPositionConstraint
}

export type PaintProfile = number[]

// ══ Commands ══

export interface CompositingReasonsParams {
  layerId: LayerId
}

export interface CompositingReasonsResult {
  compositingReasons: string[]
  compositingReasonIds: string[]
}

export interface LoadSnapshotParams {
  tiles: PictureTile[]
}

export interface LoadSnapshotResult {
  snapshotId: SnapshotId
}

export interface MakeSnapshotParams {
  layerId: LayerId
}

export interface MakeSnapshotResult {
  snapshotId: SnapshotId
}

export interface ProfileSnapshotParams {
  snapshotId: SnapshotId
  minRepeatCount?: number
  minDuration?: number
  clipRect?: Rect
}

export interface ProfileSnapshotResult {
  timings: PaintProfile[]
}

export interface ReleaseSnapshotParams {
  snapshotId: SnapshotId
}

export interface ReplaySnapshotParams {
  snapshotId: SnapshotId
  fromStep?: number
  toStep?: number
  scale?: number
}

export interface ReplaySnapshotResult {
  dataURL: string
}

export interface SnapshotCommandLogParams {
  snapshotId: SnapshotId
}

export interface SnapshotCommandLogResult {
  commandLog: Record<string, unknown>[]
}

// ══ Events ══

export interface LayerPaintedEvent {
  layerId: LayerId
  clip: Rect
}

export interface LayerTreeDidChangeEvent {
  layers?: Layer[]
}
