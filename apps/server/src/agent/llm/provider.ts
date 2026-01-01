/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * LLM provider creation - creates Vercel AI SDK language models.
 */

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createAzure } from '@ai-sdk/azure'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import { logger } from '../../common/index.js'
import { createOpenRouterCompatibleFetch } from '../agent/gemini-vercel-sdk-adapter/utils/fetch.js'
import type { ResolvedLLMConfig } from './types.js'

export function createLLMProvider(config: ResolvedLLMConfig): LanguageModel {
  const { provider, model, apiKey, baseUrl, upstreamProvider } = config

  switch (provider) {
    case 'anthropic':
      if (!apiKey) throw new Error('Anthropic provider requires apiKey')
      return createAnthropic({ apiKey })(model)

    case 'openai':
      if (!apiKey) throw new Error('OpenAI provider requires apiKey')
      return createOpenAI({ apiKey })(model)

    case 'google':
      if (!apiKey) throw new Error('Google provider requires apiKey')
      return createGoogleGenerativeAI({ apiKey })(model)

    case 'openrouter':
      if (!apiKey) throw new Error('OpenRouter provider requires apiKey')
      return createOpenRouter({
        apiKey,
        extraBody: { reasoning: {} },
        fetch: createOpenRouterCompatibleFetch(),
      })(model)

    case 'azure':
      if (!apiKey || !config.resourceName) {
        throw new Error('Azure provider requires apiKey and resourceName')
      }
      return createAzure({
        resourceName: config.resourceName,
        apiKey,
      })(model)

    case 'ollama':
      if (!baseUrl) throw new Error('Ollama provider requires baseUrl')
      return createOpenAICompatible({
        name: 'ollama',
        baseURL: baseUrl,
        ...(apiKey && { apiKey }),
      })(model)

    case 'lmstudio':
      if (!baseUrl) throw new Error('LMStudio provider requires baseUrl')
      return createOpenAICompatible({
        name: 'lmstudio',
        baseURL: baseUrl,
        ...(apiKey && { apiKey }),
      })(model)

    case 'bedrock':
      if (!config.accessKeyId || !config.secretAccessKey || !config.region) {
        throw new Error(
          'Bedrock provider requires accessKeyId, secretAccessKey, and region',
        )
      }
      return createAmazonBedrock({
        region: config.region,
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
      })(model)

    case 'browseros':
      if (!baseUrl) throw new Error('BrowserOS provider requires baseUrl')
      switch (upstreamProvider) {
        case 'openrouter':
          return createOpenRouter({
            baseURL: baseUrl,
            ...(apiKey && { apiKey }),
            fetch: createOpenRouterCompatibleFetch(),
          })(model)
        case 'anthropic':
          return createAnthropic({
            baseURL: baseUrl,
            ...(apiKey && { apiKey }),
          })(model)
        case 'azure':
          return createAzure({
            baseURL: baseUrl,
            ...(apiKey && { apiKey }),
          })(model)
        default:
          logger.debug('Creating OpenAI-compatible provider for BrowserOS')
          return createOpenAICompatible({
            name: 'browseros',
            baseURL: baseUrl,
            ...(apiKey && { apiKey }),
          })(model)
      }

    case 'openai-compatible':
      if (!baseUrl)
        throw new Error('OpenAI-compatible provider requires baseUrl')
      return createOpenAICompatible({
        name: 'openai-compatible',
        baseURL: baseUrl,
        ...(apiKey && { apiKey }),
      })(model)

    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
