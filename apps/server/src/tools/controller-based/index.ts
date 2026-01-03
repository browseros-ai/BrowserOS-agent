/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Response implementation
export { ControllerResponse } from './response/controller-response.js'
// All controller tools (named exports)
export * from './tools/index.js'
// Types
export type { Context } from './types/context.js'
export type { ImageContentData, Response } from './types/response.js'
// Utilities
export { parseDataUrl } from './utils/parse-data-url.js'

// Import all tools for the array export
import {
  checkAvailability,
  executeJavaScript,
  sendKeys,
} from './tools/advanced.js'
import {
  createBookmark,
  getBookmarks,
  removeBookmark,
} from './tools/bookmarks.js'
import { getPageContent } from './tools/content.js'
import { clickCoordinates, typeAtCoordinates } from './tools/coordinates.js'
import { getRecentHistory, searchHistory } from './tools/history.js'
import {
  clearInput,
  clickElement,
  getInteractiveElements,
  scrollToElement,
  typeText,
} from './tools/interaction.js'
import { navigate } from './tools/navigation.js'
import { getScreenshot, getScreenshotPointer } from './tools/screenshot.js'
import { scrollDown, scrollUp } from './tools/scrolling.js'
import {
  closeTab,
  getActiveTab,
  getLoadStatus,
  listTabs,
  openTab,
  switchTab,
} from './tools/tab-management.js'

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
