// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { RemoteObject } from './runtime'
import type { StorageBucket } from './storage'

// ══ Types ══

export interface DatabaseWithObjectStores {
  name: string
  version: number
  objectStores: ObjectStore[]
}

export interface ObjectStore {
  name: string
  keyPath: KeyPath
  autoIncrement: boolean
  indexes: ObjectStoreIndex[]
}

export interface ObjectStoreIndex {
  name: string
  keyPath: KeyPath
  unique: boolean
  multiEntry: boolean
}

export interface Key {
  type: 'number' | 'string' | 'date' | 'array'
  number?: number
  string?: string
  date?: number
  array?: Key[]
}

export interface KeyRange {
  lower?: Key
  upper?: Key
  lowerOpen: boolean
  upperOpen: boolean
}

export interface DataEntry {
  key: RemoteObject
  primaryKey: RemoteObject
  value: RemoteObject
}

export interface KeyPath {
  type: 'null' | 'string' | 'array'
  string?: string
  array?: string[]
}

// ══ Commands ══

export interface ClearObjectStoreParams {
  securityOrigin?: string
  storageKey?: string
  storageBucket?: StorageBucket
  databaseName: string
  objectStoreName: string
}

export interface DeleteDatabaseParams {
  securityOrigin?: string
  storageKey?: string
  storageBucket?: StorageBucket
  databaseName: string
}

export interface DeleteObjectStoreEntriesParams {
  securityOrigin?: string
  storageKey?: string
  storageBucket?: StorageBucket
  databaseName: string
  objectStoreName: string
  keyRange: KeyRange
}

export interface RequestDataParams {
  securityOrigin?: string
  storageKey?: string
  storageBucket?: StorageBucket
  databaseName: string
  objectStoreName: string
  indexName?: string
  skipCount: number
  pageSize: number
  keyRange?: KeyRange
}

export interface RequestDataResult {
  objectStoreDataEntries: DataEntry[]
  hasMore: boolean
}

export interface GetMetadataParams {
  securityOrigin?: string
  storageKey?: string
  storageBucket?: StorageBucket
  databaseName: string
  objectStoreName: string
}

export interface GetMetadataResult {
  entriesCount: number
  keyGeneratorValue: number
}

export interface RequestDatabaseParams {
  securityOrigin?: string
  storageKey?: string
  storageBucket?: StorageBucket
  databaseName: string
}

export interface RequestDatabaseResult {
  databaseWithObjectStores: DatabaseWithObjectStores
}

export interface RequestDatabaseNamesParams {
  securityOrigin?: string
  storageKey?: string
  storageBucket?: StorageBucket
}

export interface RequestDatabaseNamesResult {
  databaseNames: string[]
}
