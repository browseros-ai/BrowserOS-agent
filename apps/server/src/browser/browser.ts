import { logger } from '../lib/logger'
import type { CdpBackend, ControllerBackend } from './backends/types'
import type { BookmarkNode } from './bookmarks'
import * as bookmarks from './bookmarks'
import {
  buildContentMarkdownExpression,
  type ContentMarkdownOptions,
} from './content-markdown'
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
  tabId: number
  windowId: number
  title: string
  url: string
  isActive?: boolean
  isLoading?: boolean
  isPinned?: boolean
  isHidden?: boolean
  groupId?: string
  index?: number
}

export interface WindowInfo {
  windowId: number
  isHidden?: boolean
}

interface TabInfo {
  tabId: number
  targetId: string
  windowId: number
  title: string
  url: string
  isActive?: boolean
  isLoading?: boolean
  isPinned?: boolean
  isHidden?: boolean
  groupId?: string
  index?: number
}

const EXCLUDED_URL_PREFIXES = [
  'chrome-extension://',
  // chrome://new-tab comes in this let's keep it
  // 'chrome://',
  'chrome-untrusted://',
  'chrome-search://',
  'devtools://',
]

export class Browser {
  private cdp: CdpBackend
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: kept for later removal
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
    const result = (await this.cdp.send('Browser.getTabs', {
      includeHidden: true,
    })) as { tabs: TabInfo[] }
    const tabs = result.tabs.filter(
      (t) => !EXCLUDED_URL_PREFIXES.some((prefix) => t.url.startsWith(prefix)),
    )

    const seenTargetIds = new Set<string>()

    for (const tab of tabs) {
      seenTargetIds.add(tab.targetId)

      let found = false
      for (const info of this.pages.values()) {
        if (info.targetId === tab.targetId) {
          info.title = tab.title
          info.url = tab.url
          info.tabId = tab.tabId
          info.windowId = tab.windowId
          info.isActive = tab.isActive
          info.isLoading = tab.isLoading
          info.isPinned = tab.isPinned
          info.isHidden = tab.isHidden
          info.groupId = tab.groupId
          info.index = tab.index
          found = true
          break
        }
      }

      if (!found) {
        const pageId = this.nextPageId++
        this.pages.set(pageId, {
          pageId,
          targetId: tab.targetId,
          tabId: tab.tabId,
          windowId: tab.windowId,
          title: tab.title,
          url: tab.url,
          isActive: tab.isActive,
          isLoading: tab.isLoading,
          isPinned: tab.isPinned,
          isHidden: tab.isHidden,
          groupId: tab.groupId,
          index: tab.index,
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

  async resolveTabIds(tabIds: number[]): Promise<Map<number, number>> {
    await this.listPages()
    const tabToPage = new Map<number, number>()
    for (const info of this.pages.values()) {
      if (tabIds.includes(info.tabId)) {
        tabToPage.set(info.tabId, info.pageId)
      }
    }
    return tabToPage
  }

  async getActivePage(): Promise<PageInfo | null> {
    const result = (await this.cdp.send('Browser.getActiveTab')) as {
      tabId: number
      targetId: string
    }

    await this.listPages()

    for (const info of this.pages.values()) {
      if (info.targetId === result.targetId) return info
    }

    return null
  }

  async newPage(
    url: string,
    opts?: { hidden?: boolean; background?: boolean; windowId?: number },
  ): Promise<number> {
    const result = (await this.cdp.send('Browser.createTab', {
      url,
      ...(opts?.hidden !== undefined && { hidden: opts.hidden }),
      ...(opts?.background !== undefined && { background: opts.background }),
      ...(opts?.windowId !== undefined && { windowId: opts.windowId }),
    })) as { tabId: number }

    const tabInfo = (await this.cdp.send('Browser.getTabInfo', {
      tabId: result.tabId,
    })) as TabInfo

    const pageId = this.nextPageId++
    this.pages.set(pageId, {
      pageId,
      targetId: tabInfo.targetId,
      tabId: tabInfo.tabId,
      windowId: tabInfo.windowId,
      title: tabInfo.title || '',
      url: tabInfo.url || url,
      isHidden: tabInfo.isHidden,
      isPinned: tabInfo.isPinned,
      isActive: tabInfo.isActive,
      isLoading: tabInfo.isLoading,
      groupId: tabInfo.groupId,
      index: tabInfo.index,
    })
    return pageId
  }

  async closePage(page: number): Promise<void> {
    const info = this.pages.get(page)
    if (!info)
      throw new Error(
        `Unknown page ${page}. Use list_pages to see available pages.`,
      )
    await this.cdp.send('Browser.closeTab', { tabId: info.tabId })
    this.pages.delete(page)
    this.sessions.delete(info.targetId)
  }

  // --- Navigation ---

  private async waitForLoad(sessionId: string, timeout = 30000): Promise<void> {
    const deadline = Date.now() + timeout
    await new Promise((r) => setTimeout(r, 50))

    while (Date.now() < deadline) {
      try {
        const result = (await this.cdp.send(
          'Runtime.evaluate',
          { expression: 'document.readyState', returnByValue: true },
          sessionId,
        )) as { result?: { value?: string } }
        if (result.result?.value === 'complete') return
      } catch {
        // Context torn down during navigation — expected
      }
      await new Promise((r) => setTimeout(r, 150))
    }
  }

  async goto(page: number, url: string): Promise<void> {
    const sessionId = await this.resolvePage(page)
    await this.cdp.send('Page.navigate', { url }, sessionId)
    await this.waitForLoad(sessionId)
  }

  async goBack(page: number): Promise<void> {
    const sessionId = await this.resolvePage(page)
    await this.cdp.send(
      'Runtime.evaluate',
      { expression: 'history.back()', awaitPromise: true },
      sessionId,
    )
    await this.waitForLoad(sessionId)
  }

  async goForward(page: number): Promise<void> {
    const sessionId = await this.resolvePage(page)
    await this.cdp.send(
      'Runtime.evaluate',
      { expression: 'history.forward()', awaitPromise: true },
      sessionId,
    )
    await this.waitForLoad(sessionId)
  }

  async reload(page: number): Promise<void> {
    const sessionId = await this.resolvePage(page)
    await this.cdp.send('Page.reload', {}, sessionId)
    await this.waitForLoad(sessionId)
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

  async contentAsMarkdown(
    page: number,
    opts?: Omit<ContentMarkdownOptions, 'selector'> & { selector?: string },
  ): Promise<string> {
    const sessionId = await this.resolvePage(page)
    const expression = buildContentMarkdownExpression({
      selector: opts?.selector,
      viewportOnly: opts?.viewportOnly,
      includeLinks: opts?.includeLinks,
      includeImages: opts?.includeImages,
    })

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

  // --- Form helpers ---

  async focus(page: number, element: number): Promise<void> {
    const sessionId = await this.resolvePage(page)
    await elements.scrollIntoView(this.cdp, element, sessionId)
    await elements.focusElement(this.cdp, element, sessionId)
  }

  async check(page: number, element: number): Promise<boolean> {
    const sessionId = await this.resolvePage(page)
    const checked = await elements.callOnElement(
      this.cdp,
      element,
      sessionId,
      'function(){return this.checked}',
    )
    if (!checked) await this.click(page, element)
    return true
  }

  async uncheck(page: number, element: number): Promise<boolean> {
    const sessionId = await this.resolvePage(page)
    const checked = await elements.callOnElement(
      this.cdp,
      element,
      sessionId,
      'function(){return this.checked}',
    )
    if (checked) await this.click(page, element)
    return false
  }

  async uploadFile(
    page: number,
    element: number,
    files: string[],
  ): Promise<void> {
    const sessionId = await this.resolvePage(page)
    await this.cdp.send(
      'DOM.setFileInputFiles',
      { files, backendNodeId: element },
      sessionId,
    )
  }

  // --- File operations ---

  async printToPDF(
    page: number,
    opts?: { landscape?: boolean; printBackground?: boolean },
  ): Promise<{ data: string }> {
    const sessionId = await this.resolvePage(page)
    const result = (await this.cdp.send(
      'Page.printToPDF',
      {
        landscape: opts?.landscape ?? false,
        printBackground: opts?.printBackground ?? true,
      },
      sessionId,
    )) as { data: string }
    return { data: result.data }
  }

  async downloadViaClick(
    page: number,
    element: number,
    downloadPath: string,
  ): Promise<{ filePath: string; suggestedFilename: string }> {
    await this.cdp.send('Browser.setDownloadBehavior', {
      behavior: 'allowAndName',
      downloadPath,
      eventsEnabled: true,
    })

    return new Promise<{ filePath: string; suggestedFilename: string }>(
      (resolve, reject) => {
        let guid = ''
        let suggestedFilename = ''
        const timeout = setTimeout(() => {
          cleanUp()
          reject(new Error('Download timed out after 60s'))
        }, 60000)

        const unsubBegin = this.cdp.on(
          'Browser.downloadWillBegin',
          (params: unknown) => {
            const p = params as { guid: string; suggestedFilename: string }
            guid = p.guid
            suggestedFilename = p.suggestedFilename
          },
        )

        const unsubProgress = this.cdp.on(
          'Browser.downloadProgress',
          (params: unknown) => {
            const p = params as { guid: string; state: string }
            if (p.guid === guid && p.state === 'completed') {
              cleanUp()
              resolve({
                filePath: `${downloadPath}/${guid}`,
                suggestedFilename,
              })
            }
            if (p.guid === guid && p.state === 'canceled') {
              cleanUp()
              reject(new Error('Download was canceled'))
            }
          },
        )

        const cleanUp = () => {
          clearTimeout(timeout)
          unsubBegin()
          unsubProgress()
          this.cdp
            .send('Browser.setDownloadBehavior', { behavior: 'default' })
            .catch(() => {})
        }

        this.click(page, element).catch((err) => {
          cleanUp()
          reject(err)
        })
      },
    )
  }

  // --- Windows ---

  async listWindows(): Promise<WindowInfo[]> {
    const result = (await this.cdp.send('Browser.getWindows')) as {
      windows: WindowInfo[]
    }
    return result.windows
  }

  async createWindow(opts?: { hidden?: boolean }): Promise<WindowInfo> {
    const result = (await this.cdp.send('Browser.createWindow', {
      ...(opts?.hidden !== undefined && { hidden: opts.hidden }),
    })) as WindowInfo
    return result
  }

  async closeWindow(windowId: number): Promise<void> {
    await this.cdp.send('Browser.closeWindow', { windowId })
  }

  async activateWindow(windowId: number): Promise<void> {
    await this.cdp.send('Browser.activateWindow', { windowId })
  }

  // --- Bookmarks ---

  async getBookmarks(): Promise<BookmarkNode[]> {
    return bookmarks.getBookmarks(this.cdp)
  }

  async createBookmark(params: {
    title: string
    url?: string
    parentId?: string
  }): Promise<BookmarkNode> {
    return bookmarks.createBookmark(this.cdp, params)
  }

  async removeBookmark(id: string): Promise<void> {
    return bookmarks.removeBookmark(this.cdp, id)
  }

  async updateBookmark(
    id: string,
    changes: { url?: string; title?: string },
  ): Promise<BookmarkNode> {
    return bookmarks.updateBookmark(this.cdp, id, changes)
  }

  async moveBookmark(
    id: string,
    destination: { parentId?: string; index?: number },
  ): Promise<BookmarkNode> {
    return bookmarks.moveBookmark(this.cdp, id, destination)
  }

  async searchBookmarks(query: string): Promise<BookmarkNode[]> {
    return bookmarks.searchBookmarks(this.cdp, query)
  }

  // --- History ---

  async searchHistory(
    query: string,
    maxResults?: number,
  ): Promise<HistoryEntry[]> {
    return history.searchHistory(this.cdp, query, maxResults)
  }

  async getRecentHistory(maxResults?: number): Promise<HistoryEntry[]> {
    return history.getRecentHistory(this.cdp, maxResults)
  }

  async deleteHistoryUrl(url: string): Promise<void> {
    return history.deleteUrl(this.cdp, url)
  }

  async deleteHistoryRange(startTime: number, endTime: number): Promise<void> {
    return history.deleteRange(this.cdp, startTime, endTime)
  }

  // --- Tab Groups ---

  async listTabGroups(): Promise<TabGroup[]> {
    return tabGroups.listTabGroups(this.cdp)
  }

  async groupTabs(
    tabIds: number[],
    opts?: { title?: string; color?: string; groupId?: string },
  ): Promise<TabGroup> {
    return tabGroups.groupTabs(this.cdp, tabIds, opts)
  }

  async updateTabGroup(
    groupId: string,
    opts: { title?: string; color?: string; collapsed?: boolean },
  ): Promise<TabGroup> {
    return tabGroups.updateTabGroup(this.cdp, groupId, opts)
  }

  async ungroupTabs(tabIds: number[]): Promise<{ ungroupedCount: number }> {
    return tabGroups.ungroupTabs(this.cdp, tabIds)
  }

  async closeTabGroup(groupId: string): Promise<void> {
    return tabGroups.closeTabGroup(this.cdp, groupId)
  }
}
