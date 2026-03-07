/**
 * @license
 * Copyright 2025 BrowserOS
 */
import * as Sentry from '@sentry/bun'

import { INLINED_ENV } from '../env'
import { VERSION } from '../version'

const SENTRY_ENVIRONMENT = process.env.NODE_ENV || 'development'

// Ensure to call this before importing any other modules!
Sentry.init({
  dsn: INLINED_ENV.SENTRY_DSN,
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/bun/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  environment: SENTRY_ENVIRONMENT,
  release: VERSION,
  tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,
})

// Catch unhandled errors at process level
process.on('unhandledRejection', (reason) => {
  Sentry.captureException(reason)
})

process.on('uncaughtException', (error) => {
  Sentry.captureException(error)
})

export { Sentry }
