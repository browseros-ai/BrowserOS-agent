/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type {
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js'
import type { ImageContentData } from './response'

export abstract class BaseResponse {
  #textLines: string[] = []
  #images: ImageContentData[] = []
  #structuredContent: Record<string, unknown> = {}

  appendResponseLine(value: string): void {
    this.#textLines.push(value)
  }

  attachImage(value: ImageContentData): void {
    this.#images.push(value)
  }

  addStructuredContent(key: string, value: unknown): void {
    if (!key || typeof key !== 'string' || value === undefined) {
      return
    }
    this.#structuredContent[key] = value
  }

  protected get responseLines(): readonly string[] {
    return this.#textLines
  }

  protected get structuredContent(): Record<string, unknown> {
    return this.#structuredContent
  }

  protected toContent(): Array<TextContent | ImageContent> {
    const content: Array<TextContent | ImageContent> = []

    if (this.#textLines.length > 0) {
      content.push({ type: 'text', text: this.#textLines.join('\n') })
    }

    for (const image of this.#images) {
      content.push({
        type: 'image',
        data: image.data,
        mimeType: image.mimeType,
      })
    }

    if (content.length === 0) {
      content.push({ type: 'text', text: 'Success' })
    }

    return content
  }
}
