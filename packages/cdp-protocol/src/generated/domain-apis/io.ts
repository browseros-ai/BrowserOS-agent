// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  CloseParams,
  ReadParams,
  ReadResult,
  ResolveBlobParams,
  ResolveBlobResult,
} from '../domains/io'

export interface IOApi {
  // ── Commands ──

  close(params: CloseParams): Promise<void>
  read(params: ReadParams): Promise<ReadResult>
  resolveBlob(params: ResolveBlobParams): Promise<ResolveBlobResult>
}
