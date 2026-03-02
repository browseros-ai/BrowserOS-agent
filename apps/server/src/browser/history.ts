import type { CdpBackend } from './backends/types'

export interface HistoryEntry {
  id: string
  url: string
  title: string
  lastVisitTime: number
  visitCount: number
  typedCount: number
}

export async function searchHistory(
  cdp: CdpBackend,
  query: string,
  maxResults?: number,
): Promise<HistoryEntry[]> {
  const result = await cdp.History.search({
    query,
    ...(maxResults !== undefined && { maxResults }),
  })
  return result.entries as HistoryEntry[]
}

export async function getRecentHistory(
  cdp: CdpBackend,
  maxResults?: number,
): Promise<HistoryEntry[]> {
  const result = await cdp.History.getRecent({
    ...(maxResults !== undefined && { maxResults }),
  })
  return result.entries as HistoryEntry[]
}

export async function deleteUrl(cdp: CdpBackend, url: string): Promise<void> {
  await cdp.History.deleteUrl({ url })
}

export async function deleteRange(
  cdp: CdpBackend,
  startTime: number,
  endTime: number,
): Promise<void> {
  await cdp.History.deleteRange({ startTime, endTime })
}
