// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  EnableParams,
  IssueUpdatedEvent,
  SetSinkToUseParams,
  SinksUpdatedEvent,
  StartDesktopMirroringParams,
  StartTabMirroringParams,
  StopCastingParams,
} from '../domains/cast'

export interface CastApi {
  // ── Commands ──

  enable(params?: EnableParams): Promise<void>
  disable(): Promise<void>
  setSinkToUse(params: SetSinkToUseParams): Promise<void>
  startDesktopMirroring(params: StartDesktopMirroringParams): Promise<void>
  startTabMirroring(params: StartTabMirroringParams): Promise<void>
  stopCasting(params: StopCastingParams): Promise<void>

  // ── Events ──

  on(
    event: 'sinksUpdated',
    handler: (params: SinksUpdatedEvent) => void,
  ): () => void
  on(
    event: 'issueUpdated',
    handler: (params: IssueUpdatedEvent) => void,
  ): () => void
}
