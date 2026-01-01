/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Lightweight LLM client for structured output generation.
 * Used by SDK endpoints (extract, verify).
 */

import type { LLMConfig } from '@browseros/shared/types/llm'
import type { LanguageModel, ModelMessage } from 'ai'
import { generateText, jsonSchema, Output } from 'ai'
import { resolveLLMConfig } from './config.js'
import { createLLMProvider } from './provider.js'

export class LLMClient {
  private constructor(private model: LanguageModel) {}

  static async create(
    config: LLMConfig,
    browserosId?: string,
  ): Promise<LLMClient> {
    const resolved = await resolveLLMConfig(config, browserosId)
    const model = createLLMProvider(resolved)
    return new LLMClient(model)
  }

  async generateStructuredOutput<T>(
    messages: ModelMessage[],
    schema: Record<string, unknown>,
  ): Promise<T> {
    const result = await generateText({
      model: this.model,
      messages,
      experimental_output: Output.object({ schema: jsonSchema(schema) }),
    })

    return result.experimental_output as T
  }

  async generateText(messages: ModelMessage[]): Promise<string> {
    const result = await generateText({
      model: this.model,
      messages,
    })

    return result.text
  }
}
