// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { StorageBucket } from './storage'

// ══ Types ══

export type CacheId = string

export type CachedResponseType =
  | 'basic'
  | 'cors'
  | 'default'
  | 'error'
  | 'opaqueResponse'
  | 'opaqueRedirect'

export interface DataEntry {
  requestURL: string
  requestMethod: string
  requestHeaders: Header[]
  responseTime: number
  responseStatus: number
  responseStatusText: string
  responseType: CachedResponseType
  responseHeaders: Header[]
}

export interface Cache {
  cacheId: CacheId
  securityOrigin: string
  storageKey: string
  storageBucket?: StorageBucket
  cacheName: string
}

export interface Header {
  name: string
  value: string
}

export interface CachedResponse {
  body: string
}

// ══ Commands ══

export interface DeleteCacheParams {
  cacheId: CacheId
}

export interface DeleteEntryParams {
  cacheId: CacheId
  request: string
}

export interface RequestCacheNamesParams {
  securityOrigin?: string
  storageKey?: string
  storageBucket?: StorageBucket
}

export interface RequestCacheNamesResult {
  caches: Cache[]
}

export interface RequestCachedResponseParams {
  cacheId: CacheId
  requestURL: string
  requestHeaders: Header[]
}

export interface RequestCachedResponseResult {
  response: CachedResponse
}

export interface RequestEntriesParams {
  cacheId: CacheId
  skipCount?: number
  pageSize?: number
  pathFilter?: string
}

export interface RequestEntriesResult {
  cacheDataEntries: DataEntry[]
  returnCount: number
}
