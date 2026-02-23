// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  ClearStorageItemsParams,
  GetStorageItemsParams,
  GetStorageItemsResult,
  LoadUnpackedParams,
  LoadUnpackedResult,
  RemoveStorageItemsParams,
  SetStorageItemsParams,
  UninstallParams,
} from '../domains/extensions'

export interface ExtensionsApi {
  // ── Commands ──

  loadUnpacked(params: LoadUnpackedParams): Promise<LoadUnpackedResult>
  uninstall(params: UninstallParams): Promise<void>
  getStorageItems(params: GetStorageItemsParams): Promise<GetStorageItemsResult>
  removeStorageItems(params: RemoveStorageItemsParams): Promise<void>
  clearStorageItems(params: ClearStorageItemsParams): Promise<void>
  setStorageItems(params: SetStorageItemsParams): Promise<void>
}
