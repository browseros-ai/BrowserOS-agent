import { z } from 'zod'

/**
 * Application configuration schema
 */
export const AppConfigSchema = z.object({
  DEV_MODE: z.boolean(),  // Enable development features like enhanced logging
  MOCK_LLM_SETTINGS: z.boolean(),  // Enable mock LLM settings for development
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

/**
 * Evaluation configuration for development/debugging
 * 
 * To enable telemetry:
 * 1. Set ENABLE_TELEMETRY = true in your .env file
 * 2. Add your Braintrust API key to BRAINTRUST_API_KEY in your .env file
 * 3. Add your OpenAI API key to OPENAI_API_KEY_FOR_SCORING in your .env file (for LLM-as-judge scoring)
 * 4. Optionally change OPENAI_MODEL_FOR_SCORING in your .env file (defaults to gpt-4o)
 * 5. Rebuild
 * 
 * 6. To experiment, you will need BRAINTRUST_PROJECT_UUID from your Braintrust dashboard in your .env file
 * 7. Set BRAINTRUST_PROJECT_NAME in your .env file (defaults to 'browseros-agent-online')
 * 
 * For the simplified evals2 system:
 * 1. Set ENABLE_EVALS2 = true in your .env file
 * 2. Set BRAINTRUST_API_KEY in your .env file
 * 3. Set BRAINTRUST_PROJECT_NAME in your .env file (defaults to 'browseros-agent-online')
 * 4. Rebuild
 */
export const ENABLE_TELEMETRY = false; // process.env.ENABLE_TELEMETRY === 'true';
export const ENABLE_EVALS2 = false; //process.env.ENABLE_EVALS2 === 'true';
export const BRAINTRUST_API_KEY = process.env.BRAINTRUST_API_KEY || '';
export const BRAINTRUST_PROJECT_UUID = process.env.BRAINTRUST_PROJECT_UUID || '';
export const BRAINTRUST_PROJECT_NAME = process.env.BRAINTRUST_PROJECT_NAME || 'browseros-agent-online';

// Gemini API keys for evals2 scoring
export const GOOGLE_GENAI_API_KEY = process.env.GOOGLE_GENAI_API_KEY || '';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export default config 
