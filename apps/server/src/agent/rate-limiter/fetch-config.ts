/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Rate limit configuration fetching from remote config service.
 */

import { RATE_LIMITS } from '@browseros/shared/constants/limits'

import { fetchBrowserOSConfig } from '../../common/gateway'
import { logger } from '../../common/logger'

export async function fetchDailyRateLimit(
  browserosId: string,
): Promise<number> {
  if (process.env.NODE_ENV === 'test') {
    logger.info('Test mode: rate limiting disabled')
    return RATE_LIMITS.TEST_DAILY
  }

  if (process.env.NODE_ENV === 'development') {
    logger.info('Dev mode: using dev rate limit', {
      dailyRateLimit: RATE_LIMITS.DEV_DAILY,
    })
    return RATE_LIMITS.DEV_DAILY
  }

  const configUrl = process.env.BROWSEROS_CONFIG_URL
  if (!configUrl) {
    logger.info('No BROWSEROS_CONFIG_URL, using default rate limit', {
      dailyRateLimit: RATE_LIMITS.DEFAULT_DAILY,
    })
    return RATE_LIMITS.DEFAULT_DAILY
  }

  try {
    const browserosConfig = await fetchBrowserOSConfig(configUrl, browserosId)
    const defaultProvider = browserosConfig.providers.find(
      (p) => p.name === 'default',
    )
    const dailyRateLimit =
      defaultProvider?.dailyRateLimit ?? RATE_LIMITS.DEFAULT_DAILY

    logger.info('Rate limit config fetched', { dailyRateLimit })
    return dailyRateLimit
  } catch (error) {
    logger.warn('Failed to fetch rate limit config, using default', {
      error: error instanceof Error ? error.message : String(error),
      dailyRateLimit: RATE_LIMITS.DEFAULT_DAILY,
    })
    return RATE_LIMITS.DEFAULT_DAILY
  }
}
