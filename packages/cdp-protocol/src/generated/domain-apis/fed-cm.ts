// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  ClickDialogButtonParams,
  DialogClosedEvent,
  DialogShownEvent,
  DismissDialogParams,
  EnableParams,
  OpenUrlParams,
  SelectAccountParams,
} from '../domains/fed-cm'

export interface FedCmApi {
  // ── Commands ──

  enable(params?: EnableParams): Promise<void>
  disable(): Promise<void>
  selectAccount(params: SelectAccountParams): Promise<void>
  clickDialogButton(params: ClickDialogButtonParams): Promise<void>
  openUrl(params: OpenUrlParams): Promise<void>
  dismissDialog(params: DismissDialogParams): Promise<void>
  resetCooldown(): Promise<void>

  // ── Events ──

  on(
    event: 'dialogShown',
    handler: (params: DialogShownEvent) => void,
  ): () => void
  on(
    event: 'dialogClosed',
    handler: (params: DialogClosedEvent) => void,
  ): () => void
}
