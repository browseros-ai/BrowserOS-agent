/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ImageContentData } from '../../types/response'

export type { ImageContentData } from '../../types/response'

export interface Response {
  appendResponseLine(value: string): void
  attachImage(value: ImageContentData): void
  addStructuredContent(key: string, value: unknown): void
  setIncludeSnapshot?(tabId: number): void
  setIncludeScreenshot?(tabId: number): void
}
