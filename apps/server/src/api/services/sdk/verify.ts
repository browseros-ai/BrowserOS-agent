/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Verify Service - Page verification via LLM
 */

import type { LLMConfig } from '@browseros/shared/schemas/llm'
import type { ModelMessage } from 'ai'
import { LLMClient } from '../../../lib/clients/llm/client'
import type { Screenshot } from './types'

export interface VerifyOptions {
  expectation: string
  screenshot: Screenshot
  pageContent: string
  context?: Record<string, unknown>
  llmConfig: LLMConfig
  browserosId?: string
}

export interface VerifyResult {
  success: boolean
  reason: string
}

export class VerifyService {
  async verify(options: VerifyOptions): Promise<VerifyResult> {
    const {
      expectation,
      screenshot,
      pageContent,
      context,
      llmConfig,
      browserosId,
    } = options

    const client = await LLMClient.create(llmConfig, browserosId)

    let textPrompt = `Verify this expectation about the current page:

${expectation}

Look at the screenshot and page content. Determine if the expectation is met.

Your response MUST start with exactly one of these words:
- SUCCESS - if the expectation is met
- FAILURE - if the expectation is NOT met

Then explain your reasoning.`

    if (context) {
      textPrompt += `\n\nAdditional context:\n${JSON.stringify(context, null, 2)}`
    }
    textPrompt += `\n\nPage text content:\n${pageContent}`

    const imageUrl = `data:${screenshot.mimeType};base64,${screenshot.data}`

    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'image', image: imageUrl },
          { type: 'text', text: textPrompt },
        ],
      },
    ]

    const response = await client.generateText(messages)

    const trimmed = response.trim()
    const success = /^SUCCESS\b/i.test(trimmed)
    const reason = trimmed.replace(/^(SUCCESS|FAILURE)\s*/i, '').trim()

    return { success, reason }
  }
}
