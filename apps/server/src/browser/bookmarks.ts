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
  const result = await cdp.send('Bookmarks.getBookmarks')
  const data = result as { nodes: BookmarkNode[] }
  return data.nodes
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
  const data = result as { node: BookmarkNode }
  return data.node
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
  const data = result as { node: BookmarkNode }
  return data.node
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
  const data = result as { node: BookmarkNode }
  return data.node
}

export async function searchBookmarks(
  cdp: CdpBackend,
  query: string,
): Promise<BookmarkNode[]> {
  const result = await cdp.send('Bookmarks.searchBookmarks', { query })
  const data = result as { results: BookmarkNode[] }
  return data.results
}
