/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export { ControllerResponse } from './response/controller-response'

export {
  createBookmark,
  createBookmarkFolder,
  getBookmarkChildren,
  getBookmarks,
  moveBookmark,
  removeBookmark,
  removeBookmarkTree,
  updateBookmark,
} from './tools/bookmarks'
export { getRecentHistory, searchHistory } from './tools/history'
export {
  groupTabs,
  listTabGroups,
  ungroupTabs,
  updateTabGroup,
} from './tools/tab-groups'

import {
  createBookmark,
  createBookmarkFolder,
  getBookmarkChildren,
  getBookmarks,
  moveBookmark,
  removeBookmark,
  removeBookmarkTree,
  updateBookmark,
} from './tools/bookmarks'
import { getRecentHistory, searchHistory } from './tools/history'
import {
  groupTabs,
  listTabGroups,
  ungroupTabs,
  updateTabGroup,
} from './tools/tab-groups'

export const allControllerTools = [
  listTabGroups,
  groupTabs,
  updateTabGroup,
  ungroupTabs,
  getBookmarks,
  createBookmark,
  removeBookmark,
  createBookmarkFolder,
  getBookmarkChildren,
  moveBookmark,
  removeBookmarkTree,
  updateBookmark,
  searchHistory,
  getRecentHistory,
]
