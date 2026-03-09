import { seedStarterTweaksIfNeeded } from '@/lib/tweaks/storage'

function openStudio(
  hostname?: string,
  tweakId?: string,
): Promise<chrome.tabs.Tab> {
  const url = new URL(chrome.runtime.getURL('app.html'))

  if (hostname) {
    url.searchParams.set('host', hostname)
  }

  if (tweakId) {
    url.searchParams.set('tweak', tweakId)
  }

  return chrome.tabs.create({ url: url.toString() })
}

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener((details) => {
    seedStarterTweaksIfNeeded().catch(() => null)

    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      openStudio().catch(() => null)
    }
  })

  chrome.runtime.onStartup.addListener(() => {
    seedStarterTweaksIfNeeded().catch(() => null)
  })

  chrome.action.onClicked.addListener(async () => {
    await openStudio()
  })
})
