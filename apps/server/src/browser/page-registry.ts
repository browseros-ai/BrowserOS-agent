/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Browser, Page, Target } from 'puppeteer-core'

export interface PageEntry {
  pageId: number
  tabId: number
  windowId: number
  targetId?: string
  page?: Page
  url: string
}

type RegisterInput = {
  tabId: number
  windowId: number
  targetId?: string
  page?: Page
  url?: string
}

function readTargetId(target: Target): string | undefined {
  const value = target as Target & {
    targetId?: string
    _targetId?: string
    _targetInfo?: { targetId?: string }
  }
  return value.targetId ?? value._targetId ?? value._targetInfo?.targetId
}

export class PageRegistry {
  #entries = new Map<number, PageEntry>()
  #tabIndex = new Map<number, number>()
  #targetIndex = new Map<string, number>()
  #nextPageId = 1
  #freePageIds: number[] = []
  #cleanupBrowser: Browser | null = null
  #boundTargetDestroyed = (target: Target) => {
    const targetId = readTargetId(target)
    if (!targetId) return
    const entry = this.getByTargetId(targetId)
    if (!entry) return
    this.remove(entry.pageId)
  }

  register(input: RegisterInput): number {
    const existingPageId =
      (input.targetId ? this.#targetIndex.get(input.targetId) : undefined) ??
      this.#tabIndex.get(input.tabId)

    if (existingPageId !== undefined) {
      const existing = this.#entries.get(existingPageId)
      if (!existing) {
        this.#tabIndex.delete(input.tabId)
        if (input.targetId) this.#targetIndex.delete(input.targetId)
      } else {
        const merged: PageEntry = {
          ...existing,
          ...input,
          url: input.url ?? input.page?.url() ?? existing.url,
        }
        this.#entries.set(existingPageId, merged)
        this.#tabIndex.set(merged.tabId, existingPageId)
        if (merged.targetId) {
          this.#targetIndex.set(merged.targetId, existingPageId)
        }
        return existingPageId
      }
    }

    const pageId = this.#allocatePageId()
    const entry: PageEntry = {
      pageId,
      tabId: input.tabId,
      windowId: input.windowId,
      targetId: input.targetId,
      page: input.page,
      url: input.url ?? input.page?.url() ?? 'about:blank',
    }

    this.#entries.set(pageId, entry)
    this.#tabIndex.set(entry.tabId, pageId)
    if (entry.targetId) {
      this.#targetIndex.set(entry.targetId, pageId)
    }
    return pageId
  }

  async registerFromTarget(page: Page): Promise<number> {
    const targetId = readTargetId(page.target())
    if (!targetId) {
      throw new Error('Failed to resolve targetId for page')
    }

    const session = await page.target().createCDPSession()
    try {
      const result = await (
        session as unknown as {
          send(
            method: string,
            params: { targetId: string },
          ): Promise<{ tabId: number; windowId: number }>
        }
      ).send('Browser.getTabForTarget', { targetId })
      const tabId = Number(result.tabId)
      const windowId = Number(result.windowId)
      if (!Number.isFinite(tabId) || !Number.isFinite(windowId)) {
        throw new Error('Invalid Browser.getTabForTarget result')
      }

      return this.register({
        tabId,
        windowId,
        targetId,
        page,
        url: page.url(),
      })
    } finally {
      await session.detach().catch(() => {})
    }
  }

  getPage(pageId: number): Page {
    const entry = this.#entries.get(pageId)
    if (!entry || !entry.page) {
      throw new Error(
        `No CDP page found for pageId ${pageId}. Use list_pages to see tracked pages.`,
      )
    }
    return entry.page
  }

  getTabId(pageId: number): number {
    const entry = this.#entries.get(pageId)
    if (!entry) {
      throw new Error(`No page found for pageId ${pageId}`)
    }
    return entry.tabId
  }

  getWindowId(pageId: number): number {
    const entry = this.#entries.get(pageId)
    if (!entry) {
      throw new Error(`No page found for pageId ${pageId}`)
    }
    return entry.windowId
  }

  getEntry(pageId: number): PageEntry {
    const entry = this.#entries.get(pageId)
    if (!entry) {
      throw new Error(`No page found for pageId ${pageId}`)
    }
    return entry
  }

  getByTabId(tabId: number): PageEntry | undefined {
    const pageId = this.#tabIndex.get(tabId)
    if (pageId === undefined) return undefined
    return this.#entries.get(pageId)
  }

  getByTargetId(targetId: string): PageEntry | undefined {
    const pageId = this.#targetIndex.get(targetId)
    if (pageId === undefined) return undefined
    return this.#entries.get(pageId)
  }

  async discoverAll(browser: Browser): Promise<PageEntry[]> {
    const pages = await browser.pages()
    for (const page of pages) {
      try {
        await this.registerFromTarget(page)
      } catch {
        // Best effort only. Some targets may vanish while we enumerate.
      }
    }

    for (const entry of this.#entries.values()) {
      if (entry.page && !entry.page.isClosed()) {
        entry.url = entry.page.url()
      }
    }

    return this.entries()
  }

  remove(pageId: number): void {
    const entry = this.#entries.get(pageId)
    if (!entry) {
      return
    }

    this.#entries.delete(pageId)
    this.#tabIndex.delete(entry.tabId)
    if (entry.targetId) {
      this.#targetIndex.delete(entry.targetId)
    }

    this.#freePageIds.push(pageId)
  }

  setupAutoCleanup(browser: Browser): void {
    if (this.#cleanupBrowser === browser) {
      return
    }

    if (this.#cleanupBrowser) {
      this.#cleanupBrowser.off('targetdestroyed', this.#boundTargetDestroyed)
    }

    this.#cleanupBrowser = browser
    browser.on('targetdestroyed', this.#boundTargetDestroyed)
  }

  entries(): PageEntry[] {
    return [...this.#entries.values()].sort((a, b) => a.pageId - b.pageId)
  }

  #allocatePageId(): number {
    if (this.#freePageIds.length > 0) {
      this.#freePageIds.sort((a, b) => a - b)
      const pageId = this.#freePageIds.shift()
      if (pageId !== undefined) {
        return pageId
      }
    }

    const pageId = this.#nextPageId
    this.#nextPageId += 1
    return pageId
  }
}
