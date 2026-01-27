/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Swarm LLM Provider - Creates an LLM provider for swarm task decomposition
 *
 * This provider uses the BrowserOS gateway to generate text for task planning.
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import { generateText } from 'ai'
import {
  fetchBrowserOSConfig,
  getLLMConfigFromProvider,
} from '../../lib/clients/gateway'
import { logger } from '../../lib/logger'
import type { LLMProvider } from '../coordinator/task-planner'

const BROWSEROS_CONFIG_URL =
  'https://llm.browseros.com/api/browseros-server/config'

/**
 * Creates an LLM provider for swarm task decomposition.
 * This lazily fetches the BrowserOS config and creates a model on first use.
 */
export function createSwarmLLMProvider(browserosId?: string): LLMProvider {
  let cachedModel: LanguageModel | null = null
  let initPromise: Promise<LanguageModel> | null = null

  async function getModel(): Promise<LanguageModel> {
    if (cachedModel) {
      return cachedModel
    }

    if (initPromise) {
      return initPromise
    }

    initPromise = (async () => {
      logger.info('Swarm LLM: Fetching BrowserOS config', { browserosId })

      const config = await fetchBrowserOSConfig(
        BROWSEROS_CONFIG_URL,
        browserosId,
      )
      const llmConfig = getLLMConfigFromProvider(config, 'default')

      logger.info('Swarm LLM: Creating model', {
        model: llmConfig.modelName,
        baseUrl: llmConfig.baseUrl,
      })

      // Create an OpenAI-compatible model using BrowserOS gateway
      const provider = createOpenAICompatible({
        name: 'browseros-swarm',
        baseURL: llmConfig.baseUrl || 'https://llm.browseros.com/default',
        headers: {
          Authorization: `Bearer ${llmConfig.apiKey}`,
        },
      })

      cachedModel = provider(llmConfig.modelName)
      return cachedModel
    })()

    return initPromise
  }

  return {
    async generate(prompt: string): Promise<string> {
      const model = await getModel()

      logger.debug('Swarm LLM: Generating response', {
        promptLength: prompt.length,
      })

      const result = await generateText({
        model,
        prompt,
        maxOutputTokens: 4096,
        temperature: 0.3, // Lower temperature for more consistent task decomposition
      })

      logger.debug('Swarm LLM: Response generated', {
        responseLength: result.text.length,
        usage: result.usage,
      })

      return result.text
    },
  }
}
