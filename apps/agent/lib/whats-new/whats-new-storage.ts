import { storage } from '@wxt-dev/storage'

const whatsNewAutoShownStorage = storage.defineItem<string[]>(
  'local:whatsNewAutoShownVersions',
  { fallback: [] },
)

const whatsNewBannerDismissedStorage = storage.defineItem<string[]>(
  'local:whatsNewBannerDismissedVersions',
  { fallback: [] },
)

async function includesVersion(
  item: typeof whatsNewAutoShownStorage,
  version: string,
): Promise<boolean> {
  const versions = await item.getValue()
  return versions.includes(version)
}

async function appendVersion(
  item: typeof whatsNewAutoShownStorage,
  version: string,
): Promise<void> {
  const versions = await item.getValue()
  if (!versions.includes(version)) {
    await item.setValue([...versions, version])
  }
}

export async function hasAutoShownWhatsNew(version: string): Promise<boolean> {
  return includesVersion(whatsNewAutoShownStorage, version)
}

export async function markWhatsNewAutoShown(version: string): Promise<void> {
  await appendVersion(whatsNewAutoShownStorage, version)
}

export async function isWhatsNewBannerDismissed(
  version: string,
): Promise<boolean> {
  return includesVersion(whatsNewBannerDismissedStorage, version)
}

export async function dismissWhatsNewBanner(version: string): Promise<void> {
  await appendVersion(whatsNewBannerDismissedStorage, version)
}
