// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  AcceptedEvent,
  BindParams,
  UnbindParams,
} from '../domains/tethering'

export interface TetheringApi {
  // ── Commands ──

  bind(params: BindParams): Promise<void>
  unbind(params: UnbindParams): Promise<void>

  // ── Events ──

  on(event: 'accepted', handler: (params: AcceptedEvent) => void): () => void
}
