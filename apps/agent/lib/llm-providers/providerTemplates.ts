import type { ProviderType } from './types'

/**
 * Provider template for quick setup
 * @public
 */
export interface ProviderTemplate {
  id: ProviderType
  name: string
  defaultBaseUrl: string
  defaultModelId: string
  supportsImages: boolean
  contextWindow: number
  setupGuideUrl?: string
  apiKeyUrl?: string
}

/**
 * Available provider templates for quick setup
 * @public
 */
export const providerTemplates: ProviderTemplate[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModelId: 'gpt-4',
    supportsImages: true,
    contextWindow: 128000,
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    setupGuideUrl: 'https://docs.browseros.com/bring-your-own-keys/openai',
  },
  {
    id: 'openai-compatible',
    name: 'OpenAI Compatible',
    defaultBaseUrl: '',
    defaultModelId: '',
    supportsImages: true,
    contextWindow: 128000,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModelId: 'claude-3-5-sonnet-20241022',
    supportsImages: true,
    contextWindow: 200000,
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    setupGuideUrl: 'https://docs.browseros.com/bring-your-own-keys/claude',
  },
  {
    id: 'google',
    name: 'Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModelId: 'gemini-1.5-pro',
    supportsImages: true,
    contextWindow: 1000000,
    apiKeyUrl: 'https://aistudio.google.com/app/apikey',
    setupGuideUrl: 'https://docs.browseros.com/bring-your-own-keys/gemini',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultModelId: 'llama3.2',
    supportsImages: false,
    contextWindow: 128000,
    setupGuideUrl: 'https://docs.browseros.com/local-LLMs/ollama',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModelId: 'openai/gpt-4-turbo',
    supportsImages: true,
    contextWindow: 128000,
    apiKeyUrl: 'https://openrouter.ai/keys',
    setupGuideUrl: 'https://docs.browseros.com/bring-your-own-keys/openrouter',
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    defaultBaseUrl: 'http://localhost:1234/v1',
    defaultModelId: 'local-model',
    supportsImages: false,
    contextWindow: 32000,
    setupGuideUrl: 'https://docs.browseros.com/local-LLMs/lm-studio',
  },
  {
    id: 'azure',
    name: 'Azure',
    defaultBaseUrl: '',
    defaultModelId: '',
    supportsImages: true,
    contextWindow: 128000,
    apiKeyUrl:
      'https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI',
  },
  {
    id: 'bedrock',
    name: 'AWS Bedrock',
    defaultBaseUrl: '',
    defaultModelId: '',
    supportsImages: true,
    contextWindow: 200000,
    setupGuideUrl:
      'https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started.html',
  },
]

/**
 * Provider type options for select dropdowns
 * @public
 */
export const providerTypeOptions: { value: ProviderType; label: string }[] = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'google', label: 'Gemini' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'azure', label: 'Azure' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'lmstudio', label: 'LM Studio' },
  { value: 'bedrock', label: 'AWS Bedrock' },
  { value: 'browseros', label: 'BrowserOS' },
]

/**
 * Get provider template by type
 * @public
 */
export const getProviderTemplate = (
  type: ProviderType,
): ProviderTemplate | undefined => {
  return providerTemplates.find((t) => t.id === type)
}

/**
 * Default base URLs for each provider type
 * Auto-fills when user selects a provider type
 */
export const DEFAULT_BASE_URLS: Record<ProviderType, string> = {
  anthropic: 'https://api.anthropic.com/v1',
  openai: 'https://api.openai.com/v1',
  'openai-compatible': '',
  google: 'https://generativelanguage.googleapis.com/v1beta',
  openrouter: 'https://openrouter.ai/api/v1',
  azure: '',
  ollama: 'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1',
  bedrock: '',
  browseros: '',
}

/**
 * Get default base URL for a provider type
 * @public
 */
export const getDefaultBaseUrlForProviders = (type: ProviderType): string => {
  return DEFAULT_BASE_URLS[type] || ''
}
