import type { CdpBackend } from './backends/types'

export interface BookmarkNode {
  id: string
  title: string
  url?: string
  parentId?: string
  type: 'url' | 'folder'
  index?: number
  dateAdded: number
  dateLastUsed?: number
}

export async function getBookmarks(cdp: CdpBackend): Promise<BookmarkNode[]> {
  const result = await cdp.Bookmarks.getBookmarks()
  return result.nodes as BookmarkNode[]
}

export async function createBookmark(
  cdp: CdpBackend,
  params: { title: string; url?: string; parentId?: string },
): Promise<BookmarkNode> {
  const result = await cdp.Bookmarks.createBookmark({
    title: params.title,
    ...(params.url !== undefined && { url: params.url }),
    ...(params.parentId !== undefined && { parentId: params.parentId }),
  })
  return result.node as BookmarkNode
}

export async function removeBookmark(
  cdp: CdpBackend,
  id: string,
): Promise<void> {
  await cdp.Bookmarks.removeBookmark({ id })
}

export async function updateBookmark(
  cdp: CdpBackend,
  id: string,
  changes: { url?: string; title?: string },
): Promise<BookmarkNode> {
  const result = await cdp.Bookmarks.updateBookmark({ id, ...changes })
  return result.node as BookmarkNode
}

export async function moveBookmark(
  cdp: CdpBackend,
  id: string,
  destination: { parentId?: string; index?: number },
): Promise<BookmarkNode> {
  const result = await cdp.Bookmarks.moveBookmark({ id, ...destination })
  return result.node as BookmarkNode
}

export async function searchBookmarks(
  cdp: CdpBackend,
  query: string,
): Promise<BookmarkNode[]> {
  const result = await cdp.Bookmarks.searchBookmarks({ query })
  return result.results as BookmarkNode[]
}
