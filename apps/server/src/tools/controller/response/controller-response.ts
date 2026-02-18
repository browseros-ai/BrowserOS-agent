/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ControllerClient } from '../../../browser/extension/controller-client'
import { BaseResponse } from '../../types/base-response'
import type { ToolResult } from '../../types/response'

export class ControllerResponse extends BaseResponse {
  #snapshotTabId: number | null = null
  #screenshotTabId: number | null = null

  setIncludeSnapshot(tabId: number): void {
    this.#snapshotTabId = tabId
  }

  setIncludeScreenshot(tabId: number): void {
    this.#screenshotTabId = tabId
  }

  async handle(client: ControllerClient): Promise<ToolResult> {
    const content = this.toContent()

    if (this.#snapshotTabId != null) {
      try {
        const result = await client.executeAction('getSnapshot', {
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
        // Best effort only.
      }
    }

    if (this.#screenshotTabId != null) {
      try {
        const result = await client.executeAction('captureScreenshot', {
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
        // Best effort only.
      }
    }

    return {
      content,
      structuredContent: this.structuredContent,
    }
  }
}
