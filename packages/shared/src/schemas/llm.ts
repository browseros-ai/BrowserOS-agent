/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Shared LLM configuration Zod schemas - single source of truth.
 * Use z.infer<> for TypeScript types.
 */

import { z } from 'zod'

/**
 * LLM provider constants for type-safe switch statements
 */
export const LLM_PROVIDERS = {
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  CODEX: 'codex',
  GOOGLE: 'google',
  OPENROUTER: 'openrouter',
  AZURE: 'azure',
  OLLAMA: 'ollama',
  LMSTUDIO: 'lmstudio',
  BEDROCK: 'bedrock',
  BROWSEROS: 'browseros',
  OPENAI_COMPATIBLE: 'openai-compatible',
  MOONSHOT: 'moonshot',
} as const

/**
 * Supported LLM providers
 */
export const LLMProviderSchema: z.ZodEnum<
  [
    'anthropic',
    'openai',
    'codex',
    'google',
    'openrouter',
    'azure',
    'ollama',
    'lmstudio',
    'bedrock',
    'browseros',
    'openai-compatible',
    'moonshot',
  ]
> = z.enum([
  LLM_PROVIDERS.ANTHROPIC,
  LLM_PROVIDERS.OPENAI,
  LLM_PROVIDERS.CODEX,
  LLM_PROVIDERS.GOOGLE,
  LLM_PROVIDERS.OPENROUTER,
  LLM_PROVIDERS.AZURE,
  LLM_PROVIDERS.OLLAMA,
  LLM_PROVIDERS.LMSTUDIO,
  LLM_PROVIDERS.BEDROCK,
  LLM_PROVIDERS.BROWSEROS,
  LLM_PROVIDERS.OPENAI_COMPATIBLE,
  LLM_PROVIDERS.MOONSHOT,
])

export type LLMProvider = z.infer<typeof LLMProviderSchema>

export const LLMAuthModeSchema = z.enum(['chatgpt', 'api-key'])

export type LLMAuthMode = z.infer<typeof LLMAuthModeSchema>

/**
 * LLM configuration schema
 * Used by SDK endpoints and agent configuration
 */
export const LLMConfigSchema: z.ZodObject<{
  provider: typeof LLMProviderSchema
  model: z.ZodOptional<z.ZodString>
  apiKey: z.ZodOptional<z.ZodString>
  authMode: z.ZodOptional<typeof LLMAuthModeSchema>
  baseUrl: z.ZodOptional<z.ZodString>
  resourceName: z.ZodOptional<z.ZodString>
  region: z.ZodOptional<z.ZodString>
  accessKeyId: z.ZodOptional<z.ZodString>
  secretAccessKey: z.ZodOptional<z.ZodString>
  sessionToken: z.ZodOptional<z.ZodString>
}> = z.object({
  provider: LLMProviderSchema,
  model: z.string().optional(),
  apiKey: z.string().optional(),
  authMode: LLMAuthModeSchema.optional(),
  baseUrl: z.string().optional(),
  // Azure-specific
  resourceName: z.string().optional(),
  // AWS Bedrock-specific
  region: z.string().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  sessionToken: z.string().optional(),
})

export type LLMConfig = z.infer<typeof LLMConfigSchema>
