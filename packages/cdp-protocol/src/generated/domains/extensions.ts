// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

// ══ Types ══

export type StorageArea = 'session' | 'local' | 'sync' | 'managed'

// ══ Commands ══

export interface LoadUnpackedParams {
  path: string
}

export interface LoadUnpackedResult {
  id: string
}

export interface UninstallParams {
  id: string
}

export interface GetStorageItemsParams {
  id: string
  storageArea: StorageArea
  keys?: string[]
}

export interface GetStorageItemsResult {
  data: Record<string, unknown>
}

export interface RemoveStorageItemsParams {
  id: string
  storageArea: StorageArea
  keys: string[]
}

export interface ClearStorageItemsParams {
  id: string
  storageArea: StorageArea
}

export interface SetStorageItemsParams {
  id: string
  storageArea: StorageArea
  values: Record<string, unknown>
}
