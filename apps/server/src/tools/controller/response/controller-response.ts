/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { BaseResponse } from '../../types/base-response'
import type { ToolResult } from '../../types/response'
import type { Context } from '../types/context'
import type { Response } from '../types/response'

export class ControllerResponse extends BaseResponse implements Response {
  #structuredContent: Record<string, unknown> = {}

  addStructuredContent(key: string, value: unknown): void {
    if (!key || typeof key !== 'string') {
      return
    }
    if (value === undefined) {
      return
    }
    this.#structuredContent[key] = value
  }

  #snapshotTabId: number | null = null
  #screenshotTabId: number | null = null

  setIncludeSnapshot(tabId: number): void {
    this.#snapshotTabId = tabId
  }

  setIncludeScreenshot(tabId: number): void {
    this.#screenshotTabId = tabId
  }

  async handle(context: Context): Promise<ToolResult> {
    const content = this.toContent()

    if (this.#snapshotTabId != null) {
      try {
        const result = await context.executeAction('getSnapshot', {
          tabId: this.#snapshotTabId,
          type: 'text',
        })
        const snapshot = result as { items?: Array<{ text: string }> }
        if (snapshot?.items?.length) {
          const text = snapshot.items.map((item) => item.text).join('\n')
          content.push({
            type: 'text',
            text: `\n## Page Content After Action (page loaded, no need to check load status)\n${text}`,
          })
        }
      } catch {
        // Enrichment is best-effort; don't fail the tool response
      }
    }

    if (this.#screenshotTabId != null) {
      try {
        const result = await context.executeAction('captureScreenshot', {
          tabId: this.#screenshotTabId,
        })
        const data = result as { data?: string; mimeType?: string }
        if (data?.data) {
          content.push({
            type: 'image',
            data: data.data,
            mimeType: data.mimeType ?? 'image/png',
          })
        }
      } catch {
        // Enrichment is best-effort; don't fail the tool response
      }
    }

    return {
      content:
        content.length > 0 ? content : [{ type: 'text', text: 'Success' }],
      structuredContent: this.#structuredContent,
    }
  }
}
