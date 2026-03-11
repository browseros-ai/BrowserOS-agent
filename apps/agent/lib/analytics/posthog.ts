import posthog from 'posthog-js'
import 'posthog-js/dist/posthog-recorder'
import { env } from '../env'

const isSidepanel = window.location.pathname.includes('sidepanel')

if (
  env.VITE_PUBLIC_POSTHOG_KEY &&
  env.VITE_PUBLIC_POSTHOG_HOST &&
  !isSidepanel
) {
  posthog.init(env.VITE_PUBLIC_POSTHOG_KEY, {
    api_host: env.VITE_PUBLIC_POSTHOG_HOST,
    person_profiles: 'identified_only',
    disable_external_dependency_loading: true,
    capture_pageview: true,
    session_recording: {
      maskAllInputs: true,
    },
    persistence: 'localStorage',
    loaded: (posthog) => {
      posthog.register({
        extension_version: chrome.runtime.getManifest().version,
        ui_context: window.location.pathname,
      })
    },
  })
}

export { posthog }
