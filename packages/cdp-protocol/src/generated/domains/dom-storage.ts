// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

// ══ Types ══

export type SerializedStorageKey = string

export interface StorageId {
  securityOrigin?: string
  storageKey?: SerializedStorageKey
  isLocalStorage: boolean
}

export type Item = string[]

// ══ Commands ══

export interface ClearParams {
  storageId: StorageId
}

export interface GetDOMStorageItemsParams {
  storageId: StorageId
}

export interface GetDOMStorageItemsResult {
  entries: Item[]
}

export interface RemoveDOMStorageItemParams {
  storageId: StorageId
  key: string
}

export interface SetDOMStorageItemParams {
  storageId: StorageId
  key: string
  value: string
}

// ══ Events ══

export interface DomStorageItemAddedEvent {
  storageId: StorageId
  key: string
  newValue: string
}

export interface DomStorageItemRemovedEvent {
  storageId: StorageId
  key: string
}

export interface DomStorageItemUpdatedEvent {
  storageId: StorageId
  key: string
  oldValue: string
  newValue: string
}

export interface DomStorageItemsClearedEvent {
  storageId: StorageId
}
