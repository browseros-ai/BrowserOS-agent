/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { LLM_PROVIDERS, type LLMProvider } from '@browseros/shared/schemas/llm'
import type { ProviderAdapter } from './base'
import { BaseProviderAdapter } from './base'
import { GoogleAdapter } from './google'
import { OpenRouterAdapter } from './openrouter'

/**
 * Create the appropriate adapter for a provider.
 * Returns base adapter (no-op) for providers without special requirements.
 */
export function createProviderAdapter(provider: LLMProvider): ProviderAdapter {
  switch (provider) {
    case LLM_PROVIDERS.GOOGLE:
      return new GoogleAdapter()
    case LLM_PROVIDERS.OPENROUTER:
      return new OpenRouterAdapter()
    default:
      return new BaseProviderAdapter()
  }
}
