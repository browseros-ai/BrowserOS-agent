// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  ClearObjectStoreParams,
  DeleteDatabaseParams,
  DeleteObjectStoreEntriesParams,
  GetMetadataParams,
  GetMetadataResult,
  RequestDatabaseNamesParams,
  RequestDatabaseNamesResult,
  RequestDatabaseParams,
  RequestDatabaseResult,
  RequestDataParams,
  RequestDataResult,
} from '../domains/indexed-db'

export interface IndexedDBApi {
  // ── Commands ──

  clearObjectStore(params: ClearObjectStoreParams): Promise<void>
  deleteDatabase(params: DeleteDatabaseParams): Promise<void>
  deleteObjectStoreEntries(
    params: DeleteObjectStoreEntriesParams,
  ): Promise<void>
  disable(): Promise<void>
  enable(): Promise<void>
  requestData(params: RequestDataParams): Promise<RequestDataResult>
  getMetadata(params: GetMetadataParams): Promise<GetMetadataResult>
  requestDatabase(params: RequestDatabaseParams): Promise<RequestDatabaseResult>
  requestDatabaseNames(
    params?: RequestDatabaseNamesParams,
  ): Promise<RequestDatabaseNamesResult>
}
