import type { CdpBackend } from './backends/types'

export interface BookmarkNode {
  id: string
  title: string
  url?: string
  parentId?: string
  isFolder?: boolean
  index?: number
}

export async function getBookmarks(cdp: CdpBackend): Promise<BookmarkNode[]> {
  const result = await cdp.send('Bookmarks.getBookmarks')
  const data = result as { bookmarks: BookmarkNode[] }
  return data.bookmarks
}

export async function createBookmark(
  cdp: CdpBackend,
  params: { title: string; url?: string; parentId?: string },
): Promise<BookmarkNode> {
  const result = await cdp.send('Bookmarks.createBookmark', {
    title: params.title,
    ...(params.url !== undefined && { url: params.url }),
    ...(params.parentId !== undefined && { parentId: params.parentId }),
  })
  return result as BookmarkNode
}

export async function removeBookmark(
  cdp: CdpBackend,
  id: string,
): Promise<void> {
  await cdp.send('Bookmarks.removeBookmark', { id })
}

export async function updateBookmark(
  cdp: CdpBackend,
  id: string,
  changes: { url?: string; title?: string },
): Promise<BookmarkNode> {
  const result = await cdp.send('Bookmarks.updateBookmark', { id, ...changes })
  return result as BookmarkNode
}

export async function moveBookmark(
  cdp: CdpBackend,
  id: string,
  destination: { parentId?: string; index?: number },
): Promise<BookmarkNode> {
  const result = await cdp.send('Bookmarks.moveBookmark', {
    id,
    ...destination,
  })
  return result as BookmarkNode
}

export async function searchBookmarks(
  cdp: CdpBackend,
  query: string,
): Promise<BookmarkNode[]> {
  const result = await cdp.send('Bookmarks.searchBookmarks', { query })
  const data = result as { bookmarks: BookmarkNode[] }
  return data.bookmarks
}
