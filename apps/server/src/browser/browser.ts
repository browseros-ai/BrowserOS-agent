import { logger } from '../lib/logger'
import type { CdpBackend, ControllerBackend } from './backends/types'
import type { BookmarkNode } from './bookmarks'
import * as bookmarks from './bookmarks'
import * as elements from './elements'
import type { HistoryEntry } from './history'
import * as history from './history'
import * as keyboard from './keyboard'
import * as mouse from './mouse'
import type { AXNode } from './snapshot'
import * as snapshot from './snapshot'
import type { TabGroup } from './tab-groups'
import * as tabGroups from './tab-groups'

export interface PageInfo {
  pageId: number
  targetId: string
  tabId?: number
  windowId?: number
  title: string
  url: string
}

export interface LoadStatus {
  tabId: number
  isResourcesLoading: boolean
  isDOMContentLoaded: boolean
  isPageComplete: boolean
}

const EXCLUDED_URL_PREFIXES = [
  'chrome-extension://',
  'chrome://',
  'chrome-untrusted://',
  'chrome-search://',
  'devtools://',
]

export class Browser {
  private cdp: CdpBackend
  private controller: ControllerBackend
  private pages = new Map<number, PageInfo>()
  private sessions = new Map<string, string>()
  private nextPageId = 1

  constructor(cdp: CdpBackend, controller: ControllerBackend) {
    this.cdp = cdp
    this.controller = controller
    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    this.cdp.on('Target.detachedFromTarget', (params) => {
      const { sessionId } = params as { sessionId?: string }
      if (sessionId) {
        for (const [targetId, sid] of this.sessions) {
          if (sid === sessionId) {
            this.sessions.delete(targetId)
            break
          }
        }
      }
    })
  }

  // --- Session management ---

  private async resolvePage(page: number): Promise<string> {
    let info = this.pages.get(page)
    if (!info) {
      await this.listPages()
      info = this.pages.get(page)
    }
    if (!info)
      throw new Error(
        `Unknown page ${page}. Use list_pages to see available pages.`,
      )
    return this.attachToPage(info.targetId)
  }

  private async attachToPage(targetId: string): Promise<string> {
    const cached = this.sessions.get(targetId)
    if (cached) return cached

    const result = (await this.cdp.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    })) as { sessionId: string }

    const sessionId = result.sessionId

    await Promise.all([
      this.cdp.send('Page.enable', {}, sessionId),
      this.cdp.send('DOM.enable', {}, sessionId),
      this.cdp.send('Runtime.enable', {}, sessionId),
      this.cdp.send('Accessibility.enable', {}, sessionId),
    ])

    this.sessions.set(targetId, sessionId)
    return sessionId
  }

  // --- Pages ---

  async listPages(): Promise<PageInfo[]> {
    const targets = await this.cdp.getTargets()
    const pages = targets.filter(
      (t) =>
        t.type === 'page' &&
        !EXCLUDED_URL_PREFIXES.some((prefix) => t.url.startsWith(prefix)),
    )

    const seenTargetIds = new Set<string>()

    for (const target of pages) {
      seenTargetIds.add(target.id)

      let found = false
      for (const info of this.pages.values()) {
        if (info.targetId === target.id) {
          info.title = target.title
          info.url = target.url
          info.tabId = target.tabId
          info.windowId = target.windowId
          found = true
          break
        }
      }

      if (!found) {
        const pageId = this.nextPageId++
        this.pages.set(pageId, {
          pageId,
          targetId: target.id,
          tabId: target.tabId,
          windowId: target.windowId,
          title: target.title,
          url: target.url,
        })
      }
    }

    for (const [pageId, info] of this.pages) {
      if (!seenTargetIds.has(info.targetId)) {
        this.pages.delete(pageId)
      }
    }

    return [...this.pages.values()].sort((a, b) => a.pageId - b.pageId)
  }

  async newPage(url: string): Promise<number> {
    const result = (await this.cdp.send('Target.createTarget', {
      url,
    })) as {
      targetId: string
    }

    await this.listPages()

    for (const [pageId, info] of this.pages) {
      if (info.targetId === result.targetId) {
        return pageId
      }
    }

    const pageId = this.nextPageId++
    this.pages.set(pageId, {
      pageId,
      targetId: result.targetId,
      title: '',
      url,
    })
    return pageId
  }

  async closePage(page: number): Promise<void> {
    const info = this.pages.get(page)
    if (!info)
      throw new Error(
        `Unknown page ${page}. Use list_pages to see available pages.`,
      )
    await this.cdp.send('Target.closeTarget', {
      targetId: info.targetId,
    })
    this.pages.delete(page)
    this.sessions.delete(info.targetId)
  }

  // --- Navigation ---

  async goto(page: number, url: string): Promise<void> {
    const sessionId = await this.resolvePage(page)
    await this.cdp.send('Page.navigate', { url }, sessionId)
    try {
      await this.cdp.send(
        'Page.setLifecycleEventsEnabled',
        { enabled: true },
        sessionId,
      )
    } catch {
      // not critical
    }
  }

  async goBack(page: number): Promise<void> {
    const sessionId = await this.resolvePage(page)
    await this.cdp.send(
      'Runtime.evaluate',
      { expression: 'history.back()', awaitPromise: true },
      sessionId,
    )
  }

  async goForward(page: number): Promise<void> {
    const sessionId = await this.resolvePage(page)
    await this.cdp.send(
      'Runtime.evaluate',
      { expression: 'history.forward()', awaitPromise: true },
      sessionId,
    )
  }

  async reload(page: number): Promise<void> {
    const sessionId = await this.resolvePage(page)
    await this.cdp.send('Page.reload', {}, sessionId)
  }

  async waitFor(
    page: number,
    opts: { text?: string; selector?: string; timeout: number },
  ): Promise<boolean> {
    const sessionId = await this.resolvePage(page)
    const deadline = Date.now() + opts.timeout
    const interval = 500

    while (Date.now() < deadline) {
      if (opts.text) {
        const result = (await this.cdp.send(
          'Runtime.evaluate',
          {
            expression: `document.body?.innerText?.includes(${JSON.stringify(opts.text)}) ?? false`,
            returnByValue: true,
          },
          sessionId,
        )) as { result?: { value?: boolean } }
        if (result.result?.value === true) return true
      }

      if (opts.selector) {
        const result = (await this.cdp.send(
          'Runtime.evaluate',
          {
            expression: `!!document.querySelector(${JSON.stringify(opts.selector)})`,
            returnByValue: true,
          },
          sessionId,
        )) as { result?: { value?: boolean } }
        if (result.result?.value === true) return true
      }

      await new Promise((r) => setTimeout(r, interval))
    }

    return false
  }

  // --- Observation ---

  private async fetchAXTree(sessionId: string): Promise<AXNode[]> {
    const result = (await this.cdp.send(
      'Accessibility.getFullAXTree',
      {},
      sessionId,
    )) as {
      nodes: AXNode[]
    }
    return result.nodes ?? []
  }

  async snapshot(page: number): Promise<string> {
    const sessionId = await this.resolvePage(page)
    const nodes = await this.fetchAXTree(sessionId)
    if (nodes.length === 0) return ''
    return snapshot.buildInteractiveTree(nodes).join('\n')
  }

  async enhancedSnapshot(page: number): Promise<string> {
    const sessionId = await this.resolvePage(page)
    const nodes = await this.fetchAXTree(sessionId)
    if (nodes.length === 0) return ''

    const treeLines = snapshot.buildEnhancedTree(nodes)

    try {
      const cursorElements = await snapshot.findCursorInteractiveElements(
        this.cdp,
        sessionId,
      )

      if (cursorElements.length > 0) {
        const existingIds = new Set<number>()
        for (const node of nodes) {
          if (node.backendDOMNodeId !== undefined)
            existingIds.add(node.backendDOMNodeId)
        }

        const extras: string[] = []
        for (const el of cursorElements) {
          if (existingIds.has(el.backendNodeId)) continue
          extras.push(
            `[${el.backendNodeId}] clickable "${el.text}" (${el.reasons.join(', ')})`,
          )
        }

        if (extras.length > 0) {
          treeLines.push('# Cursor-interactive (no ARIA role):')
          treeLines.push(...extras)
        }
      }
    } catch (err) {
      logger.debug('Cursor-interactive detection failed', {
        error: String(err),
      })
    }

    return treeLines.join('\n')
  }

  async content(page: number, selector?: string): Promise<string> {
    const sessionId = await this.resolvePage(page)
    const expression = selector
      ? `(document.querySelector(${JSON.stringify(selector)})?.innerText ?? '')`
      : `(document.body?.innerText ?? '')`

    const result = (await this.cdp.send(
      'Runtime.evaluate',
      { expression, returnByValue: true },
      sessionId,
    )) as { result?: { value?: string } }

    return result.result?.value ?? ''
  }

  async screenshot(
    page: number,
    opts: { format: string; quality?: number; fullPage: boolean },
  ): Promise<{ data: string; mimeType: string }> {
    const sessionId = await this.resolvePage(page)

    const params: Record<string, unknown> = {
      format: opts.format,
      captureBeyondViewport: opts.fullPage,
    }
    if (opts.quality !== undefined) params.quality = opts.quality

    const result = (await this.cdp.send(
      'Page.captureScreenshot',
      params,
      sessionId,
    )) as {
      data: string
    }

    return { data: result.data, mimeType: `image/${opts.format}` }
  }

  async evaluate(
    page: number,
    expression: string,
  ): Promise<{
    value?: unknown
    error?: string
    description?: string
  }> {
    const sessionId = await this.resolvePage(page)

    const result = (await this.cdp.send(
      'Runtime.evaluate',
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId,
    )) as {
      result?: {
        type: string
        value?: unknown
        description?: string
      }
      exceptionDetails?: {
        text: string
        exception?: { description?: string }
      }
    }

    if (result.exceptionDetails) {
      return {
        error:
          result.exceptionDetails.exception?.description ??
          result.exceptionDetails.text,
      }
    }

    return {
      value: result.result?.value,
      description: result.result?.description,
    }
  }

  // --- Input ---

  async click(
    page: number,
    element: number,
    opts?: { button?: string; clickCount?: number },
  ): Promise<void> {
    const sessionId = await this.resolvePage(page)

    await elements.scrollIntoView(this.cdp, element, sessionId)

    try {
      const { x, y } = await elements.getElementCenter(
        this.cdp,
        element,
        sessionId,
      )
      await mouse.dispatchClick(
        this.cdp,
        sessionId,
        x,
        y,
        opts?.button ?? 'left',
        opts?.clickCount ?? 1,
        0,
      )
    } catch {
      logger.debug(
        `CDP click failed for element=${element}, falling back to JS click`,
      )
      await elements.jsClick(this.cdp, element, sessionId)
    }
  }

  async clickAt(
    page: number,
    x: number,
    y: number,
    opts?: { button?: string; clickCount?: number },
  ): Promise<void> {
    const sessionId = await this.resolvePage(page)
    await mouse.dispatchClick(
      this.cdp,
      sessionId,
      x,
      y,
      opts?.button ?? 'left',
      opts?.clickCount ?? 1,
      0,
    )
  }

  async hover(page: number, element: number): Promise<void> {
    const sessionId = await this.resolvePage(page)

    await elements.scrollIntoView(this.cdp, element, sessionId)
    const { x, y } = await elements.getElementCenter(
      this.cdp,
      element,
      sessionId,
    )
    await mouse.dispatchHover(this.cdp, sessionId, x, y)
  }

  async fill(
    page: number,
    element: number,
    text: string,
    clear = true,
  ): Promise<void> {
    const sessionId = await this.resolvePage(page)

    await elements.scrollIntoView(this.cdp, element, sessionId)

    try {
      await elements.focusElement(this.cdp, element, sessionId)
    } catch {
      try {
        const { x, y } = await elements.getElementCenter(
          this.cdp,
          element,
          sessionId,
        )
        await mouse.dispatchClick(this.cdp, sessionId, x, y, 'left', 1, 0)
      } catch {
        logger.warn('Could not focus element via click either')
      }
    }

    if (clear) await keyboard.clearField(this.cdp, sessionId)
    await keyboard.typeText(this.cdp, sessionId, text)
  }

  async pressKey(page: number, key: string): Promise<void> {
    const sessionId = await this.resolvePage(page)
    await keyboard.pressCombo(this.cdp, sessionId, key)
  }

  async drag(
    page: number,
    sourceElement: number,
    target: { element?: number; x?: number; y?: number },
  ): Promise<void> {
    const sessionId = await this.resolvePage(page)

    await elements.scrollIntoView(this.cdp, sourceElement, sessionId)
    const from = await elements.getElementCenter(
      this.cdp,
      sourceElement,
      sessionId,
    )

    let to: { x: number; y: number }
    if (target.element !== undefined) {
      to = await elements.getElementCenter(this.cdp, target.element, sessionId)
    } else if (target.x !== undefined && target.y !== undefined) {
      to = { x: target.x, y: target.y }
    } else {
      throw new Error(
        'Provide either target element or both targetX and targetY.',
      )
    }

    await mouse.dispatchDrag(this.cdp, sessionId, from, to)
  }

  async scroll(
    page: number,
    direction: string,
    amount: number,
    element?: number,
  ): Promise<void> {
    const sessionId = await this.resolvePage(page)
    const pixels = amount * 120

    let x: number
    let y: number
    if (element !== undefined) {
      const center = await elements.getElementCenter(
        this.cdp,
        element,
        sessionId,
      )
      x = center.x
      y = center.y
    } else {
      const metrics = (await this.cdp.send(
        'Page.getLayoutMetrics',
        {},
        sessionId,
      )) as {
        layoutViewport: {
          clientWidth: number
          clientHeight: number
        }
      }
      x = metrics.layoutViewport.clientWidth / 2
      y = metrics.layoutViewport.clientHeight / 2
    }

    const deltaX =
      direction === 'left' ? -pixels : direction === 'right' ? pixels : 0
    const deltaY =
      direction === 'up' ? -pixels : direction === 'down' ? pixels : 0

    await mouse.dispatchScroll(this.cdp, sessionId, x, y, deltaX, deltaY)
  }

  async handleDialog(
    page: number,
    accept: boolean,
    promptText?: string,
  ): Promise<void> {
    const sessionId = await this.resolvePage(page)
    const params: Record<string, unknown> = { accept }
    if (promptText !== undefined) params.promptText = promptText
    await this.cdp.send('Page.handleJavaScriptDialog', params, sessionId)
  }

  async selectOption(
    page: number,
    element: number,
    value: string,
  ): Promise<string | null> {
    const sessionId = await this.resolvePage(page)

    const selected = await elements.callOnElement(
      this.cdp,
      element,
      sessionId,
      `function(val){
				for(var i=0;i<this.options.length;i++){
					if(this.options[i].value===val||this.options[i].textContent.trim()===val){
						this.selectedIndex=i;
						this.dispatchEvent(new Event('change',{bubbles:true}));
						return this.options[i].textContent.trim();
					}
				}
				return null;
			}`,
      [value],
    )

    return selected as string | null
  }

  // --- Controller: Bookmarks ---

  async getBookmarks(folderId?: string): Promise<BookmarkNode[]> {
    return bookmarks.getBookmarks(this.controller, folderId)
  }

  async createBookmark(params: {
    url: string
    title: string
    parentId?: string
  }): Promise<BookmarkNode> {
    return bookmarks.createBookmark(this.controller, params)
  }

  async removeBookmark(id: string): Promise<void> {
    return bookmarks.removeBookmark(this.controller, id)
  }

  async updateBookmark(
    id: string,
    changes: { url?: string; title?: string },
  ): Promise<BookmarkNode> {
    return bookmarks.updateBookmark(this.controller, id, changes)
  }

  async createBookmarkFolder(params: {
    title: string
    parentId?: string
  }): Promise<BookmarkNode> {
    return bookmarks.createBookmarkFolder(this.controller, params)
  }

  async getBookmarkChildren(id: string): Promise<BookmarkNode[]> {
    return bookmarks.getBookmarkChildren(this.controller, id)
  }

  async moveBookmark(
    id: string,
    destination: { parentId?: string; index?: number },
  ): Promise<BookmarkNode> {
    return bookmarks.moveBookmark(this.controller, id, destination)
  }

  async removeBookmarkTree(id: string): Promise<void> {
    return bookmarks.removeBookmarkTree(this.controller, id)
  }

  // --- Controller: History ---

  async searchHistory(
    query: string,
    maxResults?: number,
  ): Promise<HistoryEntry[]> {
    return history.searchHistory(this.controller, query, maxResults)
  }

  async getRecentHistory(maxResults?: number): Promise<HistoryEntry[]> {
    return history.getRecentHistory(this.controller, maxResults)
  }

  // --- Controller: Tab Groups ---

  async listTabGroups(): Promise<TabGroup[]> {
    return tabGroups.listTabGroups(this.controller)
  }

  async groupTabs(
    tabIds: number[],
    opts?: { title?: string; color?: string; groupId?: number },
  ): Promise<TabGroup> {
    return tabGroups.groupTabs(this.controller, tabIds, opts)
  }

  async updateTabGroup(
    groupId: number,
    opts: { title?: string; color?: string; collapsed?: boolean },
  ): Promise<TabGroup> {
    return tabGroups.updateTabGroup(this.controller, groupId, opts)
  }

  async ungroupTabs(tabIds: number[]): Promise<{ ungroupedCount: number }> {
    return tabGroups.ungroupTabs(this.controller, tabIds)
  }

  // --- Controller: Status ---

  async getLoadStatus(tabId: number): Promise<LoadStatus> {
    const result = await this.controller.send('getPageLoadStatus', {
      tabId,
    })
    return result as LoadStatus
  }
}
