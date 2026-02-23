// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  DeleteRangeParams,
  DeleteUrlParams,
  GetRecentParams,
  GetRecentResult,
  SearchParams,
  SearchResult,
} from '../domains/history'

export interface HistoryApi {
  // ── Commands ──

  search(params: SearchParams): Promise<SearchResult>
  getRecent(params?: GetRecentParams): Promise<GetRecentResult>
  deleteUrl(params: DeleteUrlParams): Promise<void>
  deleteRange(params: DeleteRangeParams): Promise<void>
}
