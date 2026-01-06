/**
 * @license
 * Copyright 2025 BrowserOS
 */

// Advanced
export { checkAvailability, executeJavaScript, sendKeys } from './advanced'
// Bookmark Management
export { createBookmark, getBookmarks, removeBookmark } from './bookmarks'
// Content Extraction
export { getPageContent } from './content'
// Coordinate-based
export { clickCoordinates, typeAtCoordinates } from './coordinates'
// History Management
export { getRecentHistory, searchHistory } from './history'
// Element Interaction
export {
  clearInput,
  clickElement,
  getInteractiveElements,
  scrollToElement,
  typeText,
} from './interaction'
// Navigation
export { navigate } from './navigation'
// Screenshots
export { getScreenshot, getScreenshotPointer } from './screenshot'
// Scrolling
export { scrollDown, scrollUp } from './scrolling'
// Tab Management
export {
  closeTab,
  getActiveTab,
  getLoadStatus,
  listTabs,
  openTab,
  switchTab,
} from './tab-management'
