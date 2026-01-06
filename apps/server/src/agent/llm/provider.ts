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
import { LLM_PROVIDERS } from '@browseros/shared/schemas/llm'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import { logger } from '../../common/index'
import { createOpenRouterCompatibleFetch } from '../agent/gemini-vercel-sdk-adapter/utils/fetch'
import type { ResolvedLLMConfig } from './types'

export function createLLMProvider(config: ResolvedLLMConfig): LanguageModel {
  const { provider, model, apiKey, baseUrl, upstreamProvider } = config

  switch (provider) {
    case LLM_PROVIDERS.ANTHROPIC:
      if (!apiKey) throw new Error('Anthropic provider requires apiKey')
      return createAnthropic({ apiKey })(model)

    case LLM_PROVIDERS.OPENAI:
      if (!apiKey) throw new Error('OpenAI provider requires apiKey')
      return createOpenAI({ apiKey })(model)

    case LLM_PROVIDERS.GOOGLE:
      if (!apiKey) throw new Error('Google provider requires apiKey')
      return createGoogleGenerativeAI({ apiKey })(model)

    case LLM_PROVIDERS.OPENROUTER:
      if (!apiKey) throw new Error('OpenRouter provider requires apiKey')
      return createOpenRouter({
        apiKey,
        extraBody: { reasoning: {} },
        fetch: createOpenRouterCompatibleFetch(),
      })(model)

    case LLM_PROVIDERS.AZURE:
      if (!apiKey || !config.resourceName) {
        throw new Error('Azure provider requires apiKey and resourceName')
      }
      return createAzure({
        resourceName: config.resourceName,
        apiKey,
      })(model)

    case LLM_PROVIDERS.OLLAMA:
      if (!baseUrl) throw new Error('Ollama provider requires baseUrl')
      return createOpenAICompatible({
        name: 'ollama',
        baseURL: baseUrl,
        ...(apiKey && { apiKey }),
      })(model)

    case LLM_PROVIDERS.LMSTUDIO:
      if (!baseUrl) throw new Error('LMStudio provider requires baseUrl')
      return createOpenAICompatible({
        name: 'lmstudio',
        baseURL: baseUrl,
        ...(apiKey && { apiKey }),
      })(model)

    case LLM_PROVIDERS.BEDROCK:
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

    case LLM_PROVIDERS.BROWSEROS:
      if (!baseUrl) throw new Error('BrowserOS provider requires baseUrl')
      switch (upstreamProvider) {
        case LLM_PROVIDERS.OPENROUTER:
          return createOpenRouter({
            baseURL: baseUrl,
            ...(apiKey && { apiKey }),
            fetch: createOpenRouterCompatibleFetch(),
          })(model)
        case LLM_PROVIDERS.ANTHROPIC:
          return createAnthropic({
            baseURL: baseUrl,
            ...(apiKey && { apiKey }),
          })(model)
        case LLM_PROVIDERS.AZURE:
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

    case LLM_PROVIDERS.OPENAI_COMPATIBLE:
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
