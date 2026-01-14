/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Extract Service - Structured data extraction via remote service
 */

import { EXTERNAL_URLS } from '@browseros/shared/constants/urls'
import { createCodegenAuthHeaders } from '../../utils/codegen-auth'
import { SdkError } from './types'

export interface ExtractServiceDeps {
  browserosId?: string
  hmacSecret?: string
}

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
  private deps: ExtractServiceDeps

  constructor(deps: ExtractServiceDeps = {}) {
    this.serviceUrl = `${EXTERNAL_URLS.CODEGEN_SERVICE}/api/extract`
    this.deps = deps
  }

  async extract(options: ExtractOptions): Promise<unknown> {
    const { instruction, schema, content, context } = options

    const bodyStr = JSON.stringify({
      instruction,
      schema,
      content,
      context,
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.deps.hmacSecret && this.deps.browserosId) {
      const authHeaders = createCodegenAuthHeaders(
        { hmacSecret: this.deps.hmacSecret, userId: this.deps.browserosId },
        'POST',
        '/api/extract',
        bodyStr,
      )
      Object.assign(headers, authHeaders)
    }

    const response = await fetch(this.serviceUrl, {
      method: 'POST',
      headers,
      body: bodyStr,
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
