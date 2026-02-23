// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

// ══ Types ══

export type BookmarkID = string

export type BookmarkNodeType = 'url' | 'folder'

export interface BookmarkNode {
  id: BookmarkID
  parentId?: BookmarkID
  index?: number
  title: string
  url?: string
  type: BookmarkNodeType
  dateAdded: number
  dateLastUsed?: number
}

// ══ Commands ══

export interface GetBookmarksParams {
  folderId?: BookmarkID
}

export interface GetBookmarksResult {
  nodes: BookmarkNode[]
}

export interface SearchBookmarksParams {
  query: string
  maxResults?: number
}

export interface SearchBookmarksResult {
  results: BookmarkNode[]
}

export interface CreateBookmarkParams {
  title: string
  url?: string
  parentId?: BookmarkID
  index?: number
}

export interface CreateBookmarkResult {
  node: BookmarkNode
}

export interface UpdateBookmarkParams {
  id: BookmarkID
  title?: string
  url?: string
}

export interface UpdateBookmarkResult {
  node: BookmarkNode
}

export interface MoveBookmarkParams {
  id: BookmarkID
  parentId?: BookmarkID
  index?: number
}

export interface MoveBookmarkResult {
  node: BookmarkNode
}

export interface RemoveBookmarkParams {
  id: BookmarkID
}
