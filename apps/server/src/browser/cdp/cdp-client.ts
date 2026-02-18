/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { Debugger } from 'debug'
import type {
  Browser,
  Dialog,
  Page,
  PredefinedNetworkConditions,
  Viewport,
} from 'puppeteer-core'
import { Locator } from 'puppeteer-core'
import type { PageRegistry } from '../page-registry'
import {
  extractUrlLikeFromDevToolsTitle,
  UniverseManager,
  urlsEqual,
} from './devtools-utils'
import { WaitForHelper } from './wait-for-helper'

export interface GeolocationOptions {
  latitude: number
  longitude: number
}

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
    default:
      return 1
  }
}

function getExtensionFromMimeType(mimeType: string) {
  switch (mimeType) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpeg'
    case 'image/webp':
      return 'webp'
    default:
      throw new Error(`No mapping for Mime type ${mimeType}.`)
  }
}

export class CdpClient {
  readonly browser: Browser
  readonly logger: Debugger
  readonly registry: PageRegistry

  #pageToDevToolsPage = new Map<Page, Page>()
  #pageScope = new AsyncLocalStorage<{ page: Page }>()
  #devtoolsUniverseManager: UniverseManager

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
    this.registry = registry
    this.#locatorClass = locatorClass
    this.#options = options
    this.#devtoolsUniverseManager = new UniverseManager()
  }

  static async from(
    browser: Browser,
    logger: Debugger,
    options: CdpClientOptions,
    registry: PageRegistry,
    locatorClass: typeof Locator = Locator,
  ): Promise<CdpClient> {
    const client = new CdpClient(
      browser,
      logger,
      options,
      registry,
      locatorClass,
    )
    await client.#init()
    return client
  }

  async #init(): Promise<void> {
    const entries = await this.registry.discoverAll(this.browser)
    for (const entry of entries) {
      if (entry.page) {
        this.#setupDialogHandler(entry.page)
      }
    }

    await this.detectOpenDevToolsWindows()
    await this.#devtoolsUniverseManager.init(
      entries
        .map((entry) => entry.page)
        .filter((page): page is Page => Boolean(page)),
    )
  }

  dispose(): void {
    this.#devtoolsUniverseManager.dispose()
  }

  withPage<T>(page: Page, fn: () => Promise<T>): Promise<T> {
    return this.#pageScope.run({ page }, fn)
  }

  getSelectedPage(): Page {
    const scope = this.#pageScope.getStore()
    if (!scope) {
      throw new Error('No page selected')
    }

    if (scope.page.isClosed()) {
      throw new Error(
        'The selected page has been closed. Call list_pages to see open pages.',
      )
    }

    return scope.page
  }

  selectPage(page: Page): void {
    const scope = this.#pageScope.getStore()
    if (!scope) {
      throw new Error('No page scope active')
    }
    scope.page = page
    this.#setupDialogHandler(page)
  }

  async newPage(background?: boolean): Promise<Page> {
    const page = await this.browser.newPage()
    page.setDefaultTimeout(DEFAULT_TIMEOUT)
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT)

    await this.registry.registerFromTarget(page)
    this.#setupDialogHandler(page)

    if (!background) {
      await page.bringToFront().catch(() => {})
    }

    const scope = this.#pageScope.getStore()
    if (scope) {
      scope.page = page
      this.#updateSelectedPageTimeouts()
    }

    await this.detectOpenDevToolsWindows()
    return page
  }

  async closePage(pageId: number): Promise<void> {
    if (this.registry.entries().length <= 1) {
      throw new Error(
        'The last open page cannot be closed. It is fine to keep it open.',
      )
    }

    const page = this.registry.getPage(pageId)
    await page.close({ runBeforeUnload: false })
    this.registry.remove(pageId)
  }

  getPageById(pageId: number): Page {
    return this.registry.getPage(pageId)
  }

  getPageId(page: Page): number | undefined {
    const target = page.target() as { targetId?: string; _targetId?: string }
    const targetId = target.targetId ?? target._targetId
    if (!targetId) {
      return undefined
    }
    return this.registry.getByTargetId(targetId)?.pageId
  }

  isPageSelected(page: Page): boolean {
    const scope = this.#pageScope.getStore()
    return scope?.page === page
  }

  async getPages(): Promise<Page[]> {
    const entries = await this.registry.discoverAll(this.browser)
    const pages: Page[] = []
    for (const entry of entries) {
      if (!entry.page) {
        continue
      }
      if (
        !this.#options.experimentalDevToolsDebugging &&
        entry.page.url().startsWith('devtools://')
      ) {
        continue
      }
      this.#setupDialogHandler(entry.page)
      pages.push(entry.page)
    }
    return pages
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

  #setupDialogHandler(page: Page): void {
    if (this.#dialogHandlerPages.has(page)) {
      return
    }

    this.#dialogHandlerPages.add(page)
    page.on('dialog', (dialog: Dialog) => {
      this.#dialogs.set(page, dialog)
    })
  }

  #updateSelectedPageTimeouts(): void {
    const page = this.getSelectedPage()

    const cpuMultiplier = this.getCpuThrottlingRate()
    page.setDefaultTimeout(DEFAULT_TIMEOUT * cpuMultiplier)

    const networkMultiplier = getNetworkMultiplierFromString(
      this.getNetworkConditions(),
    )
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT * networkMultiplier)
  }

  getNavigationTimeout(): number {
    const page = this.getSelectedPage()
    return page.getDefaultNavigationTimeout()
  }

  getDevToolsPage(page: Page): Page | undefined {
    return this.#pageToDevToolsPage.get(page)
  }

  async detectOpenDevToolsWindows(): Promise<void> {
    this.logger('Detecting open DevTools windows')
    const pages = await this.browser.pages()
    this.#pageToDevToolsPage = new Map<Page, Page>()

    const entries = this.registry.entries()
    const trackedPages = entries
      .map((entry) => entry.page)
      .filter((entry): entry is Page => Boolean(entry))

    for (const devToolsPage of pages) {
      if (!devToolsPage.url().startsWith('devtools://')) {
        continue
      }

      try {
        this.logger(`Calling getTargetInfo for ${devToolsPage.url()}`)
        const data = await (
          devToolsPage as Page & {
            _client(): {
              send(method: string): Promise<{ targetInfo: { title: string } }>
            }
          }
        )
          ._client()
          .send('Target.getTargetInfo')

        const devtoolsPageTitle = data.targetInfo.title
        const urlLike = extractUrlLikeFromDevToolsTitle(devtoolsPageTitle)
        if (!urlLike) {
          continue
        }

        for (const page of trackedPages) {
          if (urlsEqual(page.url(), urlLike)) {
            this.#pageToDevToolsPage.set(page, devToolsPage)
          }
        }
      } catch (error) {
        this.logger('Issue occurred while trying to find DevTools', error)
      }
    }
  }

  async getDevToolsData(): Promise<{
    cdpRequestId?: string
    cdpBackendNodeId?: number
  }> {
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
          // @ts-expect-error DevTools frontend runtime has no static TS types
          const UI = await import('/bundled/ui/legacy/legacy.js')
          // @ts-expect-error DevTools frontend runtime has no static TS types
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
    } catch (error) {
      this.logger('error getting devtools data', error)
      return {}
    }
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
    } catch (error) {
      this.logger(error)
      throw new Error('Could not save a screenshot to a file', { cause: error })
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
    } catch (error) {
      this.logger(error)
      throw new Error('Could not save a screenshot to a file', { cause: error })
    }
  }

  getWaitForHelper(
    page: Page,
    cpuMultiplier: number,
    networkMultiplier: number,
  ): WaitForHelper {
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
