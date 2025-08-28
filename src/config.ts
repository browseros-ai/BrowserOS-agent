import { z } from 'zod'

/**
 * Application configuration schema
 */
export const AppConfigSchema = z.object({
  DEV_MODE: z.boolean(),  // Enable development features like enhanced logging
  MOCK_LLM_SETTINGS: z.boolean(),  // Enable mock LLM settings for development
  ENABLE_NARRATOR: z.boolean(),  // Enable narrator service for human-friendly messages
  VERSION: z.string(),  // Application version
  LOG_LEVEL: z.enum(['info', 'error', 'warning', 'debug']).default('info')  // Default log level
})

export type AppConfig = z.infer<typeof AppConfigSchema>

/**
 * Application configuration
 * DEV_MODE is automatically set based on NODE_ENV
 */
export const config: AppConfig = {
  DEV_MODE: process.env.NODE_ENV !== 'production',
  MOCK_LLM_SETTINGS: false,
  ENABLE_NARRATOR: false,
  VERSION: '0.1.0',
  LOG_LEVEL: process.env.NODE_ENV !== 'production' ? 'debug' : 'info'
}

/**
 * Get configuration value
 * @param key - Configuration key
 * @returns Configuration value
 */
export function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return config[key]
}

/**
 * Check if development mode is enabled
 * @returns True if DEV_MODE is enabled
 */
export function isDevelopmentMode(): boolean {
  return config.DEV_MODE
}

export function isMockLLMSettings(): boolean {
  return config.MOCK_LLM_SETTINGS
}

export function isPocMode(): boolean {
  return false;
}

/**
 * Evaluation configuration for development/debugging
 * 
 * To enable telemetry:
 * 1. Set ENABLE_TELEMETRY = true
 * 2. Add your Braintrust API key to BRAINTRUST_API_KEY
 * 3. Add your OpenAI API key to OPENAI_API_KEY_FOR_SCORING (for LLM-as-judge scoring)
 * 4. Optionally change OPENAI_MODEL_FOR_SCORING (defaults to gpt-5)
 * 5. Rebuild
 * 
 * 6. To expirement, you will need BRAINTRUST_PROJECT_UUID from your Braintrust dashboard
 * 
 */
export const ENABLE_TELEMETRY = false;
export const BRAINTRUST_API_KEY = 'api-key'; // ⚠️ ADD YOUR API KEY HERE!
export const OPENAI_API_KEY_FOR_SCORING = 'api-key'; // ⚠️ ADD YOUR OPENAI API KEY HERE FOR SCORING!
export const OPENAI_MODEL_FOR_SCORING = 'gpt-5'; // Model used for LLM-as-judge scoring
export const BRAINTRUST_PROJECT_UUID = 'uuid'; // ⚠️ ADD YOUR PROJECT UUID HERE! Get from Braintrust dashboard

export default config 
