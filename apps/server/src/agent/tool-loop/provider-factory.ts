import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createAzure } from '@ai-sdk/azure'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { LLM_PROVIDERS } from '@browseros/shared/schemas/llm'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import { logger } from '../../lib/logger'
import { createOpenRouterCompatibleFetch } from '../../lib/openrouter-fetch'
import type { ResolvedAgentConfig } from '../types'

type ProviderFactory = (
  config: ResolvedAgentConfig,
) => (modelId: string) => unknown

function createAnthropicFactory(
  config: ResolvedAgentConfig,
): (modelId: string) => unknown {
  if (!config.apiKey) throw new Error('Anthropic provider requires apiKey')
  return createAnthropic({ apiKey: config.apiKey })
}

function createOpenAIFactory(
  config: ResolvedAgentConfig,
): (modelId: string) => unknown {
  if (!config.apiKey) throw new Error('OpenAI provider requires apiKey')
  return createOpenAI({ apiKey: config.apiKey })
}

function createGoogleFactory(
  config: ResolvedAgentConfig,
): (modelId: string) => unknown {
  if (!config.apiKey) throw new Error('Google provider requires apiKey')
  return createGoogleGenerativeAI({ apiKey: config.apiKey })
}

function createOpenRouterFactory(
  config: ResolvedAgentConfig,
): (modelId: string) => unknown {
  if (!config.apiKey) throw new Error('OpenRouter provider requires apiKey')
  return createOpenRouter({
    apiKey: config.apiKey,
    extraBody: { reasoning: {} },
    fetch: createOpenRouterCompatibleFetch(),
  })
}

function createAzureFactory(
  config: ResolvedAgentConfig,
): (modelId: string) => unknown {
  if (!config.apiKey || !config.resourceName) {
    throw new Error('Azure provider requires apiKey and resourceName')
  }
  return createAzure({
    resourceName: config.resourceName,
    apiKey: config.apiKey,
  })
}

function createLMStudioFactory(
  config: ResolvedAgentConfig,
): (modelId: string) => unknown {
  if (!config.baseUrl) throw new Error('LMStudio provider requires baseUrl')
  return createOpenAICompatible({
    name: 'lmstudio',
    baseURL: config.baseUrl,
    ...(config.apiKey && { apiKey: config.apiKey }),
  })
}

function createOllamaFactory(
  config: ResolvedAgentConfig,
): (modelId: string) => unknown {
  if (!config.baseUrl) throw new Error('Ollama provider requires baseUrl')
  return createOpenAICompatible({
    name: 'ollama',
    baseURL: config.baseUrl,
    ...(config.apiKey && { apiKey: config.apiKey }),
  })
}

function createBedrockFactory(
  config: ResolvedAgentConfig,
): (modelId: string) => unknown {
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
  })
}

function createBrowserOSFactory(
  config: ResolvedAgentConfig,
): (modelId: string) => unknown {
  if (!config.baseUrl) throw new Error('BrowserOS provider requires baseUrl')
  const { baseUrl, apiKey, upstreamProvider } = config

  if (upstreamProvider === LLM_PROVIDERS.OPENROUTER) {
    return createOpenRouter({
      baseURL: baseUrl,
      ...(apiKey && { apiKey }),
      fetch: createOpenRouterCompatibleFetch(),
    })
  }
  if (upstreamProvider === LLM_PROVIDERS.ANTHROPIC) {
    return createAnthropic({ baseURL: baseUrl, ...(apiKey && { apiKey }) })
  }
  if (upstreamProvider === LLM_PROVIDERS.AZURE) {
    return createAzure({ baseURL: baseUrl, ...(apiKey && { apiKey }) })
  }
  logger.info('creating openai-compatible')
  return createOpenAICompatible({
    name: 'browseros',
    baseURL: baseUrl,
    ...(apiKey && { apiKey }),
  })
}

function createOpenAICompatibleFactory(
  config: ResolvedAgentConfig,
): (modelId: string) => unknown {
  if (!config.baseUrl)
    throw new Error('OpenAI-compatible provider requires baseUrl')
  return createOpenAICompatible({
    name: 'openai-compatible',
    baseURL: config.baseUrl,
    ...(config.apiKey && { apiKey: config.apiKey }),
  })
}

const PROVIDER_FACTORIES: Record<string, ProviderFactory> = {
  [LLM_PROVIDERS.ANTHROPIC]: createAnthropicFactory,
  [LLM_PROVIDERS.OPENAI]: createOpenAIFactory,
  [LLM_PROVIDERS.GOOGLE]: createGoogleFactory,
  [LLM_PROVIDERS.OPENROUTER]: createOpenRouterFactory,
  [LLM_PROVIDERS.AZURE]: createAzureFactory,
  [LLM_PROVIDERS.LMSTUDIO]: createLMStudioFactory,
  [LLM_PROVIDERS.OLLAMA]: createOllamaFactory,
  [LLM_PROVIDERS.BEDROCK]: createBedrockFactory,
  [LLM_PROVIDERS.BROWSEROS]: createBrowserOSFactory,
  [LLM_PROVIDERS.OPENAI_COMPATIBLE]: createOpenAICompatibleFactory,
}

export function createLanguageModel(
  config: ResolvedAgentConfig,
): LanguageModel {
  const provider = config.provider as string
  const factory = PROVIDER_FACTORIES[provider]
  if (!factory) throw new Error(`Unknown provider: ${provider}`)
  return factory(config)(config.model) as LanguageModel
}
