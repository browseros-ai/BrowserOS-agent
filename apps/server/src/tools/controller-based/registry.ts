/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Response implementation
export { ControllerResponse } from './response/controller-response'
// Advanced
export {
  checkAvailability,
  executeJavaScript,
  sendKeys,
} from './tools/advanced'
// Bookmark Management
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
// Content Extraction
export { getPageContent } from './tools/content'
// Coordinate-based
export { clickCoordinates, typeAtCoordinates } from './tools/coordinates'
// History Management
export { getRecentHistory, searchHistory } from './tools/history'
// Element Interaction
export {
  clearInput,
  clickElement,
  getInteractiveElements,
  grepInteractiveElements,
  scrollToElement,
  typeText,
} from './tools/interaction'
// Navigation
export { navigate } from './tools/navigation'
// Screenshots
export { getScreenshot, getScreenshotPointer } from './tools/screenshot'
// Scrolling
export { scrollDown, scrollUp } from './tools/scrolling'
// Tab Management
export {
  closeTab,
  getActiveTab,
  getLoadStatus,
  groupTabs,
  listTabGroups,
  listTabs,
  openTab,
  switchTab,
  ungroupTabs,
  updateTabGroup,
} from './tools/tab-management'

// Import all tools for the array export
// Disabled controller tools are intentionally commented to preserve for future re-enable.
// import {
//   checkAvailability,
//   executeJavaScript,
//   sendKeys,
// } from './tools/advanced'
// import { getPageContent } from './tools/content'
// import { clickCoordinates, typeAtCoordinates } from './tools/coordinates'
// import {
//   clearInput,
//   clickElement,
//   getInteractiveElements,
//   grepInteractiveElements,
//   scrollToElement,
//   typeText,
// } from './tools/interaction'
// import { navigate } from './tools/navigation'
// import { getScreenshot, getScreenshotPointer } from './tools/screenshot'
// import { scrollDown, scrollUp } from './tools/scrolling'
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
  closeTab,
  getActiveTab,
  getLoadStatus,
  groupTabs,
  listTabGroups,
  listTabs,
  openTab,
  switchTab,
  ungroupTabs,
  updateTabGroup,
} from './tools/tab-management'

// Array export for convenience (36 tools total)
// export const allControllerTools = [
//   getActiveTab,
//   listTabs,
//   openTab,
//   closeTab,
//   switchTab,
//   getLoadStatus,
//   listTabGroups,
//   groupTabs,
//   updateTabGroup,
//   ungroupTabs,
//   navigate,
//   getInteractiveElements,
//   grepInteractiveElements,
//   clickElement,
//   typeText,
//   clearInput,
//   scrollToElement,
//   scrollDown,
//   scrollUp,
//   getScreenshot,
//   getScreenshotPointer,
//   getPageContent,
//   executeJavaScript,
//   sendKeys,
//   checkAvailability,
//   clickCoordinates,
//   typeAtCoordinates,
//   getBookmarks,
//   createBookmark,
//   removeBookmark,
//   createBookmarkFolder,
//   getBookmarkChildren,
//   moveBookmark,
//   removeBookmarkTree,
//   updateBookmark,
//   searchHistory,
//   getRecentHistory,
// ]

export const allControllerTools = [
  getActiveTab,
  listTabs,
  openTab,
  closeTab,
  switchTab,
  getLoadStatus,
  listTabGroups,
  groupTabs,
  updateTabGroup,
  ungroupTabs,
  // navigate,
  // getInteractiveElements,
  // grepInteractiveElements,
  // clickElement,
  // typeText,
  // clearInput,
  // scrollToElement,
  // scrollDown,
  // scrollUp,
  // getScreenshot,
  // getScreenshotPointer,
  // getPageContent,
  // executeJavaScript,
  // sendKeys,
  // checkAvailability,
  // clickCoordinates,
  // typeAtCoordinates,
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
