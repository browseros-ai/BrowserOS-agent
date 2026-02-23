// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { DetachedEvent } from '../domains/inspector'

export interface InspectorApi {
  // ── Commands ──

  disable(): Promise<void>
  enable(): Promise<void>

  // ── Events ──

  on(event: 'detached', handler: (params: DetachedEvent) => void): () => void
  on(event: 'targetCrashed', handler: () => void): () => void
  on(event: 'targetReloadedAfterCrash', handler: () => void): () => void
  on(event: 'workerScriptLoaded', handler: () => void): () => void
}
