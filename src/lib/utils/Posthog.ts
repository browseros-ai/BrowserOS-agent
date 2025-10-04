import posthog from 'posthog-js'
import 'posthog-js/dist/posthog-recorder'  // Manifest V3 compatible session recording

/**
 * Initialize metrics and session recording for UI contexts ONLY
 * DO NOT use in service workers, background scripts, or content scripts
 */
export function initializeMetrics(): void {
  const posthogApiKey = process.env.POSTHOG_API_KEY

  if (!posthogApiKey) {
    console.warn('[Metrics] No API key found')
    return
  }

  // Only initialize if we have a DOM (safety check)
  if (typeof document === 'undefined') {
    console.error('[Metrics] No DOM found - cannot initialize in this context')
    return
  }

  posthog.init(posthogApiKey, {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    disable_external_dependency_loading: true,
    persistence: 'localStorage',
    disable_session_recording: false,
    capture_pageview: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: false
    },
    loaded: (posthog) => {
      console.log('[Metrics] Initialized for UI context')
      posthog.register({
        extension_version: chrome.runtime.getManifest().version,
        ui_context: window.location.pathname
      })
    }
  })
}
