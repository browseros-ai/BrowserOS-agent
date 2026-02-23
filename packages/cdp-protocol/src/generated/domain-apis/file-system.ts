// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  GetDirectoryParams,
  GetDirectoryResult,
} from '../domains/file-system'

export interface FileSystemApi {
  // ── Commands ──

  getDirectory(params: GetDirectoryParams): Promise<GetDirectoryResult>
}
