// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  EnableParams,
  TimelineEventAddedEvent,
} from '../domains/performance-timeline'

export interface PerformanceTimelineApi {
  // ── Commands ──

  enable(params: EnableParams): Promise<void>

  // ── Events ──

  on(
    event: 'timelineEventAdded',
    handler: (params: TimelineEventAddedEvent) => void,
  ): () => void
}
