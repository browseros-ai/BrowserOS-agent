import { useEffect, useState } from 'react'
import type { ReleaseNote } from '@/lib/whats-new/whats-new-config'
import { getConfiguredReleaseForExtensionVersion } from '@/lib/whats-new/whats-new-config'
import {
  dismissWhatsNewBanner,
  isWhatsNewBannerDismissed,
} from '@/lib/whats-new/whats-new-storage'

interface BannerState {
  extensionVersion: string
  release: ReleaseNote
}

export function useWhatsNewBanner(): {
  banner: BannerState | null
  dismissBanner: () => Promise<void>
} {
  const [banner, setBanner] = useState<BannerState | null>(null)

  useEffect(() => {
    let cancelled = false
    const extensionVersion = chrome.runtime.getManifest().version
    const configuredRelease =
      getConfiguredReleaseForExtensionVersion(extensionVersion)

    if (!configuredRelease?.config.showBanner) {
      return
    }

    isWhatsNewBannerDismissed(extensionVersion)
      .then((dismissed) => {
        if (!dismissed && !cancelled) {
          setBanner({
            extensionVersion,
            release: configuredRelease.release,
          })
        }
      })
      .catch(() => null)

    return () => {
      cancelled = true
    }
  }, [])

  async function dismissBanner(): Promise<void> {
    if (!banner) {
      return
    }

    await dismissWhatsNewBanner(banner.extensionVersion)
    setBanner(null)
  }

  return { banner, dismissBanner }
}
