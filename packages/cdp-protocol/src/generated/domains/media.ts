// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { BackendNodeId } from './dom'

// ══ Types ══

export type PlayerId = string

export type Timestamp = number

export interface PlayerMessage {
  level: 'error' | 'warning' | 'info' | 'debug'
  message: string
}

export interface PlayerProperty {
  name: string
  value: string
}

export interface PlayerEvent {
  timestamp: Timestamp
  value: string
}

export interface PlayerErrorSourceLocation {
  file: string
  line: number
}

export interface PlayerError {
  errorType: string
  code: number
  stack: PlayerErrorSourceLocation[]
  cause: PlayerError[]
  data: Record<string, unknown>
}

export interface Player {
  playerId: PlayerId
  domNodeId?: BackendNodeId
}

// ══ Commands ══

// ══ Events ══

export interface PlayerPropertiesChangedEvent {
  playerId: PlayerId
  properties: PlayerProperty[]
}

export interface PlayerEventsAddedEvent {
  playerId: PlayerId
  events: PlayerEvent[]
}

export interface PlayerMessagesLoggedEvent {
  playerId: PlayerId
  messages: PlayerMessage[]
}

export interface PlayerErrorsRaisedEvent {
  playerId: PlayerId
  errors: PlayerError[]
}

export interface PlayerCreatedEvent {
  player: Player
}
