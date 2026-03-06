import {
  getConfiguredReleaseForExtensionVersion,
  getWhatsNewAppUrl,
} from './whats-new-config'
import {
  hasAutoShownWhatsNew,
  markWhatsNewAutoShown,
} from './whats-new-storage'

const WHATS_NEW_DELAY_MS = 5000

function getExtensionVersion(): string {
  return chrome.runtime.getManifest().version
}

export async function checkAndShowWhatsNew(): Promise<void> {
  const extensionVersion = getExtensionVersion()
  const configuredRelease =
    getConfiguredReleaseForExtensionVersion(extensionVersion)

  if (!configuredRelease?.config.autoShow) {
    return
  }

  if (await hasAutoShownWhatsNew(extensionVersion)) {
    return
  }

  setTimeout(async () => {
    await chrome.tabs.create({
      url: getWhatsNewAppUrl({
        release: configuredRelease.release.browserosVersion,
        source: 'update-notifier',
      }),
    })
    await markWhatsNewAutoShown(extensionVersion)
  }, WHATS_NEW_DELAY_MS)
}
