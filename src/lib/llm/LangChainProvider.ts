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
import { LLMSettingsReader } from "@/lib/llm/settings/LLMSettingsReader"
import { BrowserOSProvider } from '@/lib/llm/settings/browserOSTypes'
import { Logging } from '@/lib/utils/Logging'

// Default constants
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_STREAMING = true
const DEFAULT_MAX_TOKENS = 128000
const DEFAULT_OPENAI_MODEL = "gpt-4o"
const DEFAULT_ANTHROPIC_MODEL = 'claude-4-sonnet'
const DEFAULT_OLLAMA_MODEL = "qwen3:4b"
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434"
const DEFAULT_NXTSCAPE_PROXY_URL = "http://llm.nxtscape.ai"
const DEFAULT_NXTSCAPE_MODEL = "default-llm"
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"

// Simple cache for LLM instances
const llmCache = new Map<string, BaseChatModel>()

// Model capabilities interface
export interface ModelCapabilities {
  maxTokens: number;  // Maximum context window size
}

export class LangChainProvider {
  private static instance: LangChainProvider
  private currentProvider: BrowserOSProvider | null = null
  
  // Constructor and initialization
  static getInstance(): LangChainProvider {
    if (!LangChainProvider.instance) {
      LangChainProvider.instance = new LangChainProvider()
    }
    return LangChainProvider.instance
  }
  
  // Public getter methods
  async getLLM(options?: { temperature?: number; maxTokens?: number }): Promise<BaseChatModel> {
    // Get the current provider configuration
    const provider = await LLMSettingsReader.read()
    this.currentProvider = provider
    
    // Check cache
    const cacheKey = this._getCacheKey(provider, options)
    if (llmCache.has(cacheKey)) {
      Logging.log('LangChainProvider', `Using cached LLM for provider: ${provider.name}`, 'info')
      return llmCache.get(cacheKey)!
    }
    
    // Create new LLM instance based on provider type
    Logging.log('LangChainProvider', `Creating new LLM for provider: ${provider.name}`, 'info')
    const llm = this._createLLMFromProvider(provider, options)
    llmCache.set(cacheKey, llm)
    
    return llm
  }
  
  // Get model capabilities based on provider
  async getModelCapabilities(): Promise<ModelCapabilities> {
    const provider = await LLMSettingsReader.read()
    
    // Use provider's context window if available
    if (provider.modelConfig?.contextWindow) {
      return { maxTokens: provider.modelConfig.contextWindow }
    }
    
    // Otherwise determine based on provider type and model
    switch (provider.type) {
      case 'browseros':
        // BrowserOS/Nxtscape uses various models through proxy
        return { maxTokens: 1_000_000 }
        
      case 'openai_compatible':
      case 'openrouter':
        // Check model name for context window size
        const modelId = provider.modelId || DEFAULT_OPENAI_MODEL
        if (modelId.includes('gpt-4') || modelId.includes('o1') || modelId.includes('o3') || modelId.includes('o4')) {
          return { maxTokens: 128_000 }
        }
        return { maxTokens: 32_768 }
        
      case 'anthropic':
        // Claude models
        const anthropicModel = provider.modelId || DEFAULT_ANTHROPIC_MODEL
        if (anthropicModel.includes('claude-3.7') || anthropicModel.includes('claude-4')) {
          return { maxTokens: 200_000 }
        }
        return { maxTokens: 100_000 }
        
      case 'google_gemini':
        // Gemini models
        const geminiModel = provider.modelId || DEFAULT_GEMINI_MODEL
        if (geminiModel.includes('2.5') || geminiModel.includes('2.0')) {
          return { maxTokens: 1_500_000 }
        }
        return { maxTokens: 1_000_000 }
        
      case 'ollama':
        // Ollama models vary widely
        const ollamaModel = provider.modelId || DEFAULT_OLLAMA_MODEL
        if (ollamaModel.includes('mixtral') || ollamaModel.includes('llama') || 
            ollamaModel.includes('qwen') || ollamaModel.includes('deepseek')) {
          return { maxTokens: 32_768 }
        }
        return { maxTokens: 8_192 }
        
      case 'custom':
        // Custom providers - conservative default
        return { maxTokens: 32_768 }
        
      default:
        return { maxTokens: 8_192 }
    }
  }
  
  // Get current provider info (useful for debugging)
  getCurrentProvider(): BrowserOSProvider | null {
    return this.currentProvider
  }
  
  // Public action methods
  clearCache(): void {
    llmCache.clear()
    this.currentProvider = null
  }
  
  // Private helper methods
  private _createLLMFromProvider(
    provider: BrowserOSProvider,
    options?: { temperature?: number; maxTokens?: number }
  ): BaseChatModel {
    // Extract parameters from provider config first, then override with options
    const temperature = options?.temperature ?? 
                       provider.modelConfig?.temperature ?? 
                       DEFAULT_TEMPERATURE
    
    const maxTokens = options?.maxTokens ?? 
                     (provider.modelConfig?.contextWindow ? 
                       provider.modelConfig.contextWindow : DEFAULT_MAX_TOKENS)
    
    const streaming = DEFAULT_STREAMING
    
    // Map provider type to appropriate LangChain adapter
    switch (provider.type) {
      case 'browseros':
        return this._createBrowserOSLLM(temperature, maxTokens, streaming)
      
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
        return this._createBrowserOSLLM(temperature, maxTokens, streaming)
    }
  }
  
  // BrowserOS built-in provider (uses proxy, no API key needed)
  private _createBrowserOSLLM(
    temperature: number, 
    maxTokens?: number, 
    streaming: boolean = true
  ): ChatOpenAI {
    return new ChatOpenAI({
      // IMPORTANT: Model name mapping for tiktoken compatibility
      // The 'modelName' field is what gets sent to the API (our custom model like "default-llm")
      // The 'model' field is what tiktoken uses for token counting
      // 
      // Since nxtscape uses custom model names that tiktoken doesn't recognize (e.g., "default-llm"),
      // we get "Unknown model" errors when LangChain tries to count tokens.
      // 
      // Solution: We keep the actual model name in 'modelName' for API calls,
      // but override 'model' with a known OpenAI model for token counting.
      // This eliminates the tiktoken errors while maintaining correct API behavior.
      // 
      // Note: "gpt-4o" is chosen because:
      // 1. It uses the cl100k_base encoding (same as GPT-3.5-turbo and GPT-4 family)
      // 2. It has a large context window (128k) similar to our proxy models
      // 3. Token counting will be approximate but reasonable for our use case
      modelName: DEFAULT_NXTSCAPE_MODEL,
      model: "gpt-4o",  // Known model for tiktoken token counting
      temperature,
      maxTokens,
      streaming,
      openAIApiKey: process.env.LITELLM_API_KEY || 'nokey',
      configuration: {
        baseURL: DEFAULT_NXTSCAPE_PROXY_URL,
        apiKey: process.env.LITELLM_API_KEY || 'nokey',
        dangerouslyAllowBrowser: true
      }
    })
  }
  
  // OpenAI-compatible providers (OpenAI, OpenRouter, Custom)
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
    
    return new ChatOpenAI({
      modelName: provider.modelId || DEFAULT_OPENAI_MODEL,
      temperature,
      maxTokens,
      streaming,
      openAIApiKey: provider.apiKey || 'nokey',
      configuration: {
        baseURL: provider.baseUrl || 'https://api.openai.com/v1',
        apiKey: provider.apiKey || 'nokey',
        dangerouslyAllowBrowser: true
      }
    })
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
    
    return new ChatAnthropic({
      modelName: provider.modelId || DEFAULT_ANTHROPIC_MODEL,
      temperature,
      maxTokens,
      streaming,
      anthropicApiKey: provider.apiKey,
      anthropicApiUrl: provider.baseUrl || 'https://api.anthropic.com'
    })
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
    
    return new ChatGoogleGenerativeAI({
      model: provider.modelId || DEFAULT_GEMINI_MODEL,
      temperature,
      maxOutputTokens: maxTokens,
      apiKey: provider.apiKey,
      convertSystemMessageToHumanContent: true
    })
  }
  
  // Ollama provider (local, no API key required)
  private _createOllamaLLM(
    provider: BrowserOSProvider,
    temperature: number,
    maxTokens?: number
  ): ChatOllama {
    const ollamaConfig: any = {
      model: provider.modelId || DEFAULT_OLLAMA_MODEL,
      temperature,
      maxRetries: 2,
      baseUrl: provider.baseUrl || DEFAULT_OLLAMA_BASE_URL
    }
    
    // Add context window if specified in provider config
    if (provider.modelConfig?.contextWindow) {
      ollamaConfig.numCtx = provider.modelConfig.contextWindow
    }
    
    return new ChatOllama(ollamaConfig)
  }
  
  // Cache key includes all relevant provider settings and options
  private _getCacheKey(
    provider: BrowserOSProvider, 
    options?: { temperature?: number; maxTokens?: number }
  ): string {
    // Create a deterministic string from all cache-relevant values
    // Using string concatenation is faster than JSON.stringify for simple cases
    const keyParts = [
      provider.id,
      provider.type,
      provider.modelId || 'd',
      provider.baseUrl || 'd',
      provider.apiKey ? provider.apiKey.slice(-8) : 'n',  // Last 8 chars of API key
      provider.modelConfig?.temperature?.toString() || 'd',
      provider.modelConfig?.contextWindow?.toString() || 'd',
      options?.temperature?.toString() || 'd',
      options?.maxTokens?.toString() || 'd',
      provider.updatedAt  // Include update timestamp to invalidate cache on provider changes
    ]
    
    // Use FNV-1a hash (very fast, good distribution for short strings)
    const str = keyParts.join('|')
    let hash = 2166136261  // FNV offset basis
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i)
      hash = (hash * 16777619) >>> 0  // FNV prime, keep as 32-bit unsigned
    }
    
    // Return provider ID with hash for readability (base36 is compact)
    return `${provider.id}-${hash.toString(36)}`
  }
}

// Export singleton instance for easy access
export const langChainProvider = LangChainProvider.getInstance()

// Convenience function for quick access
export async function getLLM(options?: { temperature?: number; maxTokens?: number }): Promise<BaseChatModel> {
  return langChainProvider.getLLM(options)
}