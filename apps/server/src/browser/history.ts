import type { ControllerBackend } from './backends/types'

export interface HistoryEntry {
  id: string
  url?: string
  title?: string
  lastVisitTime?: number
  visitCount?: number
  typedCount?: number
}

export async function searchHistory(
  controller: ControllerBackend,
  query: string,
  maxResults?: number,
): Promise<HistoryEntry[]> {
  const result = await controller.send('searchHistory', {
    query,
    ...(maxResults !== undefined && { maxResults }),
  })
  const data = result as { items: HistoryEntry[] }
  return data.items
}

export async function getRecentHistory(
  controller: ControllerBackend,
  maxResults?: number,
): Promise<HistoryEntry[]> {
  const result = await controller.send('getRecentHistory', {
    ...(maxResults !== undefined && { count: maxResults }),
  })
  const data = result as { items: HistoryEntry[] }
  return data.items
}
