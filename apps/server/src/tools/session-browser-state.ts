/** @license Copyright 2025 BrowserOS */

export interface BrowserTarget {
  tabId?: number
  pageId?: number
  windowId?: number
  url?: string
}

export class SessionBrowserState {
  #targets: Map<string, BrowserTarget> = new Map()
  #tabIndex: Map<number, string> = new Map()
  #pageIndex: Map<number, string> = new Map()
  #activeKey: string | undefined
  #nextKey = 0
  #textSnapshots: Map<number, unknown> = new Map()
  #isRunningTrace = false
  #traceResults: unknown[] = []
  #windowId: number | undefined

  register(target: Partial<BrowserTarget>): void {
    let existingKey: string | undefined

    if (target.tabId !== undefined) {
      existingKey = this.#tabIndex.get(target.tabId)
    }
    if (existingKey === undefined && target.pageId !== undefined) {
      existingKey = this.#pageIndex.get(target.pageId)
    }

    if (existingKey !== undefined) {
      const existing = this.#targets.get(existingKey)
      if (existing === undefined) return
      const merged = { ...existing, ...target }
      this.#targets.set(existingKey, merged)

      if (merged.tabId !== undefined) {
        this.#tabIndex.set(merged.tabId, existingKey)
      }
      if (merged.pageId !== undefined) {
        this.#pageIndex.set(merged.pageId, existingKey)
      }
      return
    }

    const key = String(this.#nextKey++)
    this.#targets.set(key, { ...target })

    if (target.tabId !== undefined) {
      this.#tabIndex.set(target.tabId, key)
    }
    if (target.pageId !== undefined) {
      this.#pageIndex.set(target.pageId, key)
    }
  }

  removeByTabId(tabId: number): void {
    const key = this.#tabIndex.get(tabId)
    if (key === undefined) return

    const target = this.#targets.get(key)
    this.#tabIndex.delete(tabId)

    if (target?.pageId !== undefined) {
      this.#pageIndex.delete(target.pageId)
    }

    this.#targets.delete(key)

    if (this.#activeKey === key) {
      this.#activeKey = undefined
    }
  }

  removeByPageId(pageId: number): void {
    const key = this.#pageIndex.get(pageId)
    if (key === undefined) return

    const target = this.#targets.get(key)
    this.#pageIndex.delete(pageId)

    if (target?.tabId !== undefined) {
      this.#tabIndex.delete(target.tabId)
    }

    this.#targets.delete(key)

    if (this.#activeKey === key) {
      this.#activeKey = undefined
    }
  }

  setActiveByTabId(tabId: number): void {
    const key = this.#tabIndex.get(tabId)
    if (key !== undefined) {
      this.#activeKey = key
    }
  }

  setActiveByPageId(pageId: number | undefined): void {
    if (pageId === undefined) {
      this.#activeKey = undefined
      return
    }
    const key = this.#pageIndex.get(pageId)
    if (key !== undefined) {
      this.#activeKey = key
    }
  }

  get activeTabId(): number | undefined {
    if (this.#activeKey === undefined) return undefined
    return this.#targets.get(this.#activeKey)?.tabId
  }

  get activePageId(): number | undefined {
    if (this.#activeKey === undefined) return undefined
    return this.#targets.get(this.#activeKey)?.pageId
  }

  get activeWindowId(): number | undefined {
    if (this.#activeKey === undefined) return undefined
    return this.#targets.get(this.#activeKey)?.windowId
  }

  getByTabId(tabId: number): BrowserTarget | undefined {
    const key = this.#tabIndex.get(tabId)
    if (key === undefined) return undefined
    return this.#targets.get(key)
  }

  getByPageId(pageId: number): BrowserTarget | undefined {
    const key = this.#pageIndex.get(pageId)
    if (key === undefined) return undefined
    return this.#targets.get(key)
  }

  getTextSnapshot(pageId: number): unknown {
    return this.#textSnapshots.get(pageId)
  }

  setTextSnapshot(pageId: number, snapshot: unknown): void {
    this.#textSnapshots.set(pageId, snapshot)
  }

  get isRunningTrace(): boolean {
    return this.#isRunningTrace
  }

  set isRunningTrace(value: boolean) {
    this.#isRunningTrace = value
  }

  getTraceResults(): unknown[] {
    return this.#traceResults
  }

  addTraceResult(result: unknown): void {
    this.#traceResults.push(result)
  }

  get windowId(): number | undefined {
    return this.#windowId
  }

  set windowId(value: number | undefined) {
    this.#windowId = value
  }
}
