// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  ClearParams,
  DomStorageItemAddedEvent,
  DomStorageItemRemovedEvent,
  DomStorageItemsClearedEvent,
  DomStorageItemUpdatedEvent,
  GetDOMStorageItemsParams,
  GetDOMStorageItemsResult,
  RemoveDOMStorageItemParams,
  SetDOMStorageItemParams,
} from '../domains/dom-storage'

export interface DOMStorageApi {
  // ── Commands ──

  clear(params: ClearParams): Promise<void>
  disable(): Promise<void>
  enable(): Promise<void>
  getDOMStorageItems(
    params: GetDOMStorageItemsParams,
  ): Promise<GetDOMStorageItemsResult>
  removeDOMStorageItem(params: RemoveDOMStorageItemParams): Promise<void>
  setDOMStorageItem(params: SetDOMStorageItemParams): Promise<void>

  // ── Events ──

  on(
    event: 'domStorageItemAdded',
    handler: (params: DomStorageItemAddedEvent) => void,
  ): () => void
  on(
    event: 'domStorageItemRemoved',
    handler: (params: DomStorageItemRemovedEvent) => void,
  ): () => void
  on(
    event: 'domStorageItemUpdated',
    handler: (params: DomStorageItemUpdatedEvent) => void,
  ): () => void
  on(
    event: 'domStorageItemsCleared',
    handler: (params: DomStorageItemsClearedEvent) => void,
  ): () => void
}
