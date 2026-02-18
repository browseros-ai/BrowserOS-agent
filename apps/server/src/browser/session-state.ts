/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ElementHandle, Page, SerializedAXNode } from 'puppeteer-core'

export interface TextSnapshotNode extends SerializedAXNode {
  id: string
  backendNodeId?: number
  loaderId?: string
  children: TextSnapshotNode[]
}

export interface TextSnapshot {
  root: TextSnapshotNode
  idToNode: Map<string, TextSnapshotNode>
  snapshotId: string
  selectedElementUid?: string
  hasSelectedElement: boolean
  verbose: boolean
}

export class SessionState {
  activePageId: number | undefined
  windowId: number | undefined

  #snapshots = new Map<number, TextSnapshot>()
  #uniqueBackendNodeIdToMcpId = new Map<string, string>()
  #nextSnapshotId = 1

  setActive(pageId: number): void {
    this.activePageId = pageId
  }

  clearActive(): void {
    this.activePageId = undefined
  }

  getSnapshot(pageId: number): TextSnapshot | undefined {
    return this.#snapshots.get(pageId)
  }

  setSnapshot(pageId: number, snapshot: TextSnapshot): void {
    this.#snapshots.set(pageId, snapshot)
  }

  clearSnapshot(pageId: number): void {
    this.#snapshots.delete(pageId)
  }

  getAXNodeByUid(pageId: number, uid: string): TextSnapshotNode | undefined {
    const snapshot = this.#snapshots.get(pageId)
    return snapshot?.idToNode.get(uid)
  }

  async getElementByUid(
    pageId: number,
    uid: string,
  ): Promise<ElementHandle<Element>> {
    const snapshot = this.#snapshots.get(pageId)
    if (!snapshot?.idToNode.size) {
      throw new Error('No snapshot found. Use take_snapshot to capture one.')
    }

    const node = snapshot.idToNode.get(uid)
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
      throw new Error(message, { cause: error })
    }
  }

  resolveCdpElementId(
    pageId: number,
    cdpBackendNodeId: number,
  ): string | undefined {
    if (!cdpBackendNodeId) {
      return undefined
    }

    const snapshot = this.#snapshots.get(pageId)
    if (!snapshot) {
      return undefined
    }

    const queue = [snapshot.root]
    while (queue.length > 0) {
      const current = queue.pop()
      if (!current) {
        continue
      }
      if (current.backendNodeId === cdpBackendNodeId) {
        return current.id
      }
      queue.push(...current.children)
    }

    return undefined
  }

  async createSnapshot(
    page: Page,
    pageId: number,
    verbose = false,
    selectedBackendNodeId?: number,
  ): Promise<void> {
    const rootNode = await page.accessibility.snapshot({
      includeIframes: true,
      interestingOnly: !verbose,
    })
    if (!rootNode) {
      return
    }

    const snapshotId = this.#nextSnapshotId++
    let idCounter = 0
    const idToNode = new Map<string, TextSnapshotNode>()
    const seenUniqueIds = new Set<string>()

    const assignIds = (node: SerializedAXNode): TextSnapshotNode => {
      let id = `${snapshotId}_${idCounter++}`

      const loaderId = (node as SerializedAXNode & { loaderId?: string })
        .loaderId
      const backendNodeId = (
        node as SerializedAXNode & { backendNodeId?: number }
      ).backendNodeId

      if (loaderId && backendNodeId) {
        const uniqueBackendId = `${loaderId}_${backendNodeId}`
        const existing = this.#uniqueBackendNodeIdToMcpId.get(uniqueBackendId)
        if (existing) {
          id = existing
        } else {
          this.#uniqueBackendNodeIdToMcpId.set(uniqueBackendId, id)
        }
        seenUniqueIds.add(uniqueBackendId)
      }

      const withId: TextSnapshotNode = {
        ...node,
        id,
        backendNodeId,
        loaderId,
        children: node.children
          ? node.children.map((child) => assignIds(child))
          : [],
      }

      if (node.role === 'option' && node.name) {
        withId.value = node.name.toString()
      }

      idToNode.set(withId.id, withId)
      return withId
    }

    const snapshot: TextSnapshot = {
      root: assignIds(rootNode),
      idToNode,
      snapshotId: String(snapshotId),
      hasSelectedElement: false,
      verbose,
    }

    if (selectedBackendNodeId) {
      snapshot.hasSelectedElement = true
      snapshot.selectedElementUid = this.resolveCdpElementId(
        pageId,
        selectedBackendNodeId,
      )
    }

    this.#snapshots.set(pageId, snapshot)

    for (const key of this.#uniqueBackendNodeIdToMcpId.keys()) {
      if (!seenUniqueIds.has(key)) {
        this.#uniqueBackendNodeIdToMcpId.delete(key)
      }
    }
  }
}
