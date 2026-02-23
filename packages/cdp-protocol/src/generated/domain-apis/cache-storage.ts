// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  DeleteCacheParams,
  DeleteEntryParams,
  RequestCachedResponseParams,
  RequestCachedResponseResult,
  RequestCacheNamesParams,
  RequestCacheNamesResult,
  RequestEntriesParams,
  RequestEntriesResult,
} from '../domains/cache-storage'

export interface CacheStorageApi {
  // ── Commands ──

  deleteCache(params: DeleteCacheParams): Promise<void>
  deleteEntry(params: DeleteEntryParams): Promise<void>
  requestCacheNames(
    params?: RequestCacheNamesParams,
  ): Promise<RequestCacheNamesResult>
  requestCachedResponse(
    params: RequestCachedResponseParams,
  ): Promise<RequestCachedResponseResult>
  requestEntries(params: RequestEntriesParams): Promise<RequestEntriesResult>
}
