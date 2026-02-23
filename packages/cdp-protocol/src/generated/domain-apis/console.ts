// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { MessageAddedEvent } from '../domains/console'

export interface ConsoleApi {
  // ── Commands ──

  clearMessages(): Promise<void>
  disable(): Promise<void>
  enable(): Promise<void>

  // ── Events ──

  on(
    event: 'messageAdded',
    handler: (params: MessageAddedEvent) => void,
  ): () => void
}
