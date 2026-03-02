// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

// ══ Types ══

export type HistoryEntryID = string

export interface HistoryEntry {
  id: HistoryEntryID
  url: string
  title: string
  lastVisitTime: number
  visitCount: number
  typedCount: number
}

// ══ Commands ══

export interface SearchParams {
  query: string
  maxResults?: number
  startTime?: number
  endTime?: number
}

export interface SearchResult {
  entries: HistoryEntry[]
}

export interface GetRecentParams {
  maxResults?: number
}

export interface GetRecentResult {
  entries: HistoryEntry[]
}

export interface DeleteUrlParams {
  url: string
}

export interface DeleteRangeParams {
  startTime: number
  endTime: number
}
