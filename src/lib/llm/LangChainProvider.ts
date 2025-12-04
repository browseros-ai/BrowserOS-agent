/**
 * LangChainProvider - Singleton pattern for LLM instance management
 * 
 * This module exports a pre-initialized singleton instance that's created
 * when the module is first imported. The getInstance() method ensures only
 * one instance exists throughout the application lifecycle.
 * 
 * Usage: import { getLLM } from '@/lib/llm/LangChainProvider'
 * No manual initialization needed - the singleton is created automatically.
 */
import { ChatOpenAI } from "@langchain/openai"
import { ChatAnthropic } from "@langchain/anthropic"
import { ChatOllama } from "@langchain/ollama"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { BaseMessage } from "@langchain/core/messages"
import { Runnable } from "@langchain/core/runnables"
import { LLMSettingsReader } from "@/lib/llm/settings/LLMSettingsReader"
import { BrowserOSProvider } from '@/lib/llm/settings/browserOSTypes'
import { Logging } from '@/lib/utils/Logging'
import { z } from 'zod'

// Default constants
const DEFAULT_TEMPERATURE = 0.2
const DEFAULT_STREAMING = true
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_OPENAI_MODEL = "gpt-4o"
const DEFAULT_ANTHROPIC_MODEL = 'claude-4-sonnet'
const DEFAULT_OLLAMA_MODEL = "qwen3:4b"
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434"
const BROWSEROS_DEFAULT_PROXY_URL = "https://llm.browseros.com/default/"
const BROWSEROS_FAST_LLM_PROXY_URL = "https://llm.browseros.com/fast/"
const BROWSEROS_SMART_LLM_PROXY_URL = "https://llm.browseros.com/smart/"
const DEFAULT_BROWSEROS_MODEL_FAMILY_URL = "https://llm.browseros.com/api/model_family"
const DEFAULT_BROWSEROS_MODEL = "openai"  // Fallback model family
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
const DEFAULT_INTELLIGENCE = 'high'

// LLM options schema
export const LLMOptionsSchema = z.object({
  temperature: z.number().min(0).max(1).optional(),  // Model temperature for randomness
  maxTokens: z.number().positive().optional(),  // Maximum tokens for response
  intelligence: z.enum(['low', 'high']).default(DEFAULT_INTELLIGENCE).optional()  // Model intelligence level
})

export type LLMOptions = z.infer<typeof LLMOptionsSchema>

// Model capabilities interface
export interface ModelCapabilities {
  maxTokens: number;  // Maximum context window size
  supportsImages: boolean;  // Whether the provider supports image inputs
}

// BrowserOS API response structure
interface BrowserOSModelConfig {
  default: string;  // Default provider when no intelligence specified
  fast: string;  // Provider for low intelligence (speed/cost optimized)
  smart: string;  // Provider for high intelligence (quality optimized)
}

export class LangChainProvider {
  private static instance: LangChainProvider
  private currentProvider: BrowserOSProvider | null = null

  // Skip token counting flag - set to true for maximum speed (returns fixed estimates)
  private static readonly SKIP_TOKEN_COUNTING = false

  // Model config cache for BrowserOS - now stores full API response
  private modelConfigCache: { config: BrowserOSModelConfig; timestamp: number } | null = null
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000  // 5 minutes

  // Constructor and initialization
  static getInstance(): LangChainProvider {
    if (!LangChainProvider.instance) {
      LangChainProvider.instance = new LangChainProvider()
    }
    return LangChainProvider.instance
  }

  // Public getter methods
  async getLLM(options?: LLMOptions): Promise<BaseChatModel> {
    // Parse and validate options with defaults
    const parsedOptions = options ? LLMOptionsSchema.parse(options) : {}

    // Get the current provider configuration
    const provider = await LLMSettingsReader.read()
    this.currentProvider = provider

    // Create new LLM instance based on provider type
    Logging.log('LangChainProvider', `Creating new LLM for provider: ${provider.name}`, 'info')
    const llm = await this._createLLMFromProvider(provider, parsedOptions)

    // Log metrics about the LLM configuration
    const maxTokens = this._calculateMaxTokens(provider, parsedOptions.maxTokens)
    await Logging.logMetric('llm.created', {
      provider: provider.name,
      provider_type: provider.type,
      model_name: provider.modelId || this._getDefaultModelForProvider(provider.type, options?.intelligence),
      max_tokens: maxTokens,
      temperature: parsedOptions.temperature ?? provider.modelConfig?.temperature ?? DEFAULT_TEMPERATURE,
      intelligence: parsedOptions.intelligence ?? DEFAULT_INTELLIGENCE,
    })

    return llm
  }
  
  // Get model capabilities based on provider
  async getModelCapabilities(): Promise<ModelCapabilities> {
    const provider = await LLMSettingsReader.read()

    // Get image support from provider capabilities or defaults
    const supportsImages = provider.capabilities?.supportsImages ??
                          this._getDefaultImageSupport(provider.type)

    // Get max tokens
    let maxTokens: number

    // Use provider's context window if available
    if (provider.modelConfig?.contextWindow) {
      maxTokens = provider.modelConfig.contextWindow
    } else {
      // Otherwise determine based on provider type and model
      switch (provider.type) {
        case 'browseros':
          // BrowserOS/Nxtscape uses gemini 2.5 flash by default
          maxTokens = 1_000_000
          break

        case 'openai':
        case 'openai_compatible':
        case 'openrouter':
          const modelId = provider.modelId || DEFAULT_OPENAI_MODEL
          if (modelId.includes('gpt-5') || modelId.includes('gpt-6')) {
            maxTokens = 400_000
          } else if (modelId.includes('gpt-4') || modelId.includes('o1') || modelId.includes('o3') || modelId.includes('o4')) {
            maxTokens = 128_000
          } else {
            maxTokens = 32_768
          }
          break

        case 'anthropic':
          const anthropicModel = provider.modelId || DEFAULT_ANTHROPIC_MODEL
          if (anthropicModel.includes('claude-3.7') || anthropicModel.includes('claude-4')) {
            maxTokens = 200_000
          } else {
            maxTokens = 100_000
          }
          break

        case 'google_gemini':
          const geminiModel = provider.modelId || DEFAULT_GEMINI_MODEL
          if (geminiModel.includes('2.5') || geminiModel.includes('2.0')) {
            maxTokens = 1_500_000
          } else {
            maxTokens = 1_000_000
          }
          break

        case 'ollama':
          const ollamaModel = provider.modelId || DEFAULT_OLLAMA_MODEL
          if (ollamaModel.includes('mixtral') || ollamaModel.includes('llama') ||
              ollamaModel.includes('qwen') || ollamaModel.includes('deepseek')) {
            maxTokens = 32_768
          } else {
            maxTokens = 8_192
          }
          break

        case 'custom':
          // Custom providers - conservative default
          maxTokens = 32_768
          break

        default:
          maxTokens = 8_192
      }
    }

    return { maxTokens, supportsImages }
  }

  /**
   * Get a structured LLM that's configured for the current provider
   * Handles provider-specific quirks for structured output
   * @param schema - Zod schema for the structured output
   * @param options - LLM options (temperature, maxTokens, etc.)
   * @returns Runnable configured for structured output
   */
  async getStructuredLLM(schema: z.ZodSchema, options?: LLMOptions): Promise<Runnable> {
    const provider = await LLMSettingsReader.read()
    const llm = await this.getLLM(options)

    // OpenRouter and BrowserOS (which uses OpenRouter) need special handling
    if (provider.type === 'openrouter' || provider.type === 'browseros') {
      // Use json_schema method to properly pass response_format
      // This ensures OpenRouter routes to providers that support structured outputs
      try {
        return llm.withStructuredOutput(schema, {
          method: 'json_schema',
          name: 'structured_output',
          strict: true
        } as any)
      } catch (error) {
        // Fallback to default if json_schema method not supported
        Logging.log('LangChainProvider',
          `${provider.type} json_schema method failed, falling back to default`,
          'warning')
        return llm.withStructuredOutput(schema)
      }
    }

    // Anthropic works well with default structured output
    if (provider.type === 'anthropic') {
      return llm.withStructuredOutput(schema)
    }

    // OpenAI and OpenAI-compatible providers
    if (provider.type === 'openai' || provider.type === 'openai_compatible') {
      return llm.withStructuredOutput(schema)
    }

    // Ollama and other providers - use default
    return llm.withStructuredOutput(schema)
  }

  async getCurrentProviderType(): Promise<string> {
    const provider = await LLMSettingsReader.read()
    return provider.type
  }
  
  getCurrentProvider(): BrowserOSProvider | null {
    return this.currentProvider
  }
  
  clearCache(): void {
    this.currentProvider = null
    this.modelConfigCache = null
  }
  
  private _isReasoningModel(modelId: string): boolean {
    const reasoningModels = ['o1', 'o3', 'o4', 'gpt-5', 'gpt-6']
    return reasoningModels.some(model => modelId.toLowerCase().includes(model))
  }

  private _isO1StyleReasoningModel(modelId: string): boolean {
    const o1Models = ['o1', 'o3', 'o4']
    return o1Models.some(model => modelId.toLowerCase().includes(model))
  }

  private _isGPT5StyleReasoningModel(modelId: string): boolean {
    const gpt5Models = ['gpt-5', 'gpt-6']
    return gpt5Models.some(model => modelId.toLowerCase().includes(model))
  }
  
  private _getDefaultModelForProvider(type: string, intelligence: string  = 'high'): string {
    switch (type) {
      case 'browseros':
        if (this.modelConfigCache) {
          if (intelligence === 'low') {
            return this.modelConfigCache.config.fast
          } else if (intelligence === 'high') {
            return this.modelConfigCache.config.smart
          }
          return this.modelConfigCache.config.default
        }
        return DEFAULT_BROWSEROS_MODEL
      case 'openai':
      case 'openai_compatible':
      case 'openrouter':
      case 'custom':
        return DEFAULT_OPENAI_MODEL
      case 'anthropic':
        return DEFAULT_ANTHROPIC_MODEL
      case 'google_gemini':
        return DEFAULT_GEMINI_MODEL
      case 'ollama':
        return DEFAULT_OLLAMA_MODEL
      default:
        return 'unknown'
    }
  }

  private _getDefaultImageSupport(type: string): boolean {
    switch (type) {
      case 'browseros':
      case 'openai':
      case 'openai_compatible':
      case 'anthropic':
      case 'google_gemini':
      case 'openrouter':
        return true
      case 'ollama':
        // Most Ollama models don't support images by default
        return false
      case 'custom':
        // Conservative default for custom providers
        return false
      default:
        return false
    }
  }
  
  /**
   * Patches token counting methods on any chat model for ultra-fast approximation.
   * This eliminates tiktoken "Unknown model" errors and maximizes performance.
   * Uses bit shift operations for speed: 4 chars ≈ 1 token
   */
  private _patchTokenCounting<T extends BaseChatModel>(model: T): T {
    const _CHARS_PER_TOKEN = 2  // Bit shift for division by 4: x >> 2
    const _MESSAGE_OVERHEAD = 20      // Estimated chars for message structure (role, formatting)
    const _COMPLEX_CONTENT_ESTIMATE = 100  // Rough char estimate for non-string content
    
    // Cast model to any for monkey-patching
    const m = model as any
    
    // Ultra-fast mode: skip counting entirely for maximum performance
    if (LangChainProvider.SKIP_TOKEN_COUNTING) {
      m.getNumTokens = async () => 100 
      m.getNumTokensFromMessages = async () => 5000 
      return model
    }
    
    // Fast approximation for single text strings using bit shift
    m.getNumTokens = async function(text: string): Promise<number> {
      // Add 3 before shift for ceiling division: (x + 3) >> 2 ≈ Math.ceil(x / 4)
      // This is ~2-3x faster than Math.ceil(x / 4)
      return (text.length + 3) >> _CHARS_PER_TOKEN
    }
    
    // Optimized token counting for message arrays
    m.getNumTokensFromMessages = async function(messages: BaseMessage[]): Promise<number> {
      // Pre-calculate total overhead for all messages (faster than per-message addition)
      let totalChars = messages.length * _MESSAGE_OVERHEAD
      
      for (const msg of messages) {
        const content = (msg as any).content
        
        if (typeof content === 'string') {
          totalChars += content.length
          continue  // Skip remaining checks for speed
        }
        
        // Handle complex content without expensive JSON.stringify
        if (Array.isArray(content)) {
          // Use bit shift for multiplication: << 6 is multiply by 64
          // Slightly overestimate to avoid JSON.stringify cost
          totalChars += content.length << 6  
        } else if (content) {
          // Fixed estimate for other content types
          totalChars += _COMPLEX_CONTENT_ESTIMATE
        }
        // Note: Skipping name and additional_kwargs for speed
        // These are rare and have minimal impact on token count
      }
      
      // Use bit shift for final division with ceiling
      return (totalChars + 3) >> _CHARS_PER_TOKEN
    }
    
    return model
  }
  
  /**
   * Calculate appropriate maxTokens based on user request, context window, and defaults
   * @param provider - The LLM provider configuration
   * @param requestedMaxTokens - User-requested max tokens (optional)
   * @returns Calculated max tokens for the response
   */
  private _calculateMaxTokens(
    provider: BrowserOSProvider,
    requestedMaxTokens?: number
  ): number {
    const contextWindow = provider.modelConfig?.contextWindow
    
    if (requestedMaxTokens) {
      // User explicitly requested a limit - respect it but cap at context window
      return contextWindow 
        ? Math.min(requestedMaxTokens, contextWindow)
        : requestedMaxTokens
    } else if (contextWindow) {
      // No explicit request - use reasonable default capped by 50% of context window
      // This leaves room for input and conversation history
      return Math.min(DEFAULT_MAX_TOKENS, Math.floor(contextWindow * 0.5))
    } else {
      // No context window info - use conservative default
      return DEFAULT_MAX_TOKENS
    }
  }
  
  private async _createLLMFromProvider(
    provider: BrowserOSProvider,
    options?: LLMOptions
  ): Promise<BaseChatModel> {
    // Extract parameters from provider config first, then override with options
    const temperature = options?.temperature ??
                       provider.modelConfig?.temperature ??
                       DEFAULT_TEMPERATURE

    const maxTokens = this._calculateMaxTokens(provider, options?.maxTokens)

    const streaming = DEFAULT_STREAMING

    // Map provider type to appropriate LangChain adapter
    switch (provider.type) {
      case 'browseros':
        // Only BrowserOS uses intelligence parameter
        const intelligence = options?.intelligence ?? DEFAULT_INTELLIGENCE
        return await this._createBrowserOSLLM(temperature, maxTokens, streaming, intelligence)

      case 'openai':
      case 'openai_compatible':
      case 'openrouter':
      case 'custom':
        return this._createOpenAICompatibleLLM(provider, temperature, maxTokens, streaming)

      case 'anthropic':
        return this._createAnthropicLLM(provider, temperature, maxTokens, streaming)

      case 'google_gemini':
        return this._createGeminiLLM(provider, temperature, maxTokens)

      case 'ollama':
        return this._createOllamaLLM(provider, temperature, maxTokens)

      default:
        Logging.log('LangChainProvider',
          `Unknown provider type: ${provider.type}, falling back to BrowserOS`,
          'warning')
        const defaultIntelligence = options?.intelligence ?? DEFAULT_INTELLIGENCE
        return await this._createBrowserOSLLM(temperature, maxTokens, streaming, defaultIntelligence)
    }
  }
  
  // Fetch model configuration from BrowserOS API
  private async _fetchModelConfig(): Promise<BrowserOSModelConfig> {
    if (this.modelConfigCache) {
      const cacheAge = Date.now() - this.modelConfigCache.timestamp
      if (cacheAge < this.CACHE_DURATION_MS) {
        return this.modelConfigCache.config
      }
    }

    try {
      const response = await fetch(DEFAULT_BROWSEROS_MODEL_FAMILY_URL)
      if (response.ok) {
        const data = await response.json()

        // Ensure all fields are present with fallbacks
        const config: BrowserOSModelConfig = {
          default: data.default || data.model_family || DEFAULT_BROWSEROS_MODEL,
          fast: data.fast || data.model_family || DEFAULT_BROWSEROS_MODEL,
          smart: data.smart || data.model_family || DEFAULT_BROWSEROS_MODEL
        }

        // Cache the result
        this.modelConfigCache = { config, timestamp: Date.now() }
        Logging.log('LangChainProvider',
          `BrowserOS model config fetched - default: ${config.default}, fast: ${config.fast}, smart: ${config.smart}`,
          'info')
        return config
      }
    } catch (error) {
      Logging.log('LangChainProvider',
        `Failed to fetch model config, using fallbacks: ${error}`,
        'warning')
    }

    // Default fallback configuration
    const fallbackConfig: BrowserOSModelConfig = {
      default: DEFAULT_BROWSEROS_MODEL,
      fast: DEFAULT_BROWSEROS_MODEL,
      smart: DEFAULT_BROWSEROS_MODEL
    }
    return fallbackConfig
  }

  // BrowserOS built-in provider (uses proxy, no API key needed)
  private async _createBrowserOSLLM(
    temperature: number,
    maxTokens?: number,
    streaming: boolean = true,
    intelligence: 'low' | 'high' = DEFAULT_INTELLIGENCE
  ): Promise<BaseChatModel> {
    // Fetch the complete model configuration
    const modelConfig = await this._fetchModelConfig()

    let selectedProvider: string
    let proxyUrl: string

    if (intelligence === 'low') {
      selectedProvider = modelConfig.fast
      proxyUrl = BROWSEROS_FAST_LLM_PROXY_URL
    } else {
      // Default to 'high' intelligence (smart provider)
      selectedProvider = modelConfig.smart
      proxyUrl = BROWSEROS_SMART_LLM_PROXY_URL
    }

    let model: BaseChatModel

    // OpenRouter (used by BrowserOS) provides OpenAI-compatible API
    // Always use ChatOpenAI, even for Claude models
    // ChatAnthropic would send Anthropic-specific parameters (system, thinking, top_k)
    // that OpenRouter doesn't recognize

    // Check if it's a reasoning model that needs special handling
    const isReasoningModel = this._isReasoningModel(selectedProvider)

    const config: any = {
      modelName: selectedProvider,
      temperature: isReasoningModel ? 1 : temperature,  // Reasoning models use temperature 1
      topP: isReasoningModel ? undefined : 1,  // Reasoning models don't support topP
      streaming,
      openAIApiKey: 'nokey',
      configuration: {
        baseURL: proxyUrl,
        apiKey: 'nokey',
        dangerouslyAllowBrowser: true
      }
    }

    // For reasoning models, use appropriate token parameter
    if (isReasoningModel && maxTokens) {
      if (this._isO1StyleReasoningModel(selectedProvider)) {
        config.modelKwargs = {
          max_completion_tokens: maxTokens
        }
      } else if (this._isGPT5StyleReasoningModel(selectedProvider)) {
        // GPT-5: No token limit until API schema is officially released
      }
    } else if (maxTokens) {
      config.maxTokens = maxTokens
    }

    model = new ChatOpenAI(config)

    return this._patchTokenCounting(model)
  }
  
  // OpenAI-compatible providers (OpenAI, OpenAI-compatible, OpenRouter, Custom)
  private _createOpenAICompatibleLLM(
    provider: BrowserOSProvider,
    temperature: number,
    maxTokens?: number,
    streaming: boolean = true
  ): ChatOpenAI {
    if (!provider.apiKey && provider.type !== 'custom') {
      Logging.log('LangChainProvider',
        `Warning: No API key for ${provider.name} provider, using default`,
        'warning')
    }

    const modelId = provider.modelId || DEFAULT_OPENAI_MODEL

    const isReasoningModel = this._isReasoningModel(modelId)

    const config: any = {
      modelName: modelId,
      streaming,
      openAIApiKey: provider.apiKey || 'nokey',
      configuration: {
        baseURL: provider.baseUrl || 'https://api.openai.com/v1',
        apiKey: provider.apiKey || 'nokey',
        dangerouslyAllowBrowser: true
      }
    }

    if (isReasoningModel) {
      config.temperature = 1
      if (maxTokens) {
        if (this._isO1StyleReasoningModel(modelId)) {
          config.modelKwargs = {
            max_completion_tokens: maxTokens
          }
        } else if (this._isGPT5StyleReasoningModel(modelId)) {
          // GPT-5: No token limit until API schema is officially released
          // When available, this should use: max_output_tokens
        }
      }
    } else {
      config.temperature = temperature
      config.topP = 1
      if (maxTokens) {
        config.maxTokens = maxTokens
      }
    }

    const model = new ChatOpenAI(config)
    return this._patchTokenCounting(model)
  }
  
  // Anthropic provider
  private _createAnthropicLLM(
    provider: BrowserOSProvider,
    temperature: number,
    maxTokens?: number,
    streaming: boolean = true
  ): ChatAnthropic {
    if (!provider.apiKey) {
      throw new Error(`API key required for ${provider.name} provider`)
    }

    const modelId = provider.modelId || DEFAULT_ANTHROPIC_MODEL

    const model = new ChatAnthropic({
      modelName: modelId,
      temperature,
      maxTokens,
      streaming,
      anthropicApiKey: provider.apiKey,
      anthropicApiUrl: provider.baseUrl || 'https://api.anthropic.com'
    })

    // Force topP to undefined to avoid -1 default conflicting with temperature on Claude 4.5 models
    model.topP = undefined

    return this._patchTokenCounting(model)
  }
  
  // Google Gemini provider
  private _createGeminiLLM(
    provider: BrowserOSProvider,
    temperature: number,
    maxTokens?: number
  ): ChatGoogleGenerativeAI {
    if (!provider.apiKey) {
      throw new Error(`API key required for ${provider.name} provider`)
    }

    const modelId = provider.modelId || DEFAULT_GEMINI_MODEL

    const model = new ChatGoogleGenerativeAI({
      model: modelId,
      temperature,
      maxOutputTokens: maxTokens,
      apiKey: provider.apiKey,
      convertSystemMessageToHumanContent: true,
      baseUrl: provider.baseUrl || 'https://generativelanguage.googleapis.com'
    })

    return this._patchTokenCounting(model)
  }
  
  // Ollama provider (local, no API key required)
  private _createOllamaLLM(
    provider: BrowserOSProvider,
    temperature: number,
    maxTokens?: number
  ): ChatOllama {
    // Ensure we use 127.0.0.1 instead of localhost for better compatibility
    // TODO: move this to C++ patch
    let baseUrl = provider.baseUrl || DEFAULT_OLLAMA_BASE_URL
    if (baseUrl.includes('localhost')) {
      baseUrl = baseUrl.replace('localhost', '127.0.0.1')
      Logging.log('LangChainProvider',
        'Replaced "localhost" with "127.0.0.1" in Ollama URL for better compatibility',
        'info')
    }

    const modelId = provider.modelId || DEFAULT_OLLAMA_MODEL

    const ollamaConfig: any = {
      model: modelId,
      temperature,
      maxRetries: 2,
      baseUrl
    }

    // Add context window if specified in provider config
    if (provider.modelConfig?.contextWindow) {
      ollamaConfig.numCtx = provider.modelConfig.contextWindow
    }

    const model = new ChatOllama(ollamaConfig)

    return this._patchTokenCounting(model)
  }
}

// Export singleton instance for easy access
export const langChainProvider = LangChainProvider.getInstance()

// Convenience function for quick access
export async function getLLM(options?: LLMOptions): Promise<BaseChatModel> {
  return langChainProvider.getLLM(options)
}

// Convenience function for getting structured LLM
export async function getStructuredLLM(schema: z.ZodSchema, options?: LLMOptions): Promise<Runnable> {
  return langChainProvider.getStructuredLLM(schema, options)
}
