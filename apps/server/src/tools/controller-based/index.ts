/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Response implementation
export { ControllerResponse } from './response/controller-response'
// All controller tools (named exports)
export * from './tools/index'
// Types
export type { Context } from './types/context'
export type { ImageContentData, Response } from './types/response'
// Utilities
export { parseDataUrl } from './utils/parse-data-url'

// Import all tools for the array export
import {
  checkAvailability,
  executeJavaScript,
  sendKeys,
} from './tools/advanced'
import { createBookmark, getBookmarks, removeBookmark } from './tools/bookmarks'
import { getPageContent } from './tools/content'
import { clickCoordinates, typeAtCoordinates } from './tools/coordinates'
import { getRecentHistory, searchHistory } from './tools/history'
import {
  clearInput,
  clickElement,
  getInteractiveElements,
  scrollToElement,
  typeText,
} from './tools/interaction'
import { navigate } from './tools/navigation'
import { getScreenshot, getScreenshotPointer } from './tools/screenshot'
import { scrollDown, scrollUp } from './tools/scrolling'
import {
  closeTab,
  getActiveTab,
  getLoadStatus,
  listTabs,
  openTab,
  switchTab,
} from './tools/tab-management'

// Array export for convenience (28 tools)
export const allControllerTools = [
  getActiveTab,
  listTabs,
  openTab,
  closeTab,
  switchTab,
  getLoadStatus,
  navigate,
  getInteractiveElements,
  clickElement,
  typeText,
  clearInput,
  scrollToElement,
  scrollDown,
  scrollUp,
  getScreenshot,
  getScreenshotPointer,
  getPageContent,
  executeJavaScript,
  sendKeys,
  checkAvailability,
  clickCoordinates,
  typeAtCoordinates,
  getBookmarks,
  createBookmark,
  removeBookmark,
  searchHistory,
  getRecentHistory,
]
