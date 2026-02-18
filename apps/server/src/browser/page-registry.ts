/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Page } from 'puppeteer-core'

export interface PageEntry {
  pageId: number
  page: Page
  tabId?: number
  windowId?: number
  targetId?: string
  url?: string
}

export class PageRegistry {
  #nextPageId = 1
  #entries = new Map<number, PageEntry>()
  #pageToId = new WeakMap<Page, number>()
  #tabIndex = new Map<number, number>()

  register(
    page: Page,
    meta?: Partial<Omit<PageEntry, 'pageId' | 'page'>>,
  ): number {
    const existing = this.#pageToId.get(page)
    if (existing !== undefined) {
      if (meta) {
        const entry = this.#entries.get(existing)
        if (entry) {
          Object.assign(entry, meta)
        }
        if (meta.tabId !== undefined) {
          this.#tabIndex.set(meta.tabId, existing)
        }
      }
      return existing
    }

    const pageId = this.#nextPageId++
    const entry: PageEntry = { pageId, page, ...meta }
    this.#entries.set(pageId, entry)
    this.#pageToId.set(page, pageId)

    if (meta?.tabId !== undefined) {
      this.#tabIndex.set(meta.tabId, pageId)
    }

    return pageId
  }

  unregister(pageId: number): void {
    const entry = this.#entries.get(pageId)
    if (!entry) return

    this.#entries.delete(pageId)

    if (entry.tabId !== undefined) {
      this.#tabIndex.delete(entry.tabId)
    }
  }

  getPage(pageId: number): Page | undefined {
    return this.#entries.get(pageId)?.page
  }

  getPageId(page: Page): number | undefined {
    return this.#pageToId.get(page)
  }

  getEntry(pageId: number): PageEntry | undefined {
    return this.#entries.get(pageId)
  }

  getByTabId(tabId: number): PageEntry | undefined {
    const pageId = this.#tabIndex.get(tabId)
    if (pageId === undefined) return undefined
    return this.#entries.get(pageId)
  }

  getPageByTabId(tabId: number): Page | undefined {
    return this.getByTabId(tabId)?.page
  }

  entries(): IterableIterator<PageEntry> {
    return this.#entries.values()
  }

  get size(): number {
    return this.#entries.size
  }
}
