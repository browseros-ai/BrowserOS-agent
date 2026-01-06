/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Extract Service - Structured data extraction via remote service
 */

import { EXTERNAL_URLS } from '@browseros/shared/constants/urls'
import { SdkError } from './types'

export interface ExtractOptions {
  instruction: string
  schema: Record<string, unknown>
  content: string
  context?: Record<string, unknown>
}

export interface ExtractResult {
  data: unknown
}

export class ExtractService {
  private serviceUrl: string

  constructor() {
    this.serviceUrl = `${EXTERNAL_URLS.CODEGEN_SERVICE}/api/extract`
  }

  async extract(options: ExtractOptions): Promise<unknown> {
    const { instruction, schema, content, context } = options

    const response = await fetch(this.serviceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction,
        schema,
        content,
        context,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage =
        (errorData as { error?: string }).error || 'Extraction service failed'
      const status =
        response.status >= 400 && response.status < 600 ? response.status : 500
      throw new SdkError(errorMessage, status)
    }

    const result = (await response.json()) as ExtractResult
    return result.data
  }
}
