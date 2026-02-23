// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { BackendNodeId, Rect } from './dom'
import type { TimeSinceEpoch } from './network'
import type { FrameId } from './page'

// ══ Types ══

export interface LargestContentfulPaint {
  renderTime: TimeSinceEpoch
  loadTime: TimeSinceEpoch
  size: number
  elementId?: string
  url?: string
  nodeId?: BackendNodeId
}

export interface LayoutShiftAttribution {
  previousRect: Rect
  currentRect: Rect
  nodeId?: BackendNodeId
}

export interface LayoutShift {
  value: number
  hadRecentInput: boolean
  lastInputTime: TimeSinceEpoch
  sources: LayoutShiftAttribution[]
}

export interface TimelineEvent {
  frameId: FrameId
  type: string
  name: string
  time: TimeSinceEpoch
  duration?: number
  lcpDetails?: LargestContentfulPaint
  layoutShiftDetails?: LayoutShift
}

// ══ Commands ══

export interface EnableParams {
  eventTypes: string[]
}

// ══ Events ══

export interface TimelineEventAddedEvent {
  event: TimelineEvent
}
