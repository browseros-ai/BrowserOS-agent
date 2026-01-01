/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Shared LLM configuration types used by agent-sdk and server.
 */

export type LLMProvider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'openrouter'
  | 'azure'
  | 'ollama'
  | 'lmstudio'
  | 'bedrock'
  | 'browseros'
  | 'openai-compatible'

export interface LLMConfig {
  provider: LLMProvider
  model?: string
  apiKey?: string
  baseUrl?: string
  resourceName?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
}
