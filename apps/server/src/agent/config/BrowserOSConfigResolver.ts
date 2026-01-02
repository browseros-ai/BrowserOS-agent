/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import {
  fetchBrowserOSConfig,
  getLLMConfigFromProvider,
  logger,
} from '../../common/index.js'
import type { ResolvedProviderConfig } from './types.js'

interface CachedConfig {
  config: ResolvedProviderConfig
  expiresAt: number
}

const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Resolves and caches BrowserOS provider configuration
 */
export class BrowserOSConfigResolver {
  private cache = new Map<string, CachedConfig>()
  private readonly ttlMs: number

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs
  }

  async resolve(browserosId?: string): Promise<ResolvedProviderConfig> {
    const cacheKey = browserosId ?? 'default'
    const cached = this.cache.get(cacheKey)

    if (cached && Date.now() < cached.expiresAt) {
      logger.debug('Using cached BrowserOS config', {
        cacheKey,
        expiresIn: Math.round((cached.expiresAt - Date.now()) / 1000),
      })
      return cached.config
    }

    const configUrl = process.env.BROWSEROS_CONFIG_URL
    if (!configUrl) {
      throw new Error(
        'BROWSEROS_CONFIG_URL environment variable is required for BrowserOS provider',
      )
    }

    logger.info('Fetching BrowserOS config', {
      configUrl,
      browserosId: browserosId?.slice(0, 12),
    })

    const browserosConfig = await fetchBrowserOSConfig(configUrl, browserosId)
    const llmConfig = getLLMConfigFromProvider(browserosConfig, 'default')

    const resolved: ResolvedProviderConfig = {
      model: llmConfig.modelName,
      apiKey: llmConfig.apiKey,
      baseUrl: llmConfig.baseUrl,
      upstreamProvider: llmConfig.providerType ?? 'unknown',
    }

    this.cache.set(cacheKey, {
      config: resolved,
      expiresAt: Date.now() + this.ttlMs,
    })

    logger.info('Cached BrowserOS config', {
      cacheKey,
      model: resolved.model,
      baseUrl: resolved.baseUrl,
      upstreamProvider: resolved.upstreamProvider,
    })

    return resolved
  }

  clearCache(): void {
    this.cache.clear()
  }
}
