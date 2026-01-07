/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * LLM config resolution - handles BROWSEROS provider lookup.
 */

import { LLM_PROVIDERS, type LLMConfig } from '@browseros/shared/schemas/llm'
import {
  fetchBrowserOSConfig,
  getLLMConfigFromProvider,
} from '../../common/gateway'
import { logger } from '../../common/logger'
import type { ResolvedLLMConfig } from './types'

export async function resolveLLMConfig(
  config: LLMConfig,
  browserosId?: string,
): Promise<ResolvedLLMConfig> {
  if (config.provider !== LLM_PROVIDERS.BROWSEROS) {
    if (!config.model) {
      throw new Error(`model is required for ${config.provider} provider`)
    }
    return config as ResolvedLLMConfig
  }

  const configUrl = process.env.BROWSEROS_CONFIG_URL
  if (!configUrl) {
    throw new Error(
      'BROWSEROS_CONFIG_URL environment variable is required for BrowserOS provider',
    )
  }

  logger.debug('Resolving BROWSEROS config', { configUrl, browserosId })

  const browserosConfig = await fetchBrowserOSConfig(configUrl, browserosId)
  const llmConfig = getLLMConfigFromProvider(browserosConfig, 'default')

  return {
    ...config,
    model: llmConfig.modelName,
    apiKey: llmConfig.apiKey,
    baseUrl: llmConfig.baseUrl,
    upstreamProvider: llmConfig.providerType,
  }
}
