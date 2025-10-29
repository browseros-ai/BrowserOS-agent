import { z } from 'zod'

// Provider type enum
export const ProviderTypeSchema = z.enum([
  'openai',
  'anthropic',
  'google_gemini',
  'ollama',
  'openrouter',
  'openai_compatible',
  'browseros',
  'custom'
])

// Model configuration for a provider (matching BrowserOS schema)
export const ModelConfigSchema = z.object({
  contextWindow: z.union([z.number(), z.string()]).transform(val => {
    return typeof val === 'string' ? parseInt(val, 10) : val
  }).optional(),  // Maximum context window size
  temperature: z.union([z.number(), z.string()]).transform(val => {
    return typeof val === 'string' ? parseFloat(val) : val
  }).pipe(z.number().min(0).max(2)).optional()  // Default temperature setting
})

// LLM Provider schema (matching BrowserOS schema)
export const LLMProviderSchema = z.object({
  id: z.string(),  // Unique identifier for the provider
  name: z.string().min(1),  // Display name of the provider
  type: ProviderTypeSchema,  // Provider type
  isDefault: z.boolean().default(false),  // Whether this is the default provider
  isBuiltIn: z.boolean().default(false),  // Whether this is a built-in provider
  baseUrl: z.string().optional(),  // API base URL
  apiKey: z.string().optional(),  // API key for authentication
  modelId: z.string().optional(),  // Model identifier (e.g., 'gpt-4', 'claude-3-sonnet')
  capabilities: z.object({
    supportsImages: z.boolean().optional()  // Whether the provider supports image inputs
  }).optional(),  // Provider capabilities
  modelConfig: ModelConfigSchema.optional(),  // Model configuration
  createdAt: z.string(),  // Creation timestamp
  updatedAt: z.string()  // Last update timestamp
})

// Configured Model schema
export const ConfiguredModelSchema = z.object({
  id: z.string().uuid(),  // Unique identifier for the model
  providerId: z.string().uuid(),  // Reference to the provider
  name: z.string().min(1),  // Display name of the model
  modelId: z.string().min(1),  // Model identifier (e.g., 'gpt-4', 'claude-3-sonnet')
  providerType: ProviderTypeSchema,  // Provider type for quick reference
  isBuiltIn: z.boolean().default(false),  // Whether this is a built-in model
  config: z.object({
    temperature: z.number().min(0).max(2).default(0.7),  // Temperature setting
    maxTokens: z.number().int().positive().optional(),  // Maximum tokens for responses
    contextWindow: z.number().int().positive().optional(),  // Context window size
    topP: z.number().min(0).max(1).optional(),  // Top-p sampling parameter
    frequencyPenalty: z.number().min(-2).max(2).optional(),  // Frequency penalty
    presencePenalty: z.number().min(-2).max(2).optional()  // Presence penalty
  }).optional(),
  iconColor: z.string().optional(),  // Color for the model icon
  iconLetter: z.string().max(2).optional(),  // Letter(s) to display in the icon
  createdAt: z.string().datetime(),  // Creation timestamp
  updatedAt: z.string().datetime()  // Last update timestamp
})


// Provider Template schema
export const ProviderTemplateSchema = z.object({
  type: ProviderTypeSchema,  // Provider type
  name: z.string(),  // Display name
  abbreviation: z.string().max(2),  // Short abbreviation for icon
  iconColor: z.string(),  // Icon background color
  defaultConfig: z.object({
    baseUrl: z.string().optional(),  // Default base URL
    modelId: z.string().optional(),  // Default model ID
    contextWindow: z.number().optional(),  // Default context window
    supportsImages: z.boolean().optional()  // Whether it supports images
  })
})

// Test Result schema
export const TestResultSchema = z.object({
  status: z.enum(['idle', 'loading', 'success', 'error']),
  error: z.string().optional(),
  responseTime: z.number().optional(),
  response: z.string().optional(),  // AI response message from test
  timestamp: z.string()
})

// Infer TypeScript types from schemas
export type ProviderType = z.infer<typeof ProviderTypeSchema>
export type LLMProvider = z.infer<typeof LLMProviderSchema>
export type ConfiguredModel = z.infer<typeof ConfiguredModelSchema>
export type ProviderTemplate = z.infer<typeof ProviderTemplateSchema>
export type TestResult = z.infer<typeof TestResultSchema>