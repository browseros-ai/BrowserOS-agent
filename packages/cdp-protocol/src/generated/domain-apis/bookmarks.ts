// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  CreateBookmarkParams,
  CreateBookmarkResult,
  GetBookmarksParams,
  GetBookmarksResult,
  MoveBookmarkParams,
  MoveBookmarkResult,
  RemoveBookmarkParams,
  SearchBookmarksParams,
  SearchBookmarksResult,
  UpdateBookmarkParams,
  UpdateBookmarkResult,
} from '../domains/bookmarks'

export interface BookmarksApi {
  // ── Commands ──

  getBookmarks(params?: GetBookmarksParams): Promise<GetBookmarksResult>
  searchBookmarks(params: SearchBookmarksParams): Promise<SearchBookmarksResult>
  createBookmark(params: CreateBookmarkParams): Promise<CreateBookmarkResult>
  updateBookmark(params: UpdateBookmarkParams): Promise<UpdateBookmarkResult>
  moveBookmark(params: MoveBookmarkParams): Promise<MoveBookmarkResult>
  removeBookmark(params: RemoveBookmarkParams): Promise<void>
}
