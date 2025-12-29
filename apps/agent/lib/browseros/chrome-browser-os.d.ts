// biome-ignore-all lint/suspicious/noExplicitAny: Browser API type definitions require flexible types
declare namespace chrome.browserOS {
  interface PageLoadStatus {
    isResourcesLoading: boolean
    isDOMContentLoaded: boolean
    isPageComplete: boolean
  }

  interface Rect {
    x: number
    y: number
    width: number
    height: number
  }

  type BoundingRect = Rect

  type InteractiveNodeType = 'clickable' | 'typeable' | 'selectable' | 'other'

  type Key =
    | 'Enter'
    | 'Delete'
    | 'Backspace'
    | 'Tab'
    | 'Escape'
    | 'ArrowUp'
    | 'ArrowDown'
    | 'ArrowLeft'
    | 'ArrowRight'
    | 'Home'
    | 'End'
    | 'PageUp'
    | 'PageDown'

  interface InteractiveNode {
    nodeId: number
    type: InteractiveNodeType
    name?: string
    rect?: Rect
    attributes?: {
      in_viewport?: string
      [key: string]: any
    }
  }

  interface InteractiveSnapshot {
    snapshotId: number
    timestamp: number
    elements: InteractiveNode[]
    hierarchicalStructure?: string
    processingTimeMs: number
  }

  interface InteractiveSnapshotOptions {
    viewportOnly?: boolean
  }

  interface AccessibilityNode {
    id: number
    role: string
    name?: string
    value?: string
    attributes?: Record<string, any>
    childIds?: number[]
  }

  interface AccessibilityTree {
    rootId: number
    nodes: Record<string, AccessibilityNode>
  }

  // Snapshot types (new items-based format)
  interface SnapshotItem {
    text: string
    type: 'heading' | 'link' | 'text'
    level?: number
    url?: string
  }

  interface Snapshot {
    items: SnapshotItem[]
  }

  type SnapshotContext = 'visible' | 'full'

  interface SnapshotOptions {
    context?: SnapshotContext
  }

  interface PrefObject {
    key: string
    type: string
    value: any
  }

  // API functions
  function getPageLoadStatus(
    tabId: number,
    callback: (status: PageLoadStatus) => void,
  ): void
  function getPageLoadStatus(callback: (status: PageLoadStatus) => void): void

  function getAccessibilityTree(
    tabId: number,
    callback: (tree: AccessibilityTree) => void,
  ): void
  function getAccessibilityTree(
    callback: (tree: AccessibilityTree) => void,
  ): void

  function getInteractiveSnapshot(
    tabId: number,
    options: InteractiveSnapshotOptions,
    callback: (snapshot: InteractiveSnapshot) => void,
  ): void
  function getInteractiveSnapshot(
    tabId: number,
    callback: (snapshot: InteractiveSnapshot) => void,
  ): void
  function getInteractiveSnapshot(
    options: InteractiveSnapshotOptions,
    callback: (snapshot: InteractiveSnapshot) => void,
  ): void
  function getInteractiveSnapshot(
    callback: (snapshot: InteractiveSnapshot) => void,
  ): void

  function click(tabId: number, nodeId: number, callback: () => void): void
  function click(nodeId: number, callback: () => void): void

  function inputText(
    tabId: number,
    nodeId: number,
    text: string,
    callback: () => void,
  ): void
  function inputText(nodeId: number, text: string, callback: () => void): void

  function clear(tabId: number, nodeId: number, callback: () => void): void
  function clear(nodeId: number, callback: () => void): void

  function scrollUp(tabId: number, callback: () => void): void
  function scrollUp(callback: () => void): void

  function scrollDown(tabId: number, callback: () => void): void
  function scrollDown(callback: () => void): void

  function scrollToNode(
    tabId: number,
    nodeId: number,
    callback: (scrolled: boolean) => void,
  ): void
  function scrollToNode(
    nodeId: number,
    callback: (scrolled: boolean) => void,
  ): void

  function sendKeys(tabId: number, key: Key, callback: () => void): void
  function sendKeys(key: Key, callback: () => void): void

  function captureScreenshot(
    tabId: number,
    thumbnailSize: number,
    showHighlights: boolean,
    width: number,
    height: number,
    callback: (dataUrl: string) => void,
  ): void
  function captureScreenshot(
    tabId: number,
    thumbnailSize: number,
    showHighlights: boolean,
    callback: (dataUrl: string) => void,
  ): void
  function captureScreenshot(
    tabId: number,
    thumbnailSize: number,
    callback: (dataUrl: string) => void,
  ): void
  function captureScreenshot(
    tabId: number,
    callback: (dataUrl: string) => void,
  ): void
  function captureScreenshot(callback: (dataUrl: string) => void): void

  function getSnapshot(
    tabId: number,
    options: SnapshotOptions,
    callback: (snapshot: Snapshot) => void,
  ): void
  function getSnapshot(
    tabId: number,
    callback: (snapshot: Snapshot) => void,
  ): void

  function getVersionNumber(callback: (version: string) => void): void

  function getBrowserosVersionNumber(callback: (version: string) => void): void

  function logMetric(
    eventName: string,
    properties: Record<string, any>,
    callback: () => void,
  ): void
  function logMetric(eventName: string, callback: () => void): void
  function logMetric(eventName: string, properties?: Record<string, any>): void
  function logMetric(eventName: string): void

  function executeJavaScript(
    tabId: number,
    code: string,
    callback: (result: any) => void,
  ): void
  function executeJavaScript(
    code: string,
    callback: (result: any) => void,
  ): void

  function clickCoordinates(
    tabId: number,
    x: number,
    y: number,
    callback: () => void,
  ): void
  function clickCoordinates(x: number, y: number, callback: () => void): void

  function typeAtCoordinates(
    tabId: number,
    x: number,
    y: number,
    text: string,
    callback: () => void,
  ): void
  function typeAtCoordinates(
    x: number,
    y: number,
    text: string,
    callback: () => void,
  ): void

  function getPref(name: string, callback: (pref: PrefObject) => void): void

  function setPref(
    name: string,
    value: any,
    pageId: string,
    callback: (success: boolean) => void,
  ): void
  function setPref(
    name: string,
    value: any,
    callback: (success: boolean) => void,
  ): void

  function getAllPrefs(callback: (prefs: PrefObject[]) => void): void
}
