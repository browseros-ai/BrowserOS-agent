import type { ProviderType } from '@/lib/llm-providers/types'

/**
 * Model information with context length
 */
export interface ModelInfo {
  modelId: string
  contextLength: number
}

/**
 * Models data organized by provider type (matches backend AIProvider enum)
 */
export interface ModelsData {
  anthropic: ModelInfo[]
  openai: ModelInfo[]
  'openai-compatible': ModelInfo[]
  google: ModelInfo[]
  openrouter: ModelInfo[]
  azure: ModelInfo[]
  ollama: ModelInfo[]
  lmstudio: ModelInfo[]
  bedrock: ModelInfo[]
  browseros: ModelInfo[]
}

/**
 * Available models per provider with context lengths
 * Based on: https://github.com/browseros-ai/BrowserOS-agent/blob/main/src/options/data/models.ts
 */
export const MODELS_DATA: ModelsData = {
  anthropic: [
    { modelId: 'claude-sonnet-4-5-20250929', contextLength: 200000 },
    { modelId: 'claude-sonnet-4-20250514', contextLength: 200000 },
    { modelId: 'claude-opus-4-20250514', contextLength: 200000 },
    { modelId: 'claude-3-7-sonnet-20250219', contextLength: 200000 },
    { modelId: 'claude-3-5-haiku-20241022', contextLength: 200000 },
  ],
  openai: [
    { modelId: 'gpt-5', contextLength: 400000 },
    { modelId: 'gpt-5-mini', contextLength: 400000 },
    { modelId: 'gpt-5-nano', contextLength: 400000 },
    { modelId: 'gpt-4.1', contextLength: 1000000 },
    { modelId: 'gpt-4.1-mini', contextLength: 1000000 },
    { modelId: 'o4-mini', contextLength: 200000 },
    { modelId: 'o3-mini', contextLength: 200000 },
    { modelId: 'gpt-4o', contextLength: 128000 },
    { modelId: 'gpt-4o-mini', contextLength: 128000 },
  ],
  'openai-compatible': [],
  google: [
    { modelId: 'gemini-2.5-flash', contextLength: 1048576 },
    { modelId: 'gemini-2.5-pro', contextLength: 1048576 },
  ],
  openrouter: [
    { modelId: 'google/gemini-2.5-flash', contextLength: 1048576 },
    { modelId: 'openai/gpt-4o', contextLength: 128000 },
    { modelId: 'anthropic/claude-sonnet-4.5', contextLength: 1000000 },
    { modelId: 'anthropic/claude-sonnet-4', contextLength: 1000000 },
    { modelId: 'anthropic/claude-3.7-sonnet', contextLength: 200000 },
    { modelId: 'openai/gpt-oss-120b', contextLength: 128000 },
    { modelId: 'openai/gpt-oss-20b', contextLength: 128000 },
    { modelId: 'qwen/qwen3-14b', contextLength: 131072 },
    { modelId: 'qwen/qwen3-8b', contextLength: 131072 },
  ],
  azure: [],
  ollama: [
    { modelId: 'qwen3:4b', contextLength: 262144 },
    { modelId: 'qwen3:8b', contextLength: 40960 },
    { modelId: 'qwen3:14b', contextLength: 40960 },
    { modelId: 'gpt-oss:20b', contextLength: 128000 },
    { modelId: 'gpt-oss:120b', contextLength: 128000 },
  ],
  lmstudio: [
    { modelId: 'openai/gpt-oss-20b', contextLength: 128000 },
    { modelId: 'openai/gpt-oss-120b', contextLength: 128000 },
    { modelId: 'qwen/qwen3-vl-8b', contextLength: 131072 },
  ],
  bedrock: [],
  browseros: [],
}

/**
 * Get models for a specific provider type
 */
export function getModelsForProvider(providerType: ProviderType): ModelInfo[] {
  return MODELS_DATA[providerType] || []
}

/**
 * Get model options for select dropdown (model IDs + custom option)
 */
export function getModelOptions(providerType: ProviderType): string[] {
  const models = getModelsForProvider(providerType)
  const modelIds = models.map((m) => m.modelId)
  return modelIds.length > 0 ? [...modelIds, 'custom'] : ['custom']
}

/**
 * Get context length for a specific model
 */
export function getModelContextLength(
  providerType: ProviderType,
  modelId: string,
): number | undefined {
  const models = getModelsForProvider(providerType)
  const model = models.find((m) => m.modelId === modelId)
  return model?.contextLength
}

/**
 * Check if model ID is a custom (user-entered) value
 */
export function isCustomModel(
  providerType: ProviderType,
  modelId: string,
): boolean {
  const models = getModelsForProvider(providerType)
  return !models.some((m) => m.modelId === modelId)
}
