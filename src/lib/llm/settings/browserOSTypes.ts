import { z } from 'zod'

/**
 * BrowserOS Provider type enum
 */
export const BrowserOSProviderTypeSchema = z.enum([
  'browseros',
  'openai',
  'openai_compatible',
  'anthropic',
  'google_gemini',
  'ollama',
  'openrouter',
  'custom'
])
export type BrowserOSProviderType = z.infer<typeof BrowserOSProviderTypeSchema>

/**
 * Provider capabilities configuration
 */
export const ProviderCapabilitiesSchema = z.object({
  supportsImages: z.boolean().optional()  // Whether the provider supports image inputs
})

/**
 * Model configuration for a provider
 */
export const ModelConfigSchema = z.object({
  contextWindow: z.union([z.number(), z.string()]).transform(val => {
    // Convert string to number if needed (from Chrome settings UI)
    return typeof val === 'string' ? parseInt(val, 10) : val
  }).optional(),  // Maximum context window size
  temperature: z.union([z.number(), z.string()]).transform(val => {
    // Convert string to number if needed (from Chrome settings UI)
    return typeof val === 'string' ? parseFloat(val) : val
  }).pipe(z.number().min(0).max(2)).optional()  // Default temperature setting
})

/**
 * Individual provider configuration from BrowserOS
 */
export const BrowserOSProviderSchema = z.object({
  id: z.string(),  // Unique provider identifier
  name: z.string(),  // Display name for the provider
  type: BrowserOSProviderTypeSchema,  // Provider type
  isDefault: z.boolean(),  // Whether this is the default provider
  isBuiltIn: z.boolean(),  // Whether this is a built-in provider
  baseUrl: z.string().optional(),  // API base URL
  apiKey: z.string().optional(),  // API key for authentication
  modelId: z.string().optional(),  // Model identifier
  capabilities: ProviderCapabilitiesSchema.optional(),  // Provider capabilities
  modelConfig: ModelConfigSchema.optional(),  // Model configuration
  createdAt: z.string(),  // ISO timestamp of creation
  updatedAt: z.string()  // ISO timestamp of last update
})

export type BrowserOSProvider = z.infer<typeof BrowserOSProviderSchema>

/**
 * Complete BrowserOS providers configuration
 */
export const BrowserOSProvidersConfigSchema = z.object({
  defaultProviderId: z.string(),  // ID of the default provider
  providers: z.array(BrowserOSProviderSchema)  // List of all providers
})

export type BrowserOSProvidersConfig = z.infer<typeof BrowserOSProvidersConfigSchema>

/**
 * Preference object returned by chrome.browserOS.getPref
 */
export const BrowserOSPrefObjectSchema = z.object({
  key: z.string(),  // Preference key
  type: z.string(),  // Preference type
  value: z.any()  // Preference value (string for JSON preferences)
})

export type BrowserOSPrefObject = z.infer<typeof BrowserOSPrefObjectSchema>

/**
 * Browser preference keys for BrowserOS
 */
export const BROWSEROS_PREFERENCE_KEYS = {
  PROVIDERS: 'browseros.providers'
} as const