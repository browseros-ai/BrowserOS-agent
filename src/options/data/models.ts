export interface ModelInfo {
  modelId: string
  contextLength: number
}

export interface ModelsData {
  openai: ModelInfo[]
  anthropic: ModelInfo[]
  google_gemini: ModelInfo[]
  openrouter: ModelInfo[]
  openai_compatible: ModelInfo[]
  ollama: ModelInfo[]
}

export const MODELS_DATA: ModelsData = {
  openai: [
    // GPT-4.1 Series - 1M context
    { modelId: 'gpt-4.1', contextLength: 1000000 },
    { modelId: 'gpt-4.1-mini', contextLength: 1000000 },
    { modelId: 'o4-mini', contextLength: 200000 },
    { modelId: 'o3-mini', contextLength: 200000 },
    { modelId: 'gpt-4o', contextLength: 128000 },
    { modelId: 'gpt-4o-mini', contextLength: 128000 },
  ],
  anthropic: [
    { modelId: 'claude-sonnet-4-5-20250929', contextLength: 200000 },
    { modelId: 'claude-sonnet-4-20250514', contextLength: 200000 },
    { modelId: 'claude-opus-4-20250514', contextLength: 200000 },
    { modelId: 'claude-3-7-sonnet-20250219', contextLength: 200000 },
    { modelId: 'claude-3-5-haiku-20241022', contextLength: 200000 }
  ],
  google_gemini: [
    { modelId: 'gemini-2.5-flash', contextLength: 1048576 },  // 1M context
    { modelId: 'gemini-2.5-pro', contextLength: 1048576 },  // 1M context
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
  openai_compatible: [
    { modelId: 'openai/gpt-oss-20b', contextLength: 128000 },  // GPT OSS 20B
    { modelId: 'lmstudio-community/Qwen3-14B-GGUF', contextLength: 131072 },  // Qwen3 14B
    { modelId: 'lmstudio-community/Qwen3-8B-GGUF', contextLength: 131072 },  // Qwen3 8B
  ],
  ollama: [
    { modelId: 'qwen3:4b', contextLength: 262144 },  // 256K context
    { modelId: 'qwen3:8b', contextLength: 40960 },  // 40K context
    { modelId: 'qwen3:14b', contextLength: 40960 },  // 40K context
    { modelId: 'gpt-oss:20b', contextLength: 128000 },  // 128K context
    { modelId: 'gpt-oss:120b', contextLength: 128000 }  // 128K context
  ]
}

export function getModelsForProvider(providerType: string): ModelInfo[] {
  const normalizedType = providerType.toLowerCase() as keyof ModelsData
  return MODELS_DATA[normalizedType] || []
}

export function getModelContextLength(providerType: string, modelId: string): number | undefined {
  const models = getModelsForProvider(providerType)
  const model = models.find(m => m.modelId === modelId)
  return model?.contextLength
}
