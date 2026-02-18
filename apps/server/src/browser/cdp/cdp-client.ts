/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type {
  GeolocationOptions,
  TextSnapshot,
  TextSnapshotNode,
} from '../../tools/cdp/context/cdp-context'
import {
  extractUrlLikeFromDevToolsTitle,
  UniverseManager,
  urlsEqual,
} from '../../tools/cdp/context/devtools-utils'
import { WaitForHelper } from '../../tools/cdp/context/wait-for-helper'
import type {
  Browser,
  Debugger,
  Dialog,
  ElementHandle,
  Page,
  PredefinedNetworkConditions,
  SerializedAXNode,
  Viewport,
} from '../../tools/cdp/third-party'
import { Locator } from '../../tools/cdp/third-party'
import { listPages } from '../../tools/cdp/tools/pages'
import { takeSnapshot } from '../../tools/cdp/tools/snapshot'
import type {
  Context,
  DevToolsData,
} from '../../tools/cdp/types/cdp-tool-definition'
import { CLOSE_PAGE_ERROR } from '../../tools/cdp/types/cdp-tool-definition'
import type { PageRegistry } from '../page-registry'
import type { SessionState } from '../session-state'

export type { TextSnapshot, TextSnapshotNode, GeolocationOptions }

interface CdpClientOptions {
  experimentalDevToolsDebugging: boolean
  experimentalIncludeAllPages?: boolean
}

const DEFAULT_TIMEOUT = 5_000
const NAVIGATION_TIMEOUT = 10_000

function getNetworkMultiplierFromString(condition: string | null): number {
  const puppeteerCondition =
    condition as keyof typeof PredefinedNetworkConditions

  switch (puppeteerCondition) {
    case 'Fast 4G':
      return 1
    case 'Slow 4G':
      return 2.5
    case 'Fast 3G':
      return 5
    case 'Slow 3G':
      return 10
  }
  return 1
}

function getExtensionFromMimeType(mimeType: string) {
  switch (mimeType) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpeg'
    case 'image/webp':
      return 'webp'
  }
  throw new Error(`No mapping for Mime type ${mimeType}.`)
}

export class CdpClient implements Context {
  browser: Browser
  logger: Debugger

  #pages: Page[] = []
  #pageToDevToolsPage = new Map<Page, Page>()
  #pageScope = new AsyncLocalStorage<{ page: Page; state: SessionState }>()
  #devtoolsUniverseManager: UniverseManager
  #registry: PageRegistry

  #networkConditionsMap = new WeakMap<Page, string>()
  #cpuThrottlingRateMap = new WeakMap<Page, number>()
  #geolocationMap = new WeakMap<Page, GeolocationOptions>()
  #viewportMap = new WeakMap<Page, Viewport>()
  #userAgentMap = new WeakMap<Page, string>()
  #colorSchemeMap = new WeakMap<Page, 'dark' | 'light'>()
  #dialogs = new Map<Page, Dialog>()
  #dialogHandlerPages = new WeakSet<Page>()

  #locatorClass: typeof Locator
  #options: CdpClientOptions

  private constructor(
    browser: Browser,
    logger: Debugger,
    options: CdpClientOptions,
    registry: PageRegistry,
    locatorClass: typeof Locator,
  ) {
    this.browser = browser
    this.logger = logger
    this.#locatorClass = locatorClass
    this.#options = options
    this.#registry = registry
    this.#devtoolsUniverseManager = new UniverseManager()
  }

  async #init() {
    const pages = await this.createPagesSnapshot()
    await this.#devtoolsUniverseManager.init(pages)
  }

  dispose() {
    this.#devtoolsUniverseManager.dispose()
  }

  static async from(
    browser: Browser,
    logger: Debugger,
    opts: CdpClientOptions,
    registry: PageRegistry,
    locatorClass: typeof Locator = Locator,
  ) {
    const client = new CdpClient(browser, logger, opts, registry, locatorClass)
    await client.#init()
    return client
  }

  #getState(): SessionState {
    const scope = this.#pageScope.getStore()
    if (!scope) {
      throw new Error('No page scope active — missing SessionState')
    }
    return scope.state
  }

  resolveCdpElementId(cdpBackendNodeId: number): string | undefined {
    if (!cdpBackendNodeId) {
      this.logger('no cdpBackendNodeId')
      return
    }
    const page = this.getSelectedPage()
    const state = this.#getState()
    const snapshot = state.getTextSnapshot(page)
    if (!snapshot) {
      this.logger('no text snapshot')
      return
    }
    const queue = [snapshot.root]
    while (queue.length) {
      // biome-ignore lint/style/noNonNullAssertion: upstream code
      const current = queue.pop()!
      if (current.backendNodeId === cdpBackendNodeId) {
        return current.id
      }
      for (const child of current.children) {
        queue.push(child)
      }
    }
    return
  }

  async newPage(background?: boolean): Promise<Page> {
    const page = await this.browser.newPage()
    await this.createPagesSnapshot()
    const scope = this.#pageScope.getStore()
    if (scope) scope.page = page
    page.setDefaultTimeout(DEFAULT_TIMEOUT)
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT)
    if (!background) {
      await page.bringToFront().catch(() => {})
    }
    return page
  }

  async closePage(pageId: number): Promise<void> {
    if (this.#pages.length === 1) {
      throw new Error(CLOSE_PAGE_ERROR)
    }
    const page = this.getPageById(pageId)
    await page.close({ runBeforeUnload: false })
  }

  setNetworkConditions(conditions: string | null): void {
    const page = this.getSelectedPage()
    if (conditions === null) {
      this.#networkConditionsMap.delete(page)
    } else {
      this.#networkConditionsMap.set(page, conditions)
    }
    this.#updateSelectedPageTimeouts()
  }

  getNetworkConditions(): string | null {
    const page = this.getSelectedPage()
    return this.#networkConditionsMap.get(page) ?? null
  }

  setCpuThrottlingRate(rate: number): void {
    const page = this.getSelectedPage()
    this.#cpuThrottlingRateMap.set(page, rate)
    this.#updateSelectedPageTimeouts()
  }

  getCpuThrottlingRate(): number {
    const page = this.getSelectedPage()
    return this.#cpuThrottlingRateMap.get(page) ?? 1
  }

  setGeolocation(geolocation: GeolocationOptions | null): void {
    const page = this.getSelectedPage()
    if (geolocation === null) {
      this.#geolocationMap.delete(page)
    } else {
      this.#geolocationMap.set(page, geolocation)
    }
  }

  getGeolocation(): GeolocationOptions | null {
    const page = this.getSelectedPage()
    return this.#geolocationMap.get(page) ?? null
  }

  setViewport(viewport: Viewport | null): void {
    const page = this.getSelectedPage()
    if (viewport === null) {
      this.#viewportMap.delete(page)
    } else {
      this.#viewportMap.set(page, viewport)
    }
  }

  getViewport(): Viewport | null {
    const page = this.getSelectedPage()
    return this.#viewportMap.get(page) ?? null
  }

  setUserAgent(userAgent: string | null): void {
    const page = this.getSelectedPage()
    if (userAgent === null) {
      this.#userAgentMap.delete(page)
    } else {
      this.#userAgentMap.set(page, userAgent)
    }
  }

  getUserAgent(): string | null {
    const page = this.getSelectedPage()
    return this.#userAgentMap.get(page) ?? null
  }

  setColorScheme(scheme: 'dark' | 'light' | null): void {
    const page = this.getSelectedPage()
    if (scheme === null) {
      this.#colorSchemeMap.delete(page)
    } else {
      this.#colorSchemeMap.set(page, scheme)
    }
  }

  getColorScheme(): 'dark' | 'light' | null {
    const page = this.getSelectedPage()
    return this.#colorSchemeMap.get(page) ?? null
  }

  getDialog(): Dialog | undefined {
    const page = this.getSelectedPage()
    return this.#dialogs.get(page)
  }

  clearDialog(): void {
    const page = this.getSelectedPage()
    this.#dialogs.delete(page)
  }

  getSelectedPage(): Page {
    const scope = this.#pageScope.getStore()
    if (!scope) {
      throw new Error('No page selected')
    }
    if (scope.page.isClosed()) {
      throw new Error(
        `The selected page has been closed. Call ${listPages.name} to see open pages.`,
      )
    }
    return scope.page
  }

  withPage<T>(
    page: Page,
    state: SessionState,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.#pageScope.run({ page, state }, fn)
  }

  getPageById(pageId: number): Page {
    const page = this.#registry.getPage(pageId)
    if (!page) {
      throw new Error('No page found')
    }
    return page
  }

  getPageId(page: Page): number | undefined {
    return this.#registry.getPageId(page)
  }

  #setupDialogHandler(page: Page): void {
    if (this.#dialogHandlerPages.has(page)) return
    this.#dialogHandlerPages.add(page)
    page.on('dialog', (dialog: Dialog) => {
      this.#dialogs.set(page, dialog)
    })
  }

  isPageSelected(page: Page): boolean {
    const scope = this.#pageScope.getStore()
    return scope?.page === page
  }

  selectPage(page: Page): void {
    const scope = this.#pageScope.getStore()
    if (!scope) {
      throw new Error('No page scope active')
    }
    scope.page = page
  }

  #updateSelectedPageTimeouts() {
    const page = this.getSelectedPage()
    const cpuMultiplier = this.getCpuThrottlingRate()
    page.setDefaultTimeout(DEFAULT_TIMEOUT * cpuMultiplier)
    const networkMultiplier = getNetworkMultiplierFromString(
      this.getNetworkConditions(),
    )
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT * networkMultiplier)
  }

  getNavigationTimeout() {
    const page = this.getSelectedPage()
    return page.getDefaultNavigationTimeout()
  }

  getAXNodeByUid(uid: string) {
    const page = this.getSelectedPage()
    const state = this.#getState()
    const snapshot = state.getTextSnapshot(page)
    return snapshot?.idToNode.get(uid)
  }

  async getElementByUid(uid: string): Promise<ElementHandle<Element>> {
    const page = this.getSelectedPage()
    const state = this.#getState()
    const snapshot = state.getTextSnapshot(page)
    if (!snapshot?.idToNode.size) {
      throw new Error(
        `No snapshot found. Use ${takeSnapshot.name} to capture one.`,
      )
    }
    const node = snapshot?.idToNode.get(uid)
    if (!node) {
      throw new Error('No such element found in the snapshot.')
    }
    const message = `Element with uid ${uid} no longer exists on the page.`
    try {
      const handle = await node.elementHandle()
      if (!handle) {
        throw new Error(message)
      }
      return handle
    } catch (error) {
      throw new Error(message, {
        cause: error,
      })
    }
  }

  async createPagesSnapshot(): Promise<Page[]> {
    const allPages = await this.browser.pages()

    for (const page of allPages) {
      this.#registry.register(page)
    }

    this.#pages = allPages.filter((page) => {
      return (
        this.#options.experimentalDevToolsDebugging ||
        !page.url().startsWith('devtools://')
      )
    })

    for (const page of this.#pages) {
      this.#setupDialogHandler(page)
    }

    await this.detectOpenDevToolsWindows()

    return this.#pages
  }

  async detectOpenDevToolsWindows() {
    this.logger('Detecting open DevTools windows')
    const pages = await this.browser.pages()
    this.#pageToDevToolsPage = new Map<Page, Page>()
    for (const devToolsPage of pages) {
      if (devToolsPage.url().startsWith('devtools://')) {
        try {
          // biome-ignore lint/style/useTemplate: upstream code
          this.logger('Calling getTargetInfo for ' + devToolsPage.url())
          const data = await devToolsPage
            // @ts-expect-error no types for _client().
            ._client()
            .send('Target.getTargetInfo')
          const devtoolsPageTitle = data.targetInfo.title
          const urlLike = extractUrlLikeFromDevToolsTitle(devtoolsPageTitle)
          if (!urlLike) {
            continue
          }
          for (const page of this.#pages) {
            if (urlsEqual(page.url(), urlLike)) {
              this.#pageToDevToolsPage.set(page, devToolsPage)
            }
          }
        } catch (error) {
          this.logger('Issue occurred while trying to find DevTools', error)
        }
      }
    }
  }

  getPages(): Page[] {
    return this.#pages
  }

  getDevToolsPage(page: Page): Page | undefined {
    return this.#pageToDevToolsPage.get(page)
  }

  async getDevToolsData(): Promise<DevToolsData> {
    try {
      this.logger('Getting DevTools UI data')
      const selectedPage = this.getSelectedPage()
      const devtoolsPage = this.getDevToolsPage(selectedPage)
      if (!devtoolsPage) {
        this.logger('No DevTools page detected')
        return {}
      }
      const { cdpRequestId, cdpBackendNodeId } = await devtoolsPage.evaluate(
        async () => {
          // @ts-expect-error no types
          const UI = await import('/bundled/ui/legacy/legacy.js')
          // @ts-expect-error no types
          const SDK = await import('/bundled/core/sdk/sdk.js')
          const request = UI.Context.Context.instance().flavor(
            SDK.NetworkRequest.NetworkRequest,
          )
          const node = UI.Context.Context.instance().flavor(
            SDK.DOMModel.DOMNode,
          )
          return {
            cdpRequestId: request?.requestId(),
            cdpBackendNodeId: node?.backendNodeId(),
          }
        },
      )
      return { cdpBackendNodeId, cdpRequestId }
    } catch (err) {
      this.logger('error getting devtools data', err)
    }
    return {}
  }

  async createTextSnapshot(
    verbose = false,
    devtoolsData: DevToolsData | undefined = undefined,
  ): Promise<void> {
    const page = this.getSelectedPage()
    const state = this.#getState()
    const rootNode = await page.accessibility.snapshot({
      includeIframes: true,
      interestingOnly: !verbose,
    })
    if (!rootNode) {
      return
    }

    const snapshotId = state.nextSnapshotId()
    let idCounter = 0
    const idToNode = new Map<string, TextSnapshotNode>()
    const seenUniqueIds = new Set<string>()
    const uniqueMap = state.uniqueBackendNodeIdToMcpId
    const assignIds = (node: SerializedAXNode): TextSnapshotNode => {
      let id = `${snapshotId}_${idCounter++}`

      // @ts-expect-error untyped loaderId & backendNodeId.
      const loaderId = node.loaderId as string | undefined
      // @ts-expect-error untyped loaderId & backendNodeId.
      const backendNodeId = node.backendNodeId as number | undefined
      if (loaderId && backendNodeId) {
        const uniqueBackendId = `${loaderId}_${backendNodeId}`
        if (uniqueMap.has(uniqueBackendId)) {
          // biome-ignore lint/style/noNonNullAssertion: upstream code
          id = uniqueMap.get(uniqueBackendId)!
        } else {
          uniqueMap.set(uniqueBackendId, id)
        }
        seenUniqueIds.add(uniqueBackendId)
      }

      const nodeWithId: TextSnapshotNode = {
        ...node,
        id,
        children: node.children
          ? node.children.map((child) => assignIds(child))
          : [],
      }

      if (node.role === 'option') {
        const optionText = node.name
        if (optionText) {
          nodeWithId.value = optionText.toString()
        }
      }

      idToNode.set(nodeWithId.id, nodeWithId)
      return nodeWithId
    }

    const rootNodeWithId = assignIds(rootNode)
    const textSnapshot: TextSnapshot = {
      root: rootNodeWithId,
      snapshotId: String(snapshotId),
      idToNode,
      hasSelectedElement: false,
      verbose,
    }
    state.setTextSnapshot(page, textSnapshot)
    const data = devtoolsData ?? (await this.getDevToolsData())
    if (data?.cdpBackendNodeId) {
      textSnapshot.hasSelectedElement = true
      textSnapshot.selectedElementUid = this.resolveCdpElementId(
        data?.cdpBackendNodeId,
      )
    }

    for (const key of uniqueMap.keys()) {
      if (!seenUniqueIds.has(key)) {
        uniqueMap.delete(key)
      }
    }
  }

  getTextSnapshot(): TextSnapshot | null {
    const page = this.getSelectedPage()
    const state = this.#getState()
    return state.getTextSnapshot(page) ?? null
  }

  async saveTemporaryFile(
    data: Uint8Array<ArrayBufferLike>,
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp',
  ): Promise<{ filename: string }> {
    try {
      const dir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'chrome-devtools-mcp-'),
      )

      const filename = path.join(
        dir,
        `screenshot.${getExtensionFromMimeType(mimeType)}`,
      )
      await fs.writeFile(filename, data)
      return { filename }
    } catch (err) {
      this.logger(err)
      throw new Error('Could not save a screenshot to a file', { cause: err })
    }
  }

  async saveFile(
    data: Uint8Array<ArrayBufferLike>,
    filename: string,
  ): Promise<{ filename: string }> {
    try {
      const filePath = path.resolve(filename)
      await fs.writeFile(filePath, data)
      return { filename }
    } catch (err) {
      this.logger(err)
      throw new Error('Could not save a screenshot to a file', { cause: err })
    }
  }

  getWaitForHelper(
    page: Page,
    cpuMultiplier: number,
    networkMultiplier: number,
  ) {
    return new WaitForHelper(page, cpuMultiplier, networkMultiplier)
  }

  waitForEventsAfterAction(
    action: () => Promise<unknown>,
    options?: { timeout?: number },
  ): Promise<void> {
    const page = this.getSelectedPage()
    const cpuMultiplier = this.getCpuThrottlingRate()
    const networkMultiplier = getNetworkMultiplierFromString(
      this.getNetworkConditions(),
    )
    const waitForHelper = this.getWaitForHelper(
      page,
      cpuMultiplier,
      networkMultiplier,
    )
    return waitForHelper.waitForEventsAfterAction(action, options)
  }

  waitForTextOnPage(text: string, timeout?: number): Promise<Element> {
    const page = this.getSelectedPage()
    const frames = page.frames()

    let locator = this.#locatorClass.race(
      frames.flatMap((frame) => [
        frame.locator(`aria/${text}`),
        frame.locator(`text/${text}`),
      ]),
    )

    if (timeout) {
      locator = locator.setTimeout(timeout)
    }

    return locator.wait()
  }
}
