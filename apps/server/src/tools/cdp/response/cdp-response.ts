/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { CdpClient } from '../../../browser/cdp/cdp-client'
import type { PageRegistry } from '../../../browser/page-registry'
import type { SessionState } from '../../../browser/session-state'
import { BaseResponse } from '../../types/base-response'
import type { ToolResult } from '../../types/response'
import type { Page } from '../third-party'
import { handleDialog } from '../tools/pages'
import type { DevToolsData, SnapshotParams } from '../types/cdp-tool-definition'
import { SnapshotFormatter } from './snapshot-formatter'

function getTargetId(page: Page): string | undefined {
  const target = page.target() as {
    targetId?: string
    _targetId?: string
    _targetInfo?: { targetId?: string }
  }
  return target.targetId ?? target._targetId ?? target._targetInfo?.targetId
}

export class CdpResponse extends BaseResponse {
  #includePages = false
  #snapshotParams?: SnapshotParams
  #devToolsData?: DevToolsData

  setIncludePages(value: boolean): void {
    this.#includePages = value
  }

  includeSnapshot(params?: SnapshotParams): void {
    this.#snapshotParams = params ?? { verbose: false }
  }

  attachDevToolsData(data: DevToolsData): void {
    this.#devToolsData = data
  }

  #hasSelectedPage(cdp: CdpClient): boolean {
    try {
      cdp.getSelectedPage()
      return true
    } catch {
      return false
    }
  }

  async #createSnapshot(
    cdp: CdpClient,
    state: SessionState,
    registry: PageRegistry,
  ): Promise<SnapshotFormatter | string | undefined> {
    if (!this.#snapshotParams) {
      return undefined
    }

    const page = cdp.getSelectedPage()
    const targetId = getTargetId(page)
    const pageId = targetId
      ? registry.getByTargetId(targetId)?.pageId
      : undefined
    if (pageId === undefined) {
      return undefined
    }

    const devToolsData = this.#devToolsData ?? (await cdp.getDevToolsData())
    await state.createSnapshot(
      page,
      pageId,
      this.#snapshotParams.verbose ?? false,
      devToolsData.cdpBackendNodeId,
    )

    const textSnapshot = state.getSnapshot(pageId)
    if (!textSnapshot) {
      return undefined
    }

    const formatter = new SnapshotFormatter(textSnapshot)
    if (!this.#snapshotParams.filePath) {
      return formatter
    }

    await cdp.saveFile(
      new TextEncoder().encode(formatter.toString()),
      this.#snapshotParams.filePath,
    )
    return this.#snapshotParams.filePath
  }

  #appendMessageLines(responseLines: string[], toolName: string): void {
    responseLines.push(`# ${toolName} response`)
    if (this.responseLines.length === 0) {
      return
    }

    this.addStructuredContent('message', this.responseLines.join('\n'))
    responseLines.push(...this.responseLines)
  }

  #appendEmulationSections(responseLines: string[], cdp: CdpClient): void {
    const networkConditions = cdp.getNetworkConditions()
    if (networkConditions) {
      responseLines.push('## Network emulation')
      responseLines.push(`Emulating: ${networkConditions}`)
      responseLines.push(
        `Default navigation timeout set to ${cdp.getNavigationTimeout()} ms`,
      )
      this.addStructuredContent('networkConditions', networkConditions)
      this.addStructuredContent('navigationTimeout', cdp.getNavigationTimeout())
    }

    const viewport = cdp.getViewport()
    if (viewport) {
      responseLines.push('## Viewport emulation')
      responseLines.push(`Emulating viewport: ${JSON.stringify(viewport)}`)
      this.addStructuredContent('viewport', viewport)
    }

    const userAgent = cdp.getUserAgent()
    if (userAgent) {
      responseLines.push('## UserAgent emulation')
      responseLines.push(`Emulating userAgent: ${userAgent}`)
      this.addStructuredContent('userAgent', userAgent)
    }

    const cpuThrottlingRate = cdp.getCpuThrottlingRate()
    if (cpuThrottlingRate > 1) {
      responseLines.push('## CPU emulation')
      responseLines.push(`Emulating: ${cpuThrottlingRate}x slowdown`)
      this.addStructuredContent('cpuThrottlingRate', cpuThrottlingRate)
    }

    const colorScheme = cdp.getColorScheme()
    if (colorScheme) {
      responseLines.push('## Color Scheme emulation')
      responseLines.push(`Emulating: ${colorScheme}`)
      this.addStructuredContent('colorScheme', colorScheme)
    }

    const dialog = cdp.getDialog()
    if (!dialog) {
      return
    }

    const defaultValueIfNeeded =
      dialog.type() === 'prompt'
        ? ` (default value: "${dialog.defaultValue()}")`
        : ''
    responseLines.push(
      `# Open dialog\n${dialog.type()}: ${dialog.message()}${defaultValueIfNeeded}.\nCall ${handleDialog.name} to handle it before continuing.`,
    )
    this.addStructuredContent('dialog', {
      type: dialog.type(),
      message: dialog.message(),
      defaultValue: dialog.defaultValue(),
    })
  }

  #appendPagesSection(
    responseLines: string[],
    state: SessionState,
    registry: PageRegistry,
  ): void {
    if (!this.#includePages) {
      return
    }

    const entries = registry.entries()
    responseLines.push('## Pages')

    for (const entry of entries) {
      const marker = state.activePageId === entry.pageId ? ' [selected]' : ''
      responseLines.push(`${entry.pageId}: ${entry.url}${marker}`)
    }

    this.addStructuredContent(
      'pages',
      entries.map((entry) => ({
        id: entry.pageId,
        url: entry.url,
        selected: state.activePageId === entry.pageId,
        tabId: entry.tabId,
        windowId: entry.windowId,
      })),
    )
  }

  #appendSnapshotSection(
    responseLines: string[],
    snapshot: SnapshotFormatter | string | undefined,
  ): void {
    if (!snapshot) {
      return
    }

    if (typeof snapshot === 'string') {
      responseLines.push(`Saved snapshot to ${snapshot}.`)
      this.addStructuredContent('snapshotFilePath', snapshot)
      return
    }

    responseLines.push('## Latest page snapshot')
    responseLines.push(snapshot.toString())
    this.addStructuredContent('snapshot', snapshot.toJSON())
  }

  async handle(
    toolName: string,
    cdp: CdpClient,
    state: SessionState,
    registry: PageRegistry,
  ): Promise<ToolResult> {
    const selectedPageAvailable = this.#hasSelectedPage(cdp)

    if (this.#includePages) {
      await registry.discoverAll(cdp.browser)
    }

    const snapshot = selectedPageAvailable
      ? await this.#createSnapshot(cdp, state, registry)
      : undefined

    const responseLines: string[] = []
    this.#appendMessageLines(responseLines, toolName)

    if (selectedPageAvailable) {
      this.#appendEmulationSections(responseLines, cdp)
    }

    this.#appendPagesSection(responseLines, state, registry)
    this.#appendSnapshotSection(responseLines, snapshot)

    const baseContent = this.toContent()
    const imageContent = baseContent.filter((item) => item.type === 'image')

    return {
      content: [
        {
          type: 'text',
          text: responseLines.join('\n'),
        },
        ...imageContent,
      ],
      structuredContent: this.structuredContent,
    }
  }

  resetResponseLineForTesting() {
    // Optional testing compatibility hook.
  }
}
