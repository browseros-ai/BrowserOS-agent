import type { ControllerBackend } from './backends/types'

export interface BookmarkNode {
  id: string
  title: string
  url?: string
  parentId?: string
  isFolder?: boolean
  index?: number
}

export async function getBookmarks(
  controller: ControllerBackend,
  folderId?: string,
): Promise<BookmarkNode[]> {
  const result = await controller.send('getBookmarks', {
    ...(folderId && { folderId }),
  })
  const data = result as { bookmarks: BookmarkNode[] }
  return data.bookmarks
}

export async function createBookmark(
  controller: ControllerBackend,
  params: { url: string; title: string; parentId?: string },
): Promise<BookmarkNode> {
  const result = await controller.send('createBookmark', params)
  return result as BookmarkNode
}

export async function removeBookmark(
  controller: ControllerBackend,
  id: string,
): Promise<void> {
  await controller.send('removeBookmark', { id })
}

export async function updateBookmark(
  controller: ControllerBackend,
  id: string,
  changes: { url?: string; title?: string },
): Promise<BookmarkNode> {
  const result = await controller.send('updateBookmark', { id, ...changes })
  return result as BookmarkNode
}

export async function createBookmarkFolder(
  controller: ControllerBackend,
  params: { title: string; parentId?: string },
): Promise<BookmarkNode> {
  const result = await controller.send('createBookmarkFolder', params)
  return result as BookmarkNode
}

export async function getBookmarkChildren(
  controller: ControllerBackend,
  id: string,
): Promise<BookmarkNode[]> {
  const result = await controller.send('getBookmarkChildren', {
    folderId: id,
  })
  const data = result as { children: BookmarkNode[] }
  return data.children
}

export async function moveBookmark(
  controller: ControllerBackend,
  id: string,
  destination: { parentId?: string; index?: number },
): Promise<BookmarkNode> {
  const result = await controller.send('moveBookmark', {
    id,
    ...destination,
  })
  return result as BookmarkNode
}

export async function removeBookmarkTree(
  controller: ControllerBackend,
  id: string,
): Promise<void> {
  await controller.send('removeBookmarkTree', { id, confirm: true })
}
