// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  PrefetchStatusUpdatedEvent,
  PreloadEnabledStateUpdatedEvent,
  PreloadingAttemptSourcesUpdatedEvent,
  PrerenderStatusUpdatedEvent,
  RuleSetRemovedEvent,
  RuleSetUpdatedEvent,
} from '../domains/preload'

export interface PreloadApi {
  // ── Commands ──

  enable(): Promise<void>
  disable(): Promise<void>

  // ── Events ──

  on(
    event: 'ruleSetUpdated',
    handler: (params: RuleSetUpdatedEvent) => void,
  ): () => void
  on(
    event: 'ruleSetRemoved',
    handler: (params: RuleSetRemovedEvent) => void,
  ): () => void
  on(
    event: 'preloadEnabledStateUpdated',
    handler: (params: PreloadEnabledStateUpdatedEvent) => void,
  ): () => void
  on(
    event: 'prefetchStatusUpdated',
    handler: (params: PrefetchStatusUpdatedEvent) => void,
  ): () => void
  on(
    event: 'prerenderStatusUpdated',
    handler: (params: PrerenderStatusUpdatedEvent) => void,
  ): () => void
  on(
    event: 'preloadingAttemptSourcesUpdated',
    handler: (params: PreloadingAttemptSourcesUpdatedEvent) => void,
  ): () => void
}
