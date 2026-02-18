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
  protected textResponseLines: string[] = []
  private _images: ImageContentData[] = []

  appendResponseLine(value: string): void {
    this.textResponseLines.push(value)
  }

  attachImage(value: ImageContentData): void {
    this._images.push(value)
  }

  get responseLines(): readonly string[] {
    return this.textResponseLines
  }

  get images(): ImageContentData[] {
    return this._images
  }

  toContent(): Array<TextContent | ImageContent> {
    const content: Array<TextContent | ImageContent> = []

    if (this.textResponseLines.length > 0) {
      content.push({
        type: 'text',
        text: this.textResponseLines.join('\n'),
      })
    }

    for (const img of this._images) {
      content.push({
        type: 'image',
        data: img.data,
        mimeType: img.mimeType,
      })
    }

    return content
  }
}
