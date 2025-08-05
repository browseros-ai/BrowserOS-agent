import { z } from 'zod'

/**
 * Provider type enum
 */
export const ProviderTypeSchema = z.enum(['nxtscape', 'openai', 'anthropic', 'gemini', 'ollama', 'lmstudio', 'openrouter'])
export type ProviderType = z.infer<typeof ProviderTypeSchema>

/**
 * Nxtscape provider settings schema
 */
export const NxtscapeSettingsSchema = z.object({
  model: z.string().optional()  // Model selection for Nxtscape proxy
})

/**
 * OpenAI provider settings schema
 */
export const OpenAISettingsSchema = z.object({
  apiKey: z.string().optional(),  // User's OpenAI API key
  model: z.string().optional(),   // Model selection
  baseUrl: z.string().optional()  // Custom base URL override
})

/**
 * Anthropic provider settings schema
 */
export const AnthropicSettingsSchema = z.object({
  apiKey: z.string().optional(),  // User's Anthropic API key
  model: z.string().optional(),   // Model selection
  baseUrl: z.string().optional()  // Custom base URL override
})

/**
 * Gemini provider settings schema
 */
export const GeminiSettingsSchema = z.object({
  apiKey: z.string().optional(),  // User's Google AI API key
  model: z.string().optional(),   // Model selection
  baseUrl: z.string().optional()  // Custom base URL override
})

/**
 * Ollama provider settings schema
 */
export const OllamaSettingsSchema = z.object({
  apiKey: z.string().optional(),  // Optional API key for secured instances
  baseUrl: z.string().optional(), // Ollama server URL
  model: z.string().optional()    // Model selection
})

/**
 * LMStudio provider settings schema
 */
export const LMStudioSettingsSchema = z.object({
  baseUrl: z.string().optional(),  // LMStudio local server URL
  model: z.string().optional()     // Local model name to use
})

/**
 * OpenRouter provider settings schema
 */
export const OpenRouterSettingsSchema = z.object({
  apiKey: z.string().optional(),   // OpenRouter API key 
  baseUrl: z.string().optional(),  // OpenRouter API endpoint
  model: z.string().optional()     // Model selection
})

/**
 * Complete LLM settings schema
 */
export const LLMSettingsSchema = z.object({
  defaultProvider: ProviderTypeSchema,  // Selected provider
  nxtscape: NxtscapeSettingsSchema,     // Nxtscape provider settings
  openai: OpenAISettingsSchema,         // OpenAI provider settings
  anthropic: AnthropicSettingsSchema,   // Anthropic provider settings
  gemini: GeminiSettingsSchema,         // Gemini provider settings
  ollama: OllamaSettingsSchema,         // Ollama provider settings
  lmstudio: LMStudioSettingsSchema,     // LMStudio provider settings
  openrouter: OpenRouterSettingsSchema  // OpenRouter provider settings
})

export type LLMSettings = z.infer<typeof LLMSettingsSchema>

/**
 * Resolved provider configuration after processing settings
 */
export const ResolvedProviderConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini', 'ollama']),  // Actual LangChain provider
  model: z.string(),                                              // Model to use
  apiKey: z.string().optional(),                                  // API key if needed
  baseUrl: z.string().url().optional(),                           // Base URL for API calls
  useProxy: z.boolean(),                                          // Whether to use Nxtscape proxy
  temperature: z.number().min(0).max(2).optional()                // Temperature setting
})

export type ResolvedProviderConfig = z.infer<typeof ResolvedProviderConfigSchema>

/**
 * Browser preference keys
 */
export const PREFERENCE_KEYS = {
  DEFAULT_PROVIDER: 'nxtscape.default_provider',
  NXTSCAPE_MODEL: 'nxtscape.nxtscape_model',
  OPENAI_API_KEY: 'nxtscape.openai_api_key',
  OPENAI_MODEL: 'nxtscape.openai_model',
  OPENAI_BASE_URL: 'nxtscape.openai_base_url',
  ANTHROPIC_API_KEY: 'nxtscape.anthropic_api_key',
  ANTHROPIC_MODEL: 'nxtscape.anthropic_model',
  ANTHROPIC_BASE_URL: 'nxtscape.anthropic_base_url',
  GEMINI_API_KEY: 'nxtscape.gemini_api_key',
  GEMINI_MODEL: 'nxtscape.gemini_model',
  GEMINI_BASE_URL: 'nxtscape.gemini_base_url',
  OLLAMA_API_KEY: 'nxtscape.ollama_api_key',
  OLLAMA_BASE_URL: 'nxtscape.ollama_base_url',
  OLLAMA_MODEL: 'nxtscape.ollama_model',
  LMSTUDIO_BASE_URL: 'nxtscape.lmstudio_base_url',
  LMSTUDIO_MODEL: 'nxtscape.lmstudio_model',
  OPENROUTER_API_KEY: 'nxtscape.openrouter_api_key',
  OPENROUTER_BASE_URL: 'nxtscape.openrouter_base_url',
  OPENROUTER_MODEL: 'nxtscape.openrouter_model'
} as const 