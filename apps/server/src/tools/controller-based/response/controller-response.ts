/**
 * @license
 * Copyright 2025 BrowserOS
 */
import type {
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js'

import type { Context } from '../types/context'
import type { ImageContentData, Response } from '../types/response'

/**
 * Response builder for controller tools.
 * Collects text lines and images, then converts to MCP content format.
 */
export class ControllerResponse implements Response {
  #textResponseLines: string[] = []
  #images: ImageContentData[] = []
  #structuredContent: Record<string, unknown> = {}

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

  addStructuredContent(key: string, value: unknown): void {
    if (!key || typeof key !== 'string') {
      return
    }
    if (value === undefined) {
      return
    }
    this.#structuredContent[key] = value
  }

  get structuredContent(): Record<string, unknown> | undefined {
    return Object.keys(this.#structuredContent).length > 0
      ? this.#structuredContent
      : undefined
  }

  #snapshotTabId: number | null = null
  #screenshotTabId: number | null = null

  setIncludeSnapshot(tabId: number): void {
    this.#snapshotTabId = tabId
  }

  setIncludeScreenshot(tabId: number): void {
    this.#screenshotTabId = tabId
  }

  async handle(context: Context): Promise<Array<TextContent | ImageContent>> {
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
            text: `\n## Page Content After Action\n${text}`,
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

    return content
  }

  /**
   * Convert collected data to MCP content format
   */
  toContent(): Array<TextContent | ImageContent> {
    const content: Array<TextContent | ImageContent> = []

    // Add text if any
    if (this.#textResponseLines.length > 0) {
      content.push({
        type: 'text',
        text: this.#textResponseLines.join('\n'),
      })
    }

    // Add images if any
    for (const image of this.#images) {
      content.push({
        type: 'image',
        data: image.data,
        mimeType: image.mimeType,
      })
    }

    // Default to success message if no content
    return content.length > 0 ? content : [{ type: 'text', text: 'Success' }]
  }
}
