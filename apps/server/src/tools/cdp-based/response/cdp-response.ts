/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ToolResult } from '../../types/response'
import type { CdpContext } from '../context/cdp-context'
import type { ImageContent, TextContent } from '../third-party'
import { handleDialog } from '../tools/pages'
import type {
  DevToolsData,
  ImageContentData,
  Response,
  SnapshotParams,
} from '../types/cdp-tool-definition'
import { SnapshotFormatter } from './snapshot-formatter'

export class CdpResponse implements Response {
  #includePages = false
  #snapshotParams?: SnapshotParams
  #textResponseLines: string[] = []
  #images: ImageContentData[] = []
  #devToolsData?: DevToolsData
  #tabId?: string

  attachDevToolsData(data: DevToolsData): void {
    this.#devToolsData = data
  }

  setTabId(tabId: string): void {
    this.#tabId = tabId
  }

  setIncludePages(value: boolean): void {
    this.#includePages = value
  }

  includeSnapshot(params?: SnapshotParams): void {
    this.#snapshotParams = params ?? {
      verbose: false,
    }
  }

  get includePages(): boolean {
    return this.#includePages
  }

  appendResponseLine(value: string): void {
    this.#textResponseLines.push(value)
  }

  attachImage(value: ImageContentData): void {
    this.#images.push(value)
  }

  get responseLines(): readonly string[] {
    return this.#textResponseLines
  }

  get images(): ImageContentData[] {
    return this.#images
  }

  get snapshotParams(): SnapshotParams | undefined {
    return this.#snapshotParams
  }

  async handle(toolName: string, context: CdpContext): Promise<ToolResult> {
    if (this.#includePages) {
      await context.createPagesSnapshot()
    }

    let snapshot: SnapshotFormatter | string | undefined
    if (this.#snapshotParams) {
      await context.createTextSnapshot(
        this.#snapshotParams.verbose,
        this.#devToolsData,
      )
      const textSnapshot = context.getTextSnapshot()
      if (textSnapshot) {
        const formatter = new SnapshotFormatter(textSnapshot)
        if (this.#snapshotParams.filePath) {
          await context.saveFile(
            new TextEncoder().encode(formatter.toString()),
            this.#snapshotParams.filePath,
          )
          snapshot = this.#snapshotParams.filePath
        } else {
          snapshot = formatter
        }
      }
    }

    return this.format(toolName, context, {
      snapshot,
    })
  }

  format(
    toolName: string,
    context: CdpContext,
    data: {
      snapshot: SnapshotFormatter | string | undefined
    },
  ): ToolResult {
    const structuredContent: Record<string, unknown> = {}

    const response = [`# ${toolName} response`]
    if (this.#textResponseLines.length) {
      structuredContent.message = this.#textResponseLines.join('\n')
      response.push(...this.#textResponseLines)
    }

    const networkConditions = context.getNetworkConditions()
    if (networkConditions) {
      response.push(`## Network emulation`)
      response.push(`Emulating: ${networkConditions}`)
      response.push(
        `Default navigation timeout set to ${context.getNavigationTimeout()} ms`,
      )
      structuredContent.networkConditions = networkConditions
      structuredContent.navigationTimeout = context.getNavigationTimeout()
    }

    const viewport = context.getViewport()
    if (viewport) {
      response.push(`## Viewport emulation`)
      response.push(`Emulating viewport: ${JSON.stringify(viewport)}`)
      structuredContent.viewport = viewport
    }

    const userAgent = context.getUserAgent()
    if (userAgent) {
      response.push(`## UserAgent emulation`)
      response.push(`Emulating userAgent: ${userAgent}`)
      structuredContent.userAgent = userAgent
    }

    const cpuThrottlingRate = context.getCpuThrottlingRate()
    if (cpuThrottlingRate > 1) {
      response.push(`## CPU emulation`)
      response.push(`Emulating: ${cpuThrottlingRate}x slowdown`)
      structuredContent.cpuThrottlingRate = cpuThrottlingRate
    }

    const colorScheme = context.getColorScheme()
    if (colorScheme) {
      response.push(`## Color Scheme emulation`)
      response.push(`Emulating: ${colorScheme}`)
      structuredContent.colorScheme = colorScheme
    }

    const dialog = context.getDialog()
    if (dialog) {
      const defaultValueIfNeeded =
        dialog.type() === 'prompt'
          ? ` (default value: "${dialog.defaultValue()}")`
          : ''
      response.push(`# Open dialog
${dialog.type()}: ${dialog.message()}${defaultValueIfNeeded}.
Call ${handleDialog.name} to handle it before continuing.`)
      structuredContent.dialog = {
        type: dialog.type(),
        message: dialog.message(),
        defaultValue: dialog.defaultValue(),
      }
    }

    if (this.#includePages) {
      const parts = [`## Pages`]
      for (const page of context.getPages()) {
        parts.push(
          `${context.getPageId(page)}: ${page.url()}${context.isPageSelected(page) ? ' [selected]' : ''}`,
        )
      }
      response.push(...parts)
      structuredContent.pages = context.getPages().map((page) => {
        return {
          id: context.getPageId(page),
          url: page.url(),
          selected: context.isPageSelected(page),
        }
      })
    }

    if (this.#tabId) {
      structuredContent.tabId = this.#tabId
    }

    if (data.snapshot) {
      if (typeof data.snapshot === 'string') {
        response.push(`Saved snapshot to ${data.snapshot}.`)
        structuredContent.snapshotFilePath = data.snapshot
      } else {
        response.push('## Latest page snapshot')
        response.push(data.snapshot.toString())
        structuredContent.snapshot = data.snapshot.toJSON()
      }
    }

    const text: TextContent = {
      type: 'text',
      text: response.join('\n'),
    }
    const images: ImageContent[] = this.#images.map((imageData) => {
      return {
        type: 'image',
        ...imageData,
      } as const
    })

    return {
      content: [text, ...images],
      structuredContent,
    }
  }

  resetResponseLineForTesting() {
    this.#textResponseLines = []
  }
}
