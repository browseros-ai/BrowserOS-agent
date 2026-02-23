// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  PlayerCreatedEvent,
  PlayerErrorsRaisedEvent,
  PlayerEventsAddedEvent,
  PlayerMessagesLoggedEvent,
  PlayerPropertiesChangedEvent,
} from '../domains/media'

export interface MediaApi {
  // ── Commands ──

  enable(): Promise<void>
  disable(): Promise<void>

  // ── Events ──

  on(
    event: 'playerPropertiesChanged',
    handler: (params: PlayerPropertiesChangedEvent) => void,
  ): () => void
  on(
    event: 'playerEventsAdded',
    handler: (params: PlayerEventsAddedEvent) => void,
  ): () => void
  on(
    event: 'playerMessagesLogged',
    handler: (params: PlayerMessagesLoggedEvent) => void,
  ): () => void
  on(
    event: 'playerErrorsRaised',
    handler: (params: PlayerErrorsRaisedEvent) => void,
  ): () => void
  on(
    event: 'playerCreated',
    handler: (params: PlayerCreatedEvent) => void,
  ): () => void
}
