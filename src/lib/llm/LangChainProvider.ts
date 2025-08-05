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
import { z } from "zod"
import { ChatOpenAI } from "@langchain/openai"
import { ChatAnthropic } from "@langchain/anthropic"
import { ChatOllama } from "@langchain/ollama"
import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { LLMSettingsReader } from "@/lib/llm/settings/LLMSettingsReader"
import type { LLMSettings } from '@/lib/llm/settings/types'

// Default constants
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_STREAMING = true
const DEFAULT_OPENAI_MODEL = "gpt-4o"
const DEFAULT_ANTHROPIC_MODEL = 'claude-4-sonnet'
const DEFAULT_OLLAMA_MODEL = "qwen3:4b"
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434"
const DEFAULT_NXTSCAPE_PROXY_URL = "http://llm.nxtscape.ai"
const DEFAULT_NXTSCAPE_MODEL = "default-llm"
const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"

// Simple cache for LLM instances
const llmCache = new Map<string, BaseChatModel>()

// Configuration schema for creating LLMs
export const LLMConfigSchema = z.object({
  provider: z.enum(["openai", "anthropic", "ollama", "nxtscape", "gemini"]),
  model: z.string(),
  temperature: z.number().default(DEFAULT_TEMPERATURE),
  maxTokens: z.number().optional(),
  streaming: z.boolean().default(DEFAULT_STREAMING),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
})

export type LLMConfig = z.infer<typeof LLMConfigSchema>

export class LangChainProvider {
  private static instance: LangChainProvider
  private settings: LLMSettings | null = null
  
  // Constructor and initialization
  static getInstance(): LangChainProvider {
    if (!LangChainProvider.instance) {
      LangChainProvider.instance = new LangChainProvider()
    }
    return LangChainProvider.instance
  }
  
  // Public getter methods
  async getLLM(options?: { temperature?: number; maxTokens?: number }): Promise<BaseChatModel> {
    // Load settings if not already loaded
    this.settings = await LLMSettingsReader.read()
    
    // Create config from settings
    const config = this._createConfigFromSettings(this.settings, options)
    
    // Check cache
    const cacheKey = this._getCacheKey(config)
    if (llmCache.has(cacheKey)) {
      return llmCache.get(cacheKey)!
    }
    
    // Create new LLM instance
    const llm = this._createLLM(config)
    llmCache.set(cacheKey, llm)
    
    return llm
  }
  
  // Public creator methods
  createLLMFromConfig(config: LLMConfig): BaseChatModel {
    const cacheKey = this._getCacheKey(config)
    if (llmCache.has(cacheKey)) {
      return llmCache.get(cacheKey)!
    }
    
    const llm = this._createLLM(config)
    llmCache.set(cacheKey, llm)
    
    return llm
  }
  
  // Public action methods
  clearCache(): void {
    llmCache.clear()
    this.settings = null
  }
  
  // Private helper methods
  private _createConfigFromSettings(
    settings: LLMSettings,
    options?: { temperature?: number; maxTokens?: number }
  ): LLMConfig {
    const provider = settings.defaultProvider
    
    switch (provider) {
      case "nxtscape":
        // Nxtscape uses OpenAI provider with proxy
        return {
          provider: "nxtscape",
          model: settings.nxtscape?.model || DEFAULT_NXTSCAPE_MODEL,
          temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
          maxTokens: options?.maxTokens,
          streaming: DEFAULT_STREAMING,
          // Use environment variables for proxy
          apiKey: process.env.LITELLM_API_KEY || 'nokey',
          baseURL: DEFAULT_NXTSCAPE_PROXY_URL,
        }
        
      case "openai":
        return {
          provider: "openai",
          model: settings.openai?.model || DEFAULT_OPENAI_MODEL,
          temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
          maxTokens: options?.maxTokens,
          streaming: DEFAULT_STREAMING,
          apiKey: settings.openai?.apiKey || process.env.OPENAI_API_KEY,
          baseURL: settings.openai?.baseUrl,
        }
        
      case "anthropic":
        return {
          provider: "anthropic",
          model: settings.anthropic?.model || DEFAULT_ANTHROPIC_MODEL,
          temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
          maxTokens: options?.maxTokens,
          streaming: DEFAULT_STREAMING,
          apiKey: settings.anthropic?.apiKey || process.env.ANTHROPIC_API_KEY,
          baseURL: settings.anthropic?.baseUrl,
        }
        
      case "ollama":
        return {
          provider: "ollama",
          model: settings.ollama?.model || DEFAULT_OLLAMA_MODEL,
          temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
          maxTokens: options?.maxTokens,
          streaming: DEFAULT_STREAMING,
          baseURL: settings.ollama?.baseUrl || DEFAULT_OLLAMA_BASE_URL,
        }
        
      case "gemini":
        return {
          provider: "gemini",
          model: settings.gemini?.model || DEFAULT_GEMINI_MODEL,
          temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
          maxTokens: options?.maxTokens,
          streaming: DEFAULT_STREAMING,
          apiKey: settings.gemini?.apiKey || process.env.GOOGLE_API_KEY,
        }
        
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }
  
  private _createLLM(config: LLMConfig): BaseChatModel {
    const baseConfig = {
      modelName: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      streaming: config.streaming,
    }
    
    switch (config.provider) {
      case "nxtscape":
        // Nxtscape uses OpenAI client with proxy configuration
        return new ChatOpenAI({
          ...baseConfig,
          openAIApiKey: config.apiKey,  // This is the correct parameter name
          // The `configuration` field is forwarded directly to the underlying OpenAI client
          configuration: {
            baseURL: config.baseURL,
            apiKey: config.apiKey,  // Still required by OpenAI client constructor
            dangerouslyAllowBrowser: true
          }
        })
      
      case "openai":
        return new ChatOpenAI({
          ...baseConfig,
          openAIApiKey: config.apiKey,
          configuration: config.baseURL ? { 
            baseURL: config.baseURL,
            dangerouslyAllowBrowser: true
          } : {
            dangerouslyAllowBrowser: true
          },
        })
        
      case "anthropic":
        return new ChatAnthropic({
          ...baseConfig,
          anthropicApiKey: config.apiKey,
          anthropicApiUrl: config.baseURL,
        })
        
      case "ollama":
        return new ChatOllama({
          model: config.model,
          temperature: config.temperature,
          maxRetries: 2,
          baseUrl: config.baseURL,
        })
        
      case "gemini":
        return new ChatGoogleGenerativeAI({
          model: config.model,
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens,
          apiKey: config.apiKey,
          convertSystemMessageToHumanContent: true,  // Convert system messages for models that don't support them
        })
        
      default:
        throw new Error(`Unsupported provider: ${config.provider}`)
    }
  }
  
  private _getCacheKey(config: LLMConfig): string {
    return `${config.provider}-${config.model}-${config.temperature}-${config.maxTokens || 'default'}`
  }
}

// Export singleton instance for easy access
export const langChainProvider = LangChainProvider.getInstance()

// Convenience function for quick access
export async function getLLM(options?: { temperature?: number; maxTokens?: number }): Promise<BaseChatModel> {
  return langChainProvider.getLLM(options)
}
