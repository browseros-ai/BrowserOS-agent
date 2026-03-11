import * as Sentry from '@sentry/react'
import { getBrowserOSAdapter } from '../browseros/adapter'
import { env } from '../env'

const isSidepanel = window.location.pathname.includes('sidepanel')

if (env.VITE_PUBLIC_SENTRY_DSN && !isSidepanel) {
  Sentry.init({
    dsn: env.VITE_PUBLIC_SENTRY_DSN,
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
    environment: env.PROD ? 'production' : 'development',
    release: chrome.runtime.getManifest().version,
  })

  ;(async () => {
    const adapter = getBrowserOSAdapter()
    const chromiumVersion = await adapter.getVersion()
    const browserOSVersion = await adapter.getBrowserosVersion()
    Sentry.setTag('chromiumVersion', chromiumVersion)
    Sentry.setTag('browserOSVersion', browserOSVersion)
  })()
}

/**
 * @public
 */
export const sentry = Sentry
